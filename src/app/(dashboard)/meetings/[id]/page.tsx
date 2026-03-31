import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Mic,
  Pencil,
  Play,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MeetingStatusBadge } from '@/components/meetings/meeting-status-badge'
import { StartMeetingButton } from '@/components/meetings/start-meeting-button'
import { DocumentUpload } from '@/components/meetings/document-upload'
import { TranscriptCard } from '@/components/meetings/transcript-card'
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
    { data: recordingRows },
  ] = await Promise.all([
    // Only fetch provider settings for users who can start/edit the meeting
    canEdit
      ? supabase.from('settings').select('key').eq('key', 'OPENAI_API_KEY')
      : Promise.resolve({ data: [], error: null }),
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
    isCompleted
      ? supabase
          .from('audio_recordings')
          .select('id, storage_url, duration_seconds, file_size_bytes, created_at')
          .eq('meeting_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Generate a 1-hour signed URL for the latest recording
  let recordingSignedUrl: string | null = null
  const latestRecording = recordingRows?.[0] ?? null
  if (latestRecording) {
    const { data: signed } = await supabase.storage
      .from('meeting-recordings')
      .createSignedUrl(latestRecording.storage_url, 3600)
    recordingSignedUrl = signed?.signedUrl ?? null
  }

  const availableProviders = {
    openai: (providerSettings ?? []).length > 0,
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

  // App-layer authorization: user must be admin, organizer, or a participant
  const isParticipant = participants.some((mp) => mp.user_id === user.id)
  if (!isAdmin && !isOrganizer && !isParticipant) notFound()

  const scheduledAt = new Date(meeting.scheduled_at)

  return (
    <div className="p-6 space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4 w-full">
        <div className="space-y-1 flex-1 min-w-0">
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
          <div className="flex flex-col gap-0.5 mt-1">
            {/* Line 1: date · time · organised by */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{format(scheduledAt, 'EEEE, MMMM d, yyyy')}</span>
              <span>·</span>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{format(scheduledAt, 'h:mm a')}</span>
              {organizer && (
                <>
                  <span>·</span>
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>Organised by <span className="font-medium text-foreground">{organizer.name}</span></span>
                </>
              )}
            </div>
            {/* Line 2: participants · documents */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex -space-x-1.5">
                {participants.slice(0, 4).map((mp: {
                  id: string
                  user_id: string
                  profile: { id: string; name: string; email: string } | null
                }) => {
                  const p = mp.profile
                  if (!p) return null
                  const initials = p.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                  return (
                    <Avatar key={mp.id} className="h-4 w-4 border border-background">
                      <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                    </Avatar>
                  )
                })}
              </span>
              <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {documents && documents.length > 0 ? (
                <span>{documents.map(d => d.file_name).join(', ')}</span>
              ) : (
                <span>0 documents</span>
              )}
            </div>
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

          {/* Documents — upload UI for pre-meeting reference files */}
          {canEdit && !isCompleted && (
            <DocumentUpload
              meetingId={id}
              initialDocuments={documents ?? []}
              readOnly={false}
            />
          )}

        </div>

        {canEdit && meeting.status === 'scheduled' && (
          <div className="md:col-span-3 flex items-start">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/meetings/${id}/edit`}>Manage participants</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Recording player — full width */}
      {isCompleted && recordingSignedUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              Recording
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              controls
              src={recordingSignedUrl}
              className="w-full h-10"
              preload="metadata"
            />
            {latestRecording?.file_size_bytes && (
              <p className="text-xs text-muted-foreground mt-2">
                {(latestRecording.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                {latestRecording.duration_seconds
                  ? ` · ${Math.floor(latestRecording.duration_seconds / 60)}m ${latestRecording.duration_seconds % 60}s`
                  : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcript — full width */}
      {isCompleted && (
        <TranscriptCard
          transcripts={replayTranscripts ?? []}
          meetingId={id}
          canGenerate={canEdit}
          initialSummary={existingSummary ?? null}
          initialActionItems={meetingActionItems ?? []}
        />
      )}
    </div>
  )
}
