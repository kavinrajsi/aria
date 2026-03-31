'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

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

function speakerHue(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400/30 text-foreground rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

export function TranscriptReplay({ transcripts }: Props) {
  const [query, setQuery] = useState('')

  if (!transcripts.length) {
    return <p className="text-xs text-muted-foreground">No transcript recorded.</p>
  }

  const q = query.trim()
  const filtered = q
    ? transcripts.filter(
        (t) =>
          t.content.toLowerCase().includes(q.toLowerCase()) ||
          (t.speaker_label ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : transcripts

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcript…"
          className="pl-8 h-8 text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No results for &ldquo;{q}&rdquo;.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const speaker = t.speaker_label ?? 'Unknown'
            const hue = speakerHue(speaker)
            return (
              <div key={t.id} className="flex gap-2.5 text-xs">
                <span className="text-muted-foreground tabular-nums w-10 shrink-0 pt-0.5">
                  {formatMs(t.timestamp_ms)}
                </span>
                <div className="min-w-0">
                  <span className="font-medium mr-1.5" style={{ color: `hsl(${hue} 60% 55%)` }}>
                    {highlight(speaker, q)}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">
                    {highlight(t.content, q)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
