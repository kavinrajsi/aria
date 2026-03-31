'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function renameMeeting(
  meetingId: string,
  title: string
): Promise<{ error?: string }> {
  const trimmed = title.trim()
  if (!trimmed) return { error: 'Title cannot be empty' }
  if (trimmed.length > 200) return { error: 'Title too long' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const [{ data: meeting }, { data: profile }] = await Promise.all([
    supabase.from('meetings').select('organizer_id').eq('id', meetingId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!meeting) return { error: 'Meeting not found' }

  const isAdmin = profile?.role === 'admin'
  const isOrganizer = meeting.organizer_id === user.id
  if (!isAdmin && !isOrganizer) return { error: 'Only the organiser or an admin can rename this meeting' }

  const { error } = await supabase
    .from('meetings')
    .update({ title: trimmed })
    .eq('id', meetingId)

  if (error) return { error: error.message }

  revalidatePath(`/meetings/${meetingId}`)
  return {}
}
