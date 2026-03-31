import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Live meeting room — implemented in Phase 2
// This stub ensures the route exists and access is gated.

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

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, title, status')
    .eq('id', id)
    .single()

  if (!meeting) notFound()
  if (meeting.status !== 'active') redirect(`/meetings/${id}`)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
        <span className="text-2xl font-bold text-primary-foreground">A</span>
      </div>
      <h1 className="text-2xl font-semibold">{meeting.title}</h1>
      <p className="text-muted-foreground max-w-sm">
        The live meeting room is coming in Phase 2. Aria will listen, transcribe,
        and respond to your team here.
      </p>
    </div>
  )
}
