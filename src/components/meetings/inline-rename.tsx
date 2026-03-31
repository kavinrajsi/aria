'use client'

import { useRef, useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { renameMeeting } from '@/lib/actions/meetings'

interface InlineRenameProps {
  meetingId: string
  initialTitle: string
  canEdit: boolean
  className?: string
}

export function InlineRename({ meetingId, initialTitle, canEdit, className }: InlineRenameProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [draft, setDraft] = useState(initialTitle)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function startEditing() {
    setDraft(title)
    setEditing(true)
    // Focus after render
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function cancel() {
    setEditing(false)
    setDraft(title)
  }

  function save() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === title) {
      cancel()
      return
    }
    startTransition(async () => {
      const result = await renameMeeting(meetingId, trimmed)
      if (result.error) {
        toast.error(result.error)
      } else {
        setTitle(trimmed)
        toast.success('Meeting renamed')
      }
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save() }
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
        }}
        disabled={isPending}
        className={cn(
          'bg-transparent border-b border-foreground/30 focus:border-foreground outline-none',
          'font-semibold leading-tight w-full max-w-sm',
          className
        )}
        autoFocus
      />
    )
  }

  if (!canEdit) {
    return <span className={className}>{title}</span>
  }

  return (
    <button
      onClick={startEditing}
      className={cn(
        'group inline-flex items-center gap-1.5 text-left',
        'hover:opacity-80 transition-opacity',
        className
      )}
    >
      <span>{title}</span>
      <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </button>
  )
}
