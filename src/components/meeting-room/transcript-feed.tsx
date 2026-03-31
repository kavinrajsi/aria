'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Segment } from '@/hooks/use-realtime'

interface SavedTranscript {
  id: string
  speaker_label: string | null
  content: string
  timestamp_ms: number
}

interface TranscriptFeedProps {
  savedTranscripts: SavedTranscript[]
  liveSegment: Segment | null
  currentUserName: string
  micActive: boolean
  onToggleMic: () => void
}

function SpeakerBubble({
  speaker,
  text,
  isLive = false,
  isSelf = false,
}: {
  speaker: string
  text: string
  isLive?: boolean
  isSelf?: boolean
}) {
  const initials = speaker
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn('flex gap-3 group', isSelf && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5',
          isSelf
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {initials}
      </div>

      <div className={cn('flex flex-col gap-0.5 min-w-0', isSelf && 'items-end')}>
        <span className="text-xs text-muted-foreground">{speaker}</span>
        <p
          className={cn(
            'text-sm px-3 py-2 rounded-2xl max-w-prose break-words',
            isSelf
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm',
            isLive && 'opacity-60 italic'
          )}
        >
          {text}
          {isLive && (
            <span className="inline-flex gap-0.5 ml-1.5 align-middle">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-current animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

export function TranscriptFeed({
  savedTranscripts,
  liveSegment,
  currentUserName,
  micActive,
  onToggleMic,
}: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [savedTranscripts.length, liveSegment?.text])

  const isEmpty = savedTranscripts.length === 0 && !liveSegment

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-r">
      <div className="px-4 py-2 border-b shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Transcript
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-sm text-muted-foreground">Aria is listening…</p>
            {micActive ? (
              <p className="text-xs text-muted-foreground">Start speaking to see your transcript.</p>
            ) : (
              <button
                onClick={onToggleMic}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Turn on your microphone to start transcribing.
              </button>
            )}
          </div>
        ) : (
          <>
            {savedTranscripts.map((t) => (
              <SpeakerBubble
                key={t.id}
                speaker={t.speaker_label ?? 'Unknown'}
                text={t.content}
                isSelf={t.speaker_label === currentUserName}
              />
            ))}

            {liveSegment && (
              <SpeakerBubble
                key="live"
                speaker={currentUserName}
                text={liveSegment.text}
                isLive
                isSelf
              />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
