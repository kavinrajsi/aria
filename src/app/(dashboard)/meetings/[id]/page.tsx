import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Pencil,
  Play,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MeetingStatusBadge } from '@/components/meetings/meeting-status-badge'
import { StartMeetingButton } from '@/components/meetings/start-meeting-button'
import { DocumentUpload } from '@/components/meetings/document-upload'
import { MeetingSummary } from '@/components/meetings/meeting-summary'
import { TranscriptReplay } from '@/components/meetings/transcript-replay'
import { InlineRename } from '@/components/meetings/inline-rename'

export const metadata: Metadata = { title: 'Meeting' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function MeetingDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: meeting } = await supabase
    .from('meetings')
    .select(`
      *,
      organizer:profiles!organizer_id(id, name, email),
      meeting_participants(
        id,
        user_id,
        profile:profiles(id, name, email)
      )
    `)
    .eq('id', id)
    .single()

  if (!meeting) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const isOrganizer = meeting.organizer_id === user.id
  const canEdit = isAdmin || isOrganizer

  const isCompleted = meeting.status === 'completed'

  const [
    { data: providerSettings },
    { data: documents },
    { data: existingSummary },
    { data: meetingActionItems },
    { data: replayTranscripts },
  ] = await Promise.all([
    supabase.from('settings').select('key').in('key', ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']),
    supabase
      .from('documents')
      .select('id, file_name, file_type, uploaded_at')
      .eq('meeting_id', id)
      .order('uploaded_at', { ascending: true }),
    isCompleted
      ? supabase
          .from('meeting_summaries')
          .select('id, summary_text, key_decisions, generated_at')
          .eq('meeting_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    isCompleted
      ? supabase
          .from('action_items')
          .select('id, description, status, assigned_to, assignee:profiles!assigned_to(id, name)')
          .eq('meeting_id', id)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    isCompleted
      ? supabase
          .from('transcripts')
          .select('id, speaker_label, content, timestamp_ms')
          .eq('meeting_id', id)
          .order('timestamp_ms', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  const configuredKeys = new Set((providerSettings ?? []).map((r: { key: string }) => r.key))
  const availableProviders = {
    anthropic: configuredKeys.has('ANTHROPIC_API_KEY'),
    openai: configuredKeys.has('OPENAI_API_KEY'),
  }

  const organizer = Array.isArray(meeting.organizer)
    ? meeting.organizer[0] ?? null
    : meeting.organizer

  const participants = (meeting.meeting_participants ?? []).map((mp: {
    id: string
    user_id: string
    profile: { id: string; name: string; email: string } | { id: string; name: string; email: string }[] | null
  }) => ({
    ...mp,
    profile: Array.isArray(mp.profile) ? mp.profile[0] ?? null : mp.profile,
  }))

  const scheduledAt = new Date(meeting.scheduled_at)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Meetings
          </Link>
          <div className="flex items-center gap-3">
            <InlineRename
              meetingId={id}
              initialTitle={meeting.title}
              canEdit={canEdit}
              className="text-xl font-semibold"
            />
            <MeetingStatusBadge status={meeting.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && meeting.status === 'scheduled' && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/meetings/${id}/edit`}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
              <StartMeetingButton meetingId={id} availableProviders={availableProviders} />
            </>
          )}
          {meeting.status === 'active' && (
            <Button size="sm" asChild>
              <Link href={`/meeting/${id}`}>
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Join live
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Summary — only for completed meetings */}
          {isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="h-4 w-4 text-muted-foreground">✦</span>
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MeetingSummary
                  meetingId={id}
                  canGenerate={canEdit}
                  initialSummary={existingSummary ?? null}
                  initialActionItems={meetingActionItems ?? []}
                />
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{format(scheduledAt, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{format(scheduledAt, 'h:mm a')}</span>
              </div>
              {organizer && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    Organised by{' '}
                    <span className="font-medium">{organizer.name}</span>
                  </span>
                </div>
              )}
              {participants.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">
                      Participants ({participants.length})
                    </p>
                    {participants.map((mp: {
                      id: string
                      user_id: string
                      profile: { id: string; name: string; email: string } | null
                    }) => {
                      const p = mp.profile
                      if (!p) return null
                      const initials = p.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                      return (
                        <div key={mp.id} className="flex items-center gap-2.5">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate flex-1">{p.name}</span>
                          {organizer?.id === p.id && (
                            <span className="text-xs text-muted-foreground shrink-0">Organiser</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Agenda */}
          {meeting.agenda_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Agenda</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {meeting.agenda_items.map((item: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground tabular-nums w-5 shrink-0">
                        {i + 1}.
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Briefing notes */}
          {meeting.briefing_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Briefing notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {meeting.briefing_notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Documents — pre-meeting reference files for Aria */}
          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentUpload
                  meetingId={id}
                  initialDocuments={documents ?? []}
                  readOnly={isCompleted}
                />
              </CardContent>
            </Card>
          )}

        </div>

        {/* Right sidebar */}
        <div className="md:col-span-3 space-y-6">
          {/* Transcript replay — only for completed meetings */}
          {isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <TranscriptReplay transcripts={replayTranscripts ?? []} />
              </CardContent>
            </Card>
          )}
          {canEdit && meeting.status === 'scheduled' && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href={`/meetings/${id}/edit`}>Manage participants</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
