import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { MeetingCard } from '@/components/meetings/meeting-card'

export const metadata: Metadata = { title: 'Meetings' }

export default async function MeetingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Admins see all meetings; participants see only theirs
  const query = supabase
    .from('meetings')
    .select(`
      *,
      organizer:profiles!organizer_id(id, name, email),
      participant_count:meeting_participants(count)
    `)
    .order('scheduled_at', { ascending: false })

  if (!isAdmin) {
    const { data: participations } = await supabase
      .from('meeting_participants')
      .select('meeting_id')
      .eq('user_id', user!.id)
    const meetingIds = participations?.map((p) => p.meeting_id) ?? []
    if (meetingIds.length === 0) {
      return (
        <div className="p-6">
          <PageHeader isAdmin={isAdmin} />
          <EmptyState isAdmin={isAdmin} />
        </div>
      )
    }
    query.in('id', meetingIds)
  }

  const { data: meetings } = await query

  const formattedMeetings = (meetings ?? []).map((m) => ({
    ...m,
    organizer: Array.isArray(m.organizer) ? m.organizer[0] ?? null : m.organizer,
    participant_count: Array.isArray(m.participant_count)
      ? (m.participant_count[0] as { count: number } | undefined)?.count ?? 0
      : 0,
  }))

  return (
    <div className="p-6 space-y-6">
      <PageHeader isAdmin={isAdmin} />

      {formattedMeetings.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formattedMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  )
}

function PageHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Meetings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? 'All meetings across your organisation' : 'Your scheduled meetings'}
        </p>
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
  )
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <p className="text-sm font-medium">No meetings yet</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        {isAdmin
          ? 'Create your first meeting to get started.'
          : "You haven't been added to any meetings yet."}
      </p>
      {isAdmin && (
        <Button asChild size="sm">
          <Link href="/meetings/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New meeting
          </Link>
        </Button>
      )}
    </div>
  )
}
