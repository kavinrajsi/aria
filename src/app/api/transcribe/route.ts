import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'OPENAI_API_KEY')
    .single()

  if (!setting?.value) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
  }

  const formData = await request.formData()
  const audio = formData.get('audio') as File | null
  const meetingId = formData.get('meetingId') as string | null
  const speakerLabel = formData.get('speakerLabel') as string | null
  const timestampMs = Number(formData.get('timestampMs') ?? 0)

  if (!audio || audio.size === 0) {
    return NextResponse.json({ text: '' })
  }

  const openai = new OpenAI({ apiKey: setting.value })

  const transcription = await openai.audio.transcriptions.create({
    file: audio,
    model: 'whisper-1',
    language: 'en',
  })

  const text = transcription.text.trim()

  // Persist to DB server-side so Realtime fires for all participants
  let transcriptId: string | null = null
  if (text && meetingId && speakerLabel) {
    const { data, error } = await supabase
      .from('transcripts')
      .insert({
        meeting_id: meetingId,
        content: text,
        speaker_label: speakerLabel,
        user_id: user.id,
        timestamp_ms: timestampMs,
      })
      .select('id')
      .single()

    if (error) console.error('[transcribe] db insert failed:', error.message)
    else transcriptId = data?.id ?? null
  }

  return NextResponse.json({ text, transcriptId })
}
