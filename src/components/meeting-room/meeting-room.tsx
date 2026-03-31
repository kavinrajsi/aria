'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { useTts } from '@/hooks/use-tts'
import { TranscriptFeed } from './transcript-feed'
import { AriaPanel } from './aria-panel'
import { MeetingControls } from './meeting-controls'
import { InlineRename } from '@/components/meetings/inline-rename'

interface Meeting {
  id: string
  title: string
  ai_provider: 'openai' | null
  agenda_items: string[]
  briefing_notes: string | null
}

interface SavedTranscript {
  id: string
  speaker_label: string | null
  content: string
  timestamp_ms: number
}

interface CurrentUser {
  id: string
  name: string
}

interface MeetingRoomProps {
  meeting: Meeting
  currentUser: CurrentUser
  initialTranscripts: SavedTranscript[]
  hasElevenLabsKey: boolean
  canEdit: boolean
}

interface AriaInteraction {
  query: string
  response: string
}

export function MeetingRoom({
  meeting,
  currentUser,
  initialTranscripts,
  hasElevenLabsKey,
  canEdit,
}: MeetingRoomProps) {
  const router = useRouter()

  // ── Audio (Web Speech API) ───────────────────────────────────────
  const { active: micActive, segments, permissionError, toggle: toggleMic } = useRealtime()

  useEffect(() => {
    if (permissionError) toast.error(`Microphone: ${permissionError}`)
  }, [permissionError])

  // ── Saved transcripts (Supabase Realtime) ────────────────────────
  const [savedTranscripts, setSavedTranscripts] = useState<SavedTranscript[]>(initialTranscripts)
  const meetingStartMs = useRef(Date.now())

  // Write each final Deepgram segment to the DB once
  const persistedIds = useRef(new Set<string>())
  useEffect(() => {
    const finals = segments.filter((s) => s.isFinal && !persistedIds.current.has(s.id))
    if (!finals.length) return

    const supabase = createClient()
    for (const seg of finals) {
      persistedIds.current.add(seg.id)
      supabase
        .from('transcripts')
        .insert({
          meeting_id: meeting.id,
          content: seg.text,
          speaker_label: currentUser.name,
          user_id: currentUser.id,
          timestamp_ms: seg.timestampMs - meetingStartMs.current,
        })
        .then(({ error }) => {
          if (error) console.error('[transcript insert]', error)
        })
    }
  }, [segments, meeting.id, currentUser])

  // Subscribe to all participants' transcripts via Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`meeting-transcripts-${meeting.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcripts',
          filter: `meeting_id=eq.${meeting.id}`,
        },
        (payload) => {
          const t = payload.new as SavedTranscript
          setSavedTranscripts((prev) => {
            if (prev.some((p) => p.id === t.id)) return prev
            return [...prev, t].sort((a, b) => a.timestamp_ms - b.timestamp_ms)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [meeting.id])

  // ── TTS ──────────────────────────────────────────────────────────
  const { speaking, speak, stop: stopSpeaking } = useTts()
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  // ── Aria ─────────────────────────────────────────────────────────
  const [ariaQuery, setAriaQuery] = useState('')
  const [ariaResponse, setAriaResponse] = useState('')
  const [ariaLoading, setAriaLoading] = useState(false)
  const [ariaHistory, setAriaHistory] = useState<AriaInteraction[]>([])

  // Core submit function — accepts query directly so wake word can call it too
  const submitQuery = useCallback(
    async (q: string) => {
      if (!q || ariaLoading) return

      setAriaLoading(true)
      setAriaResponse('')

      const context = savedTranscripts
        .slice(-12)
        .map((t) => `${t.speaker_label ?? 'Unknown'}: ${t.content}`)
        .join('\n')

      try {
        const res = await fetch('/api/aria/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId: meeting.id, query: q, context }),
        })

        if (!res.ok || !res.body) {
          toast.error('Aria is unavailable')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let full = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value, { stream: true })
          setAriaResponse(full)
        }

        setAriaHistory((prev) => [...prev, { query: q, response: full }])
        setAriaResponse('')

        // Speak the response if voice is enabled
        if (voiceEnabled && full) speak(full)
      } catch {
        toast.error('Failed to reach Aria')
      } finally {
        setAriaLoading(false)
      }
    },
    [ariaLoading, savedTranscripts, meeting.id, voiceEnabled, speak]
  )

  const handleAriaSubmit = useCallback(async () => {
    const q = ariaQuery.trim()
    if (!q) return
    setAriaQuery('')
    await submitQuery(q)
  }, [ariaQuery, submitQuery])

  // ── Wake word detection ───────────────────────────────────────────
  // Handles two cases:
  //   1. Inline: "Hey Aria, what's the status?" — query in the same chunk
  //   2. Split:  "Hey Aria." pause → "What's the status?" — query in the next chunk
  const lastWakeSegmentRef = useRef<string | null>(null)
  const awaitingQueryRef = useRef(false)
  const awaitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enterListeningMode = useCallback(() => {
    awaitingQueryRef.current = true
    if (awaitingTimerRef.current) clearTimeout(awaitingTimerRef.current)
    // Auto-reset after 15s if no follow-up arrives
    awaitingTimerRef.current = setTimeout(() => {
      awaitingQueryRef.current = false
    }, 15_000)
    toast.info('Aria is listening…')
  }, [])

  const isWakeWord = (text: string) =>
    /hey[,\s]*aria/i.test(text) || /^aria[,.]?$/i.test(text)

  useEffect(() => {
    const finals = segments.filter((s) => s.isFinal)
    const latest = finals.at(-1)
    if (!latest || latest.id === lastWakeSegmentRef.current) return
    lastWakeSegmentRef.current = latest.id

    const text = latest.text.trim()

    // Follow-up chunk after a wake-word-only detection
    if (awaitingQueryRef.current) {
      if (awaitingTimerRef.current) clearTimeout(awaitingTimerRef.current)
      awaitingQueryRef.current = false

      // If the follow-up chunk is ALSO a wake word, re-enter listening mode
      // instead of submitting "hey aria" as the query
      if (isWakeWord(text)) {
        enterListeningMode()
        return
      }

      if (text.length >= 3 && !ariaLoading) submitQuery(text)
      return
    }

    // Inline query — Whisper may add commas/periods between words
    // e.g. "Hey, Aria, summarize this" or "hey aria what did she say"
    const inlineMatch =
      text.match(/hey[,\s]+aria[,.]?\s+(.+)/i) ||
      text.match(/\baria[,.]?\s+(.+)/i)

    if (inlineMatch) {
      const q = inlineMatch[1].trim()
      if (q.length >= 3 && !ariaLoading) submitQuery(q)
      return
    }

    // Wake word alone — wait for the next chunk as the query
    if (isWakeWord(text)) enterListeningMode()
  }, [segments, ariaLoading, submitQuery, enterListeningMode])

  // ── End meeting ──────────────────────────────────────────────────
  const [endingMeeting, startEnd] = useTransition()

  function endMeeting() {
    startEnd(async () => {
      const res = await fetch(`/api/meetings/${meeting.id}/end`, { method: 'POST' })
      if (res.ok) {
        router.push(`/meetings/${meeting.id}`)
      } else {
        toast.error('Failed to end meeting')
      }
    })
  }

  const liveSegment = segments.find((s) => !s.isFinal) ?? null

  // Merge local final segments into the display list so transcripts appear
  // immediately — before the DB insert → Realtime round-trip completes.
  const displayTranscripts = (() => {
    const savedIds = new Set(savedTranscripts.map((t) => t.id))
    const localFinals = segments
      .filter((s) => s.isFinal && !savedIds.has(s.id))
      .map((s) => ({
        id: s.id,
        speaker_label: currentUser.name,
        content: s.text,
        timestamp_ms: s.timestampMs - meetingStartMs.current,
      }))
    return [...savedTranscripts, ...localFinals].sort((a, b) => a.timestamp_ms - b.timestamp_ms)
  })()

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary-foreground">A</span>
          </div>
          <div className="min-w-0">
            <InlineRename
              meetingId={meeting.id}
              initialTitle={meeting.title}
              canEdit={canEdit}
              className="text-sm font-semibold leading-none"
            />
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              {micActive ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Listening
                </>
              ) : (
                'Ready'
              )}
            </p>
          </div>
        </div>
        <MeetingControls
          micActive={micActive}
          onToggleMic={toggleMic}
          onEndMeeting={endMeeting}
          endingMeeting={endingMeeting}
        />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <TranscriptFeed
          savedTranscripts={displayTranscripts}
          liveSegment={liveSegment}
          currentUserName={currentUser.name}
          micActive={micActive}
          onToggleMic={toggleMic}
        />
        <AriaPanel
          query={ariaQuery}
          onQueryChange={setAriaQuery}
          onSubmit={handleAriaSubmit}
          response={ariaResponse}
          loading={ariaLoading}
          history={ariaHistory}
          aiProvider={meeting.ai_provider}
          hasVoice={hasElevenLabsKey}
          voiceEnabled={voiceEnabled}
          speaking={speaking}
          onToggleVoice={() => setVoiceEnabled((v) => !v)}
          onStopVoice={stopSpeaking}
        />
      </div>
    </div>
  )
}
