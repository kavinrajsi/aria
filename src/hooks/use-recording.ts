'use client'

import { useCallback, useRef, useState } from 'react'

export function useRecording() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const streamRef   = useRef<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)

  const start = useCallback(async () => {
    if (recorderRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(1000) // collect 1-second chunks
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      // mic permission denied — transcription hook will surface this error
    }
  }, [])

  // Returns the assembled audio Blob, or null if nothing was recorded
  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder) { resolve(null); return }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        chunksRef.current = []
        recorderRef.current = null
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setRecording(false)
        resolve(blob.size > 0 ? blob : null)
      }
      recorder.stop()
    })
  }, [])

  return { recording, start, stop }
}
