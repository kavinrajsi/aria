'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TranscriptReplay } from './transcript-replay'
import { MeetingSummary } from './meeting-summary'

interface Transcript {
  id: string
  speaker_label: string | null
  content: string
  timestamp_ms: number
}

interface Summary {
  id: string
  summary_text: string | null
  key_decisions: string[]
  generated_at: string
}

interface ActionItem {
  id: string
  description: string
  status: 'pending' | 'complete'
  assigned_to: string | null
  assignee: { id: string; name: string } | { id: string; name: string }[] | null
}

interface Props {
  transcripts: Transcript[]
  meetingId: string
  canGenerate: boolean
  initialSummary: Summary | null
  initialActionItems: ActionItem[]
}

export function TranscriptCard({
  transcripts,
  meetingId,
  canGenerate,
  initialSummary,
  initialActionItems,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Transcript</CardTitle>
            <button
              onClick={() => setOpen(true)}
              className="text-lg leading-none text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Open summary"
              title="Summary & Action Items"
            >
              ✦
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <TranscriptReplay transcripts={transcripts} />
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <span className="text-base">✦</span>
              Summary &amp; Action Items
            </SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <MeetingSummary
              meetingId={meetingId}
              canGenerate={canGenerate}
              initialSummary={initialSummary}
              initialActionItems={initialActionItems}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
