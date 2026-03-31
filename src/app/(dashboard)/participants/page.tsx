import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Profile } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/server'
import { ParticipantsTable } from '@/components/participants/participants-table'

export const metadata: Metadata = { title: 'Participants' }

export default async function ParticipantsPage() {
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

  if (profile?.role !== 'admin') redirect('/meetings')

  const { data: participants } = await supabase
    .from('profiles')
    .select(`
      *,
      voice_profile:voice_profiles(enrollment_status, samples_count)
    `)
    .order('name')

  const formatted = (participants ?? []).map((p) => ({
    ...p,
    voice_profile: Array.isArray(p.voice_profile)
      ? p.voice_profile[0] ?? null
      : p.voice_profile,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Participants</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Team members and their voice enrollment status.
        </p>
      </div>
      <ParticipantsTable participants={formatted} currentUserId={user.id} isAdmin />
    </div>
  )
}
