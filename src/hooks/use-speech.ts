'use client'

import { useCallback, useRef, useState } from 'react'

export interface Segment {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestampMs: number
}

export function useSpeech() {
  const [active, setActive] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const segMapRef = useRef(new Map<string, Segment>())
  const liveIdRef = useRef(`live-${Date.now()}`)
  const shouldRestartRef = useRef(false)

  const flush = useCallback(() => {
    setSegments(Array.from(segMapRef.current.values()))
  }, [])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: typeof SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      setPermissionError('Speech recognition is not supported. Try Chrome or Edge.')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onstart = () => setActive(true)

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermissionError('Microphone access denied. Allow it in your browser settings.')
        shouldRestartRef.current = false
      }
      // Transient errors (network, aborted) — let onend handle restart
    }

    recognition.onend = () => {
      setActive(false)
      // Auto-restart when the browser stops recognition (e.g. after silence)
      if (shouldRestartRef.current) {
        try { recognition.start() } catch { /* ignore race on rapid stop/start */ }
      }
    }

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript.trim()
        if (!text) continue

        if (result.isFinal) {
          const id = `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
          segMapRef.current.delete(liveIdRef.current)
          segMapRef.current.set(id, { id, speaker: 'me', text, isFinal: true, timestampMs: Date.now() })
          liveIdRef.current = `live-${Date.now()}`
        } else {
          segMapRef.current.set(liveIdRef.current, {
            id: liveIdRef.current,
            speaker: 'me',
            text,
            isFinal: false,
            timestampMs: Date.now(),
          })
        }
        flush()
      }
    }

    shouldRestartRef.current = true
    recognition.start()
  }, [flush])

  const toggle = useCallback(() => {
    if (shouldRestartRef.current || active) {
      stop()
    } else {
      start()
    }
  }, [active, start, stop])

  return { active, segments, permissionError, toggle }
}
