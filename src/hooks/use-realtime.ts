'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Segment {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestampMs: number
}

// TODO: Tune these VAD settings for your use case.
// - threshold: 0.0–1.0 — how sensitive the mic is to voice (lower = more sensitive)
// - silence_duration_ms: how long of a pause ends the utterance (lower = faster commit)
const VAD_CONFIG = {
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 600,
}

// Convert Web Audio Float32 samples [-1,1] → PCM16 Int16Array (required by OpenAI Realtime)
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

export function useRealtime() {
  const [active, setActive] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const shouldRunRef = useRef(false)

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
      // 1. Get short-lived token from server (expires ~60s — connect immediately)
      const tokenRes = await fetch('/api/transcribe/session')
      if (!tokenRes.ok) throw new Error('Could not get transcription session')
      const { token, error: tokenError } = await tokenRes.json()
      if (tokenError) throw new Error(tokenError)

      // 2. Mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 3. Connect to OpenAI Realtime API — subprotocol carries the ephemeral token
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1']
      )
      wsRef.current = ws

      ws.onopen = () => {
        // Configure session: transcription-only, server VAD, no LLM response
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

        // 4. Pipe mic audio as PCM16 chunks to the WebSocket
        const audioCtx = new AudioContext({ sampleRate: 24000 })
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const pcm16 = float32ToPCM16(e.inputBuffer.getChannelData(0))
          ws.send(
            JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(pcm16) })
          )
        }

        source.connect(processor)
        processor.connect(audioCtx.destination)
        setActive(true)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)

          // Streaming partial transcript — update or create the interim segment
          if (msg.type === 'conversation.item.input_audio_transcription.delta') {
            const id: string = msg.item_id
            const delta: string = msg.delta ?? ''
            if (!delta) return
            setSegments((prev) => {
              const existing = prev.find((s) => s.id === id)
              if (existing) {
                return prev.map((s) =>
                  s.id === id ? { ...s, text: s.text + delta } : s
                )
              }
              return [
                ...prev,
                { id, speaker: 'me', text: delta, isFinal: false, timestampMs: Date.now() },
              ]
            })
          }

          // Final transcript — mark segment as done
          if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            const id: string = msg.item_id
            const text: string = msg.transcript?.trim() ?? ''
            if (!text) {
              // Empty utterance (silence) — remove the placeholder
              setSegments((prev) => prev.filter((s) => s.id !== id))
              return
            }
            setSegments((prev) =>
              prev.map((s) => (s.id === id ? { ...s, text, isFinal: true } : s))
            )
          }

          // Cancel any LLM response the model tries to generate
          if (msg.type === 'response.created') {
            ws.send(JSON.stringify({ type: 'response.cancel' }))
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
