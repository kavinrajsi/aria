import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EnrollmentWizard } from '@/components/voice-enrollment/enrollment-wizard'

export const metadata: Metadata = { title: 'Voice Enrollment' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EnrollPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') redirect('/meetings')

  const { data: participant } = await supabase
    .from('profiles')
    .select('*, voice_profiles(*)')
    .eq('id', id)
    .single()

  if (!participant) notFound()

  const voiceProfile = Array.isArray(participant.voice_profiles)
    ? participant.voice_profiles[0] ?? null
    : participant.voice_profiles

  return (
    <div className="p-6 max-w-xl mx-auto">
      <Link
        href="/participants"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Participants
      </Link>
      <h1 className="text-xl font-semibold mb-1">Voice Enrollment</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Record voice samples for{' '}
        <span className="text-foreground font-medium">{participant.name}</span> so Aria
        can identify them during meetings.
      </p>
      <EnrollmentWizard
        participantId={id}
        participantName={participant.name}
        voiceProfileId={voiceProfile?.id ?? null}
        currentSamples={voiceProfile?.samples_count ?? 0}
      />
    </div>
  )
}
