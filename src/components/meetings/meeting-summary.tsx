'use client'

import { useState, useTransition } from 'react'
import { Sparkles, CheckCircle2, Circle, Loader2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

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
  meetingId: string
  canGenerate: boolean
  initialSummary: Summary | null
  initialActionItems: ActionItem[]
}

export function MeetingSummary({
  meetingId,
  canGenerate,
  initialSummary,
  initialActionItems,
}: Props) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary)
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialActionItems)
  const [generating, startGenerating] = useTransition()

  function generate() {
    startGenerating(async () => {
      const res = await fetch(`/api/meetings/${meetingId}/summarise`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Failed to generate summary')
        return
      }
      const data = await res.json()
      setSummary(data.summary)
      setActionItems(data.action_items ?? [])
      toast.success('Summary generated')
    })
  }

  async function toggleStatus(item: ActionItem) {
    const next: 'pending' | 'complete' = item.status === 'pending' ? 'complete' : 'pending'
    setActionItems((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, status: next } : a))
    )

    const res = await fetch(`/api/action-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })

    if (!res.ok) {
      // Revert on failure
      setActionItems((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: item.status } : a))
      )
      toast.error('Failed to update status')
    }
  }

  // No summary yet
  if (!summary) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
        <Sparkles className="h-6 w-6 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No summary yet</p>
        {canGenerate && (
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {generating ? 'Generating…' : 'Generate summary'}
          </Button>
        )}
      </div>
    )
  }

  const pendingCount = actionItems.filter((a) => a.status === 'pending').length

  return (
    <div className="space-y-4">
      {/* Summary text */}
      {summary.summary_text && (
        <p className="text-sm leading-relaxed">{summary.summary_text}</p>
      )}

      {/* Key decisions */}
      {summary.key_decisions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Key decisions
          </p>
          <ul className="space-y-1.5">
            {summary.key_decisions.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Action items
              </p>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {pendingCount} pending
                </Badge>
              )}
            </div>
            <ul className="space-y-2">
              {actionItems.map((item) => {
                const assignee = Array.isArray(item.assignee)
                  ? item.assignee[0] ?? null
                  : item.assignee
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 cursor-pointer group"
                    onClick={() => toggleStatus(item)}
                  >
                    {item.status === 'complete' ? (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          item.status === 'complete' && 'line-through text-muted-foreground'
                        )}
                      >
                        {item.description}
                      </p>
                      {assignee && (
                        <p className="text-xs text-muted-foreground mt-0.5">{assignee.name}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
