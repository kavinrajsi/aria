'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type OnChunk = (chunk: Blob) => void

export function useMicrophone(onChunk: OnChunk) {
  // Keep callback ref stable so the MediaRecorder event doesn't capture stale closure
  const onChunkRef = useRef(onChunk)
  useEffect(() => { onChunkRef.current = onChunk }, [onChunk])

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const start = useCallback(async () => {
    if (active) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      )

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) onChunkRef.current(e.data)
      }
      recorder.start(250) // 250 ms chunks
      recorderRef.current = recorder
      setActive(true)
      setPermissionError(null)
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [active])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    streamRef.current = null
    setActive(false)
  }, [])

  const toggle = useCallback(() => {
    if (active) stop()
    else start()
  }, [active, start, stop])

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop])

  return { active, permissionError, start, stop, toggle }
}
