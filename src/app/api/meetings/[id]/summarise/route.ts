import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

interface ExtractedActionItem {
  description: string
  assigned_to_name: string | null
}

interface SummaryPayload {
  summary: string
  key_decisions: string[]
  action_items: ExtractedActionItem[]
}

export async function POST(_req: NextRequest, { params }: Props) {
  const { id: meetingId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admin or organizer can generate summaries
  const [{ data: profile }, { data: meeting }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('meetings')
      .select(`
        id, title, status, ai_provider, agenda_items, briefing_notes, organizer_id,
        meeting_participants(user_id, profile:profiles(id, name))
      `)
      .eq('id', meetingId)
      .single(),
  ])

  if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
  if (meeting.status !== 'completed')
    return NextResponse.json({ error: 'Meeting must be completed first' }, { status: 409 })

  const isAdmin = profile?.role === 'admin'
  const isOrganizer = meeting.organizer_id === user.id
  if (!isAdmin && !isOrganizer)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Return existing summary if already generated
  const { data: existingSummary } = await supabase
    .from('meeting_summaries')
    .select('id, summary_text, key_decisions, generated_at')
    .eq('meeting_id', meetingId)
    .maybeSingle()

  if (existingSummary) {
    const { data: existingItems } = await supabase
      .from('action_items')
      .select('id, description, status, assigned_to, assignee:profiles!assigned_to(id, name)')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })

    return NextResponse.json({ summary: existingSummary, action_items: existingItems ?? [] })
  }

  // Fetch transcripts
  const { data: transcripts } = await supabase
    .from('transcripts')
    .select('speaker_label, content, timestamp_ms')
    .eq('meeting_id', meetingId)
    .order('timestamp_ms', { ascending: true })

  if (!transcripts?.length) {
    return NextResponse.json({ error: 'No transcript to summarise' }, { status: 422 })
  }

  // Resolve AI provider — use meeting's preferred, fall back to whatever is configured
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'OPENAI_API_KEY')
    .single()

  if (!setting?.value) return NextResponse.json({ error: 'No AI provider configured' }, { status: 503 })

  const model = createOpenAI({ apiKey: setting.value })('gpt-4o-mini')

  // Build transcript text (cap at 40 000 chars to stay within context)
  let transcriptText = transcripts
    .map((t) => {
      const mins = Math.floor(t.timestamp_ms / 60000)
      const secs = Math.floor((t.timestamp_ms % 60000) / 1000)
      const time = `${mins}:${secs.toString().padStart(2, '0')}`
      return `[${time}] ${t.speaker_label ?? 'Unknown'}: ${t.content}`
    })
    .join('\n')

  if (transcriptText.length > 40000) {
    transcriptText = transcriptText.slice(0, 40000) + '\n…[transcript truncated]'
  }

  // Build participant name list for assignee matching
  const participants = (meeting.meeting_participants ?? []).map((mp: {
    user_id: string
    profile: { id: string; name: string } | { id: string; name: string }[] | null
  }) => ({
    user_id: mp.user_id,
    name: (Array.isArray(mp.profile) ? mp.profile[0]?.name : mp.profile?.name) ?? '',
  }))

  const participantNames = participants.map((p: { name: string }) => p.name).filter(Boolean).join(', ')

  const prompt = `You are a meeting analyst. Analyse this meeting transcript and return ONLY valid JSON.

Return exactly this structure (no markdown, no code fences, just raw JSON):
{
  "summary": "2–3 sentences summarising what was discussed and decided",
  "key_decisions": ["Decision 1", "Decision 2"],
  "action_items": [
    {"description": "Specific task", "assigned_to_name": "Exact speaker name or null"}
  ]
}

Rules:
- key_decisions: only concrete decisions made, not topics discussed
- action_items: specific tasks; assigned_to_name must match a speaker name exactly, or null
- If no decisions or action items were found, return empty arrays

Meeting: ${meeting.title}
Participants: ${participantNames || 'Unknown'}
${meeting.agenda_items?.length ? `Agenda: ${meeting.agenda_items.join(', ')}` : ''}

Transcript:
${transcriptText}`

  let parsed: SummaryPayload
  try {
    const { text, usage } = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 1024,
    })

    // Fire-and-forget token logging
    supabase.from('token_usage').insert({
      meeting_id: meetingId,
      user_id: user.id,
      provider: 'openai',
      model: 'gpt-4o-mini',
      operation: 'summary',
      input_tokens: usage.inputTokens ?? 0,
      output_tokens: usage.outputTokens ?? 0,
    }).then(({ error }) => {
      if (error) console.error('[summarise] token_usage insert:', error.message)
    })

    // Strip any accidental markdown code fences
    const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim()
    parsed = JSON.parse(clean) as SummaryPayload
  } catch (err) {
    console.error('[summarise] AI or parse error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }

  // Resolve assignee names to user IDs
  function findParticipantId(name: string | null): string | null {
    if (!name) return null
    const lower = name.toLowerCase()
    const match = participants.find(
      (p: { name: string }) =>
        p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())
    )
    return (match as { user_id: string } | undefined)?.user_id ?? null
  }

  // Persist summary
  const { data: summary, error: summaryError } = await supabase
    .from('meeting_summaries')
    .insert({
      meeting_id: meetingId,
      summary_text: parsed.summary,
      key_decisions: parsed.key_decisions ?? [],
    })
    .select('id, summary_text, key_decisions, generated_at')
    .single()

  if (summaryError) {
    console.error('[summarise] insert summary:', summaryError.message)
    return NextResponse.json({ error: summaryError.message }, { status: 500 })
  }

  // Persist action items
  const actionItemRows = (parsed.action_items ?? []).map((item) => ({
    meeting_id: meetingId,
    description: item.description,
    assigned_to: findParticipantId(item.assigned_to_name),
    status: 'pending' as const,
  }))

  const { data: actionItems, error: itemsError } = actionItemRows.length
    ? await supabase
        .from('action_items')
        .insert(actionItemRows)
        .select('id, description, status, assigned_to, assignee:profiles!assigned_to(id, name)')
    : { data: [], error: null }

  if (itemsError) {
    console.error('[summarise] insert action_items:', itemsError.message)
  }

  return NextResponse.json({ summary, action_items: actionItems ?? [] })
}
