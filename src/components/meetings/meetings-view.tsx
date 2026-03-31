'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ChevronUp, ChevronDown, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MeetingCard } from './meeting-card'
import { MeetingStatusBadge } from './meeting-status-badge'
import type { MeetingWithOrganizer } from '@/lib/types/database'

type Meeting = MeetingWithOrganizer & { participant_count?: number }
type SortKey = 'title' | 'scheduled_at' | 'created_at' | 'status' | 'participant_count'
type SortDir = 'asc' | 'desc'

interface Props {
  meetings: Meeting[]
  isAdmin: boolean
}

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {active
        ? dir === 'asc'
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        : <ChevronDown className="h-3 w-3 opacity-30" />}
    </button>
  )
}

export function MeetingsView({ meetings, isAdmin }: Props) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Date and numeric columns default to newest/most first
      setSortDir(key === 'scheduled_at' || key === 'created_at' || key === 'participant_count' ? 'desc' : 'asc')
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? meetings.filter(
          (m) =>
            m.title.toLowerCase().includes(q) ||
            (m.organizer as { name: string } | null)?.name.toLowerCase().includes(q)
        )
      : meetings

    return [...base].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortKey === 'scheduled_at') cmp = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      else if (sortKey === 'created_at') cmp = new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortKey === 'participant_count') cmp = (a.participant_count ?? 0) - (b.participant_count ?? 0)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [meetings, query, sortKey, sortDir])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Meetings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? 'All meetings across your organisation' : 'Your scheduled meetings'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search meetings…"
              className="pl-8 h-8 text-xs w-52"
            />
          </div>
          <div className="flex items-center rounded-md border p-0.5 gap-0.5">
            <button
              onClick={() => setView('grid')}
              className={`rounded p-1.5 transition-colors ${view === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`rounded p-1.5 transition-colors ${view === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          {isAdmin && (
            <Button asChild size="sm">
              <Link href="/meetings/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New meeting
              </Link>
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No meetings match &ldquo;{query}&rdquo;.
        </p>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[1fr_160px_120px_100px] gap-4 px-4 py-2 bg-muted/40 border-b">
            <SortHeader label="Title" sortKey="title" current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Date" sortKey="scheduled_at" current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Participants" sortKey="participant_count" current={sortKey} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
          </div>
          <div className="divide-y">
            {filtered.map((meeting) => {
              const scheduledAt = new Date(meeting.scheduled_at)
              return (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="grid grid-cols-[1fr_160px_120px_100px] gap-4 px-4 py-3 hover:bg-accent/50 transition-colors items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{meeting.title}</p>
                    {meeting.organizer && (
                      <p className="text-xs text-muted-foreground truncate">
                        {(meeting.organizer as { name: string }).name}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p>{format(scheduledAt, 'MMM d, yyyy')}</p>
                    <p>{format(scheduledAt, 'h:mm a')}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {meeting.participant_count ?? 0}{' '}
                    {meeting.participant_count === 1 ? 'participant' : 'participants'}
                  </span>
                  <MeetingStatusBadge status={meeting.status} />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
