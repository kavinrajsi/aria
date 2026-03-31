'use client'

import { useCallback, useRef, useState } from 'react'

export interface Segment {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestampMs: number
}

// Duration of each audio chunk sent to Whisper
const CHUNK_DURATION_MS = 5_000

function getBestMimeType(): string {
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

function fileExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'mp4'
  return 'webm'
}

export function useWhisper() {
  const [active, setActive] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])

  const streamRef = useRef<MediaStream | null>(null)
  const shouldRunRef = useRef(false)
  const mimeTypeRef = useRef('')

  const appendSegment = useCallback((text: string) => {
    const id = `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setSegments((prev) => [
      ...prev,
      { id, speaker: 'me', text, isFinal: true, timestampMs: Date.now() },
    ])
  }, [])

  // Records one CHUNK_DURATION_MS clip, transcribes it, then starts the next.
  // Stop/restart gives Whisper a complete valid audio file each cycle
  // (timeslice chunks after the first lack the WebM header).
  const recordCycle = useCallback(
    (stream: MediaStream) => {
      if (!shouldRunRef.current) return

      const mimeType = mimeTypeRef.current
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        // Kick off next cycle immediately — don't wait for transcription
        if (shouldRunRef.current) recordCycle(stream)

        if (chunks.length === 0) return
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })

        try {
          const formData = new FormData()
          formData.append('audio', blob, `audio.${fileExtension(mimeType)}`)
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          if (!res.ok) return
          const { text } = (await res.json()) as { text: string }
          if (text?.trim()) appendSegment(text.trim())
        } catch {
          // ignore transient network errors
        }
      }

      recorder.start()
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, CHUNK_DURATION_MS)
    },
    [appendSegment]
  )

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      mimeTypeRef.current = getBestMimeType()
      shouldRunRef.current = true
      setActive(true)
      recordCycle(stream)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPermissionError(
        msg.toLowerCase().includes('denied')
          ? 'Microphone access denied. Allow it in your browser settings.'
          : 'Could not access microphone.'
      )
    }
  }, [recordCycle])

  const stop = useCallback(() => {
    shouldRunRef.current = false
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setActive(false)
  }, [])

  const toggle = useCallback(() => {
    if (shouldRunRef.current) stop()
    else start()
  }, [start, stop])

  return { active, segments, permissionError, toggle }
}
