'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type SttProvider = 'openai' | 'elevenlabs' | 'sarvam'

export interface Segment {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestampMs: number
}

// ── Audio helpers ──────────────────────────────────────────────────────

function float32ToPCM16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

function toBase64(buffer: Int16Array): string {
  const bytes = new Uint8Array(buffer.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// ── Provider configs ───────────────────────────────────────────────────

const VAD_CONFIG = {
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 600,
}

interface ProviderSetup {
  tokenUrl: string
  sampleRate: number
  connect(token: string): WebSocket
  onOpen(ws: WebSocket): void
  sendAudio(ws: WebSocket, pcm16Base64: string): void
  parseMessage(
    data: string,
    ws: WebSocket
  ): { type: 'partial' | 'final' | 'ignore'; id: string; text: string }
}

function getProvider(provider: SttProvider): ProviderSetup {
  switch (provider) {
    case 'openai':
      return {
        tokenUrl: '/api/transcribe/session',
        sampleRate: 24_000,
        connect(token) {
          return new WebSocket(
            'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
            ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1']
          )
        },
        onOpen(ws) {
          ws.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text'],
                input_audio_format: 'pcm16',
                input_audio_transcription: { model: 'whisper-1' },
                turn_detection: { type: 'server_vad', ...VAD_CONFIG },
                instructions: 'Transcribe speech only. Do not generate any responses.',
              },
            })
          )
        },
        sendAudio(ws, pcm16Base64) {
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm16Base64 }))
        },
        parseMessage(data, ws) {
          const msg = JSON.parse(data)

          if (msg.type === 'conversation.item.input_audio_transcription.delta') {
            return { type: 'partial', id: msg.item_id, text: msg.delta ?? '' }
          }
          if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            return { type: 'final', id: msg.item_id, text: msg.transcript?.trim() ?? '' }
          }
          // Cancel any LLM response the model tries to generate
          if (msg.type === 'response.created') {
            ws.send(JSON.stringify({ type: 'response.cancel' }))
          }
          return { type: 'ignore', id: '', text: '' }
        },
      }

    case 'elevenlabs':
      return {
        tokenUrl: '/api/elevenlabs/stt-token',
        sampleRate: 16_000,
        connect(token) {
          const params = new URLSearchParams({
            model_id: 'scribe_v2',
            language_code: 'en',
            commit_strategy: 'vad',
            vad_silence_threshold_secs: '1.0',
            audio_format: 'pcm_16000',
            token,
          })
          return new WebSocket(
            `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`
          )
        },
        onOpen() {
          // ElevenLabs doesn't require a session config message
        },
        sendAudio(ws, pcm16Base64) {
          ws.send(
            JSON.stringify({
              message_type: 'input_audio_chunk',
              audio_base_64: pcm16Base64,
              sample_rate: 16_000,
            })
          )
        },
        parseMessage(data) {
          const msg = JSON.parse(data)
          const type = msg.message_type ?? msg.type

          if (type === 'partial_transcript') {
            return {
              type: 'partial',
              id: msg.utterance_id ?? `el-${Date.now()}`,
              text: msg.text ?? '',
            }
          }
          if (
            type === 'committed_transcript' ||
            type === 'committed_transcript_with_timestamps'
          ) {
            return {
              type: 'final',
              id: msg.utterance_id ?? `el-${Date.now()}`,
              text: msg.text?.trim() ?? '',
            }
          }
          return { type: 'ignore', id: '', text: '' }
        },
      }

    case 'sarvam':
      return {
        tokenUrl: '/api/sarvam/token',
        sampleRate: 16_000,
        connect(token) {
          const params = new URLSearchParams({
            model: 'saaras:v3',
            mode: 'transcribe',
            'language-code': 'en-IN',
            'api-subscription-key': token,
            encoding: 'pcm_s16le',
            sample_rate: '16000',
          })
          return new WebSocket(`wss://api.sarvam.ai/speech-to-text/ws?${params}`)
        },
        onOpen() {
          // Sarvam doesn't require a session config message
        },
        sendAudio(ws, pcm16Base64) {
          // Sarvam expects raw binary PCM frames over WebSocket
          const binary = atob(pcm16Base64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          ws.send(bytes.buffer)
        },
        parseMessage(data) {
          const msg = JSON.parse(data)
          const type = msg.type ?? msg.event

          if (type === 'transcript') {
            const text = (msg.text ?? msg.transcript ?? '').trim()
            return {
              type: text ? 'final' : 'ignore',
              id: `sv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              text,
            }
          }
          // speech_start / speech_end are VAD signals — ignore
          return { type: 'ignore', id: '', text: '' }
        },
      }
  }
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useTranscription(provider: SttProvider = 'openai') {
  const [active, setActive] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const shouldRunRef = useRef(false)
  const providerRef = useRef(provider)
  providerRef.current = provider

  const stop = useCallback(() => {
    shouldRunRef.current = false
    processorRef.current?.disconnect()
    processorRef.current = null
    audioCtxRef.current?.close().catch(() => null)
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close()
    wsRef.current = null
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    try {
      const cfg = getProvider(providerRef.current)

      // 1. Get token from server
      const tokenRes = await fetch(cfg.tokenUrl)
      if (!tokenRes.ok) throw new Error('Could not get transcription session')
      const { token, error: tokenError } = await tokenRes.json()
      if (tokenError) throw new Error(tokenError)

      // 2. Mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 3. Connect WebSocket
      const ws = cfg.connect(token)
      wsRef.current = ws

      ws.onopen = () => {
        cfg.onOpen(ws)

        // 4. Pipe mic audio as PCM16 to the WebSocket
        const audioCtx = new AudioContext({ sampleRate: cfg.sampleRate })
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const pcm16 = float32ToPCM16(e.inputBuffer.getChannelData(0))
          cfg.sendAudio(ws, toBase64(pcm16))
        }

        source.connect(processor)
        processor.connect(audioCtx.destination)
        setActive(true)
      }

      ws.onmessage = (event) => {
        try {
          const { type, id, text } = cfg.parseMessage(event.data as string, ws)
          if (type === 'ignore') return

          if (type === 'partial') {
            if (!text) return
            setSegments((prev) => {
              const existing = prev.find((s) => s.id === id)
              if (existing) {
                return prev.map((s) =>
                  s.id === id ? { ...s, text: s.text + text } : s
                )
              }
              return [
                ...prev,
                { id, speaker: 'me', text, isFinal: false, timestampMs: Date.now() },
              ]
            })
          }

          if (type === 'final') {
            if (!text) {
              setSegments((prev) => prev.filter((s) => s.id !== id))
              return
            }
            setSegments((prev) => {
              const exists = prev.some((s) => s.id === id)
              if (exists) {
                return prev.map((s) =>
                  s.id === id ? { ...s, text, isFinal: true } : s
                )
              }
              return [
                ...prev,
                { id, speaker: 'me', text, isFinal: true, timestampMs: Date.now() },
              ]
            })
          }
        } catch {
          // ignore malformed frames
        }
      }

      ws.onerror = () => {
        if (shouldRunRef.current) setPermissionError('Transcription connection failed.')
      }

      ws.onclose = () => {
        if (shouldRunRef.current) stop()
      }

      shouldRunRef.current = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPermissionError(
        msg.toLowerCase().includes('denied')
          ? 'Microphone access denied. Allow it in your browser settings.'
          : msg
      )
    }
  }, [stop])

  const toggle = useCallback(() => {
    if (shouldRunRef.current || active) stop()
    else start()
  }, [active, start, stop])

  useEffect(() => () => { shouldRunRef.current = false; stop() }, [stop])

  return { active, segments, permissionError, toggle }
}
