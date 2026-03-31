import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Profile } from '@/lib/types/database'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { MeetingForm } from '@/components/meetings/meeting-form'

export const metadata: Metadata = { title: 'New meeting' }

export default async function NewMeetingPage() {
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

  // Load all team members for participant selection
  const { data: participants } = await supabase
    .from('profiles')
    .select('*')
    .order('name')

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-3 w-3" />
        Meetings
      </Link>
      <h1 className="text-xl font-semibold mb-6">New meeting</h1>
      <MeetingForm
        participants={participants ?? []}
        organizerId={user.id}
      />
    </div>
  )
}
