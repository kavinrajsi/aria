'use client'

import { useCallback, useRef, useState } from 'react'

export function useTts() {
  const [speaking, setSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      // Cancel any current playback before starting new
      stop()

      setSpeaking(true)
      try {
        const res = await fetch('/api/elevenlabs/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (!res.ok) {
          setSpeaking(false)
          return
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
          audioRef.current = null
        }
        audio.onerror = () => {
          setSpeaking(false)
          URL.revokeObjectURL(url)
          objectUrlRef.current = null
          audioRef.current = null
        }

        await audio.play()
      } catch {
        setSpeaking(false)
      }
    },
    [stop]
  )

  return { speaking, speak, stop }
}
