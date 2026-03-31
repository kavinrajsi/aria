'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function changeParticipantRole(
  userId: string,
  role: 'admin' | 'member'
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin') return { error: 'Unauthorized' }
  if (userId === user.id) return { error: 'You cannot change your own role' }

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/participants')
  return {}
}
