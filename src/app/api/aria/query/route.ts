import { NextRequest } from 'next/server'
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { meetingId, query, context } = (await req.json()) as {
    meetingId: string
    query: string
    context?: string
  }

  if (!meetingId || !query?.trim()) {
    return new Response('meetingId and query are required', { status: 400 })
  }

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, title, ai_provider, agenda_items, briefing_notes')
    .eq('id', meetingId)
    .single()

  if (meetingError || !meeting) return new Response('Meeting not found', { status: 404 })

  const { data: setting, error: settingError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'OPENAI_API_KEY')
    .single()

  if (settingError || !setting?.value) return new Response('AI provider not configured', { status: 503 })

  // Fetch uploaded documents with extracted text for context injection
  const { data: documents } = await supabase
    .from('documents')
    .select('file_name, content_text')
    .eq('meeting_id', meetingId)
    .not('content_text', 'is', null)

  // Record the interaction — response filled in after streaming
  const { data: interaction } = await supabase
    .from('aria_interactions')
    .insert({
      meeting_id: meetingId,
      triggered_by: user.id,
      query_text: query.trim(),
      timestamp_ms: Date.now(),
    })
    .select('id')
    .single()

  const systemPrompt = [
    `You are Aria, an AI meeting assistant. You are live in a meeting titled "${meeting.title}".`,
    meeting.agenda_items?.length
      ? `Agenda: ${meeting.agenda_items.join(' • ')}`
      : null,
    meeting.briefing_notes ? `Background: ${meeting.briefing_notes}` : null,
    documents?.length
      ? `Reference documents:\n${documents.map((d) => `**${d.file_name}**:\n${d.content_text}`).join('\n\n')}`
      : null,
    context ? `Recent transcript:\n${context}` : null,
    'Answer concisely. You are speaking in a live meeting — be direct and useful.',
  ]
    .filter(Boolean)
    .join('\n\n')

  const model = createOpenAI({ apiKey: setting.value })('gpt-4o-mini')

  const result = streamText({
    model,
    system: systemPrompt,
    messages: [{ role: 'user', content: query }],
    maxOutputTokens: 512,
    onFinish: async ({ text, usage }) => {
      await Promise.all([
        interaction?.id
          ? supabase
              .from('aria_interactions')
              .update({ response_text: text })
              .eq('id', interaction.id)
              .then(({ error }) => {
                if (error) console.error('[aria/query] failed to save response:', error.message)
              })
          : Promise.resolve(),
        supabase.from('token_usage').insert({
          meeting_id: meetingId,
          user_id: user.id,
          provider: 'openai',
          model: 'gpt-4o-mini',
          operation: 'aria_query',
          input_tokens: usage.promptTokens ?? 0,
          output_tokens: usage.completionTokens ?? 0,
        }),
      ])
    },
  })

  return result.toTextStreamResponse()
}
