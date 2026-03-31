import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MeetingRoom } from '@/components/meeting-room/meeting-room'

interface Props {
  params: Promise<{ id: string }>
}

export default async function MeetingRoomPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const [{ data: meeting }, { data: profile }, { data: transcripts }, { data: elevenLabsSetting }] =
    await Promise.all([
      supabase
        .from('meetings')
        .select('id, title, status, ai_provider, agenda_items, briefing_notes')
        .eq('id', id)
        .single(),
      supabase.from('profiles').select('id, name').eq('id', user.id).single(),
      supabase
        .from('transcripts')
        .select('id, speaker_label, content, timestamp_ms')
        .eq('meeting_id', id)
        .order('timestamp_ms', { ascending: true }),
      supabase.from('settings').select('key').eq('key', 'ELEVENLABS_API_KEY').maybeSingle(),
    ])

  if (!meeting) notFound()
  if (meeting.status !== 'active') redirect(`/meetings/${id}`)
  if (!profile) redirect('/sign-in')

  return (
    <MeetingRoom
      meeting={meeting}
      currentUser={profile}
      initialTranscripts={transcripts ?? []}
      hasElevenLabsKey={!!elevenLabsSetting}
    />
  )
}
