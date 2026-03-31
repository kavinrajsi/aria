import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/meetings/meeting-form'

export const metadata: Metadata = { title: 'Edit meeting' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditMeetingPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*, meeting_participants(user_id)')
    .eq('id', id)
    .single()

  if (!meeting) notFound()

  const isAdmin = profile?.role === 'admin'
  const isOrganizer = meeting.organizer_id === user.id
  if (!isAdmin && !isOrganizer) redirect(`/meetings/${id}`)

  const { data: participants } = await supabase
    .from('profiles')
    .select('*')
    .order('name')

  const scheduledAt = new Date(meeting.scheduled_at)
  const defaultValues = {
    title: meeting.title,
    date: scheduledAt,
    time: `${String(scheduledAt.getHours()).padStart(2, '0')}:${String(scheduledAt.getMinutes()).padStart(2, '0')}`,
    agenda_items: meeting.agenda_items.map((v: string) => ({ value: v })),
    briefing_notes: meeting.briefing_notes ?? '',
    participant_ids: (meeting.meeting_participants ?? []).map(
      (mp: { user_id: string }) => mp.user_id
    ),
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href={`/meetings/${id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to meeting
      </Link>
      <h1 className="text-xl font-semibold mb-6">Edit meeting</h1>
      <MeetingForm
        participants={participants ?? []}
        organizerId={user.id}
        meetingId={id}
        defaultValues={defaultValues}
      />
    </div>
  )
}
