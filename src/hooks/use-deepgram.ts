'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface Segment {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestampMs: number
}

const WS_BASE =
  'wss://api.deepgram.com/v1/listen' +
  '?model=nova-2&smart_format=true&diarize=true&language=en-US' +
  '&utterance_end_ms=1200&vad_events=true'

const MAX_RECONNECT_ATTEMPTS = 10

// TODO: Implement your reconnect backoff strategy.
// Called with the current attempt number (0-indexed). Return the delay in ms
// before the next attempt. Trade-offs to consider:
//   - Aggressive: Math.min(1_000 * 2 ** attempt, 15_000) — faster recovery, more load on Deepgram
//   - Conservative: Math.min(2_000 * 2 ** attempt, 60_000) — gentler, worse for flaky mobile networks
//   - Fixed: () => 3_000 — simple, but hammers the server on persistent outages
function getReconnectDelay(attempt: number): number {
  return Math.min(1_000 * 2 ** attempt, 30_000)
}

export function useDeepgram(token: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [error, setError] = useState(false)

  const shouldReconnectRef = useRef(true)
  const reconnectAttemptRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use a Map keyed by id so interim updates are O(1)
  const segMapRef = useRef(new Map<string, Segment>())
  const liveIdRef = useRef(`live-${Date.now()}`)
  const [segments, setSegments] = useState<Segment[]>([])

  const flush = useCallback(() => {
    setSegments(Array.from(segMapRef.current.values()))
  }, [])

  const sendAudio = useCallback((chunk: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(chunk)
  }, [])

  useEffect(() => {
    if (!token) return

    shouldReconnectRef.current = true
    reconnectAttemptRef.current = 0
    setError(false)

    function connect() {
      // Browser WebSockets cannot set headers — Deepgram authenticates via
      // access_token query parameter instead of Authorization header
      const ws = new WebSocket(`${WS_BASE}&access_token=${encodeURIComponent(token!)}`)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        setConnected(true)
        setReconnecting(false)
      }

      ws.onclose = (event) => {
        setConnected(false)
        wsRef.current = null

        if (!shouldReconnectRef.current) return

        // 1008 = Policy Violation (Deepgram auth rejected) — retrying with the
        // same token won't help; surface as a permanent error immediately.
        if (event.code === 1008) {
          setReconnecting(false)
          setError(true)
          return
        }

        const attempt = reconnectAttemptRef.current
        if (attempt >= MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(false)
          setError(true)
          return
        }

        reconnectAttemptRef.current += 1
        setReconnecting(true)
        retryTimerRef.current = setTimeout(connect, getReconnectDelay(attempt))
      }

      ws.onerror = () => setConnected(false)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.type !== 'Results') return

          const alt = msg.channel?.alternatives?.[0]
          const text: string = alt?.transcript ?? ''
          if (!text.trim()) return

          const speakerIdx: number = alt?.words?.[0]?.speaker ?? 0
          const speaker = `Speaker ${speakerIdx + 1}`
          const isFinal: boolean = msg.is_final === true

          if (isFinal) {
            const id = `seg-${Date.now()}-${Math.random().toString(36).slice(2)}`
            // Remove interim placeholder, add final
            segMapRef.current.delete(liveIdRef.current)
            segMapRef.current.set(id, { id, speaker, text, isFinal: true, timestampMs: Date.now() })
            liveIdRef.current = `live-${Date.now()}`
          } else {
            segMapRef.current.set(liveIdRef.current, {
              id: liveIdRef.current,
              speaker,
              text,
              isFinal: false,
              timestampMs: Date.now(),
            })
          }
          flush()
        } catch {
          // ignore malformed frames
        }
      }
    }

    connect()

    // Keepalive: send 8 bytes of silence every 30s to prevent Deepgram's
    // 60-second idle timeout from closing the connection when the mic is muted.
    const keepaliveInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(new Blob([new Uint8Array(8)]))
      }
    }, 30_000)

    return () => {
      shouldReconnectRef.current = false
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      clearInterval(keepaliveInterval)
      wsRef.current?.close()
      wsRef.current = null
      setConnected(false)
      setReconnecting(false)
    }
  }, [token, flush])

  return { connected, reconnecting, error, segments, sendAudio }
}
