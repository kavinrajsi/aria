'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Transcript {
  id: string
  speaker_label: string | null
  content: string
  timestamp_ms: number
}

interface Props {
  transcripts: Transcript[]
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Stable hue from a speaker name so each person gets a consistent colour
function speakerHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

export function TranscriptReplay({ transcripts }: Props) {
  const [open, setOpen] = useState(false)

  if (!transcripts.length) {
    return <p className="text-xs text-muted-foreground">No transcript recorded.</p>
  }

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between text-xs text-muted-foreground hover:text-foreground -mx-1 px-1"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{transcripts.length} transcript segments</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </Button>

      {open && (
        <ScrollArea className="h-72">
          <div className="space-y-2 pr-2">
            {transcripts.map((t) => {
              const speaker = t.speaker_label ?? 'Unknown'
              const hue = speakerHue(speaker)
              return (
                <div key={t.id} className="flex gap-2.5 text-xs">
                  <span className="text-muted-foreground tabular-nums w-10 shrink-0 pt-0.5">
                    {formatMs(t.timestamp_ms)}
                  </span>
                  <div className="min-w-0">
                    <span
                      className="font-medium mr-1.5"
                      style={{ color: `hsl(${hue} 60% 55%)` }}
                    >
                      {speaker}
                    </span>
                    <span className="text-muted-foreground leading-relaxed">{t.content}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
