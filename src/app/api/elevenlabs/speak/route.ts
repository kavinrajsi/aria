import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Default to "Rachel" voice — natural, clear, well-suited for AI assistants
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { text } = (await req.json()) as { text: string }
  if (!text?.trim()) return new Response('text is required', { status: 400 })

  const { data: setting, error: settingError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'ELEVENLABS_API_KEY')
    .single()

  if (settingError || !setting?.value) {
    return new Response('ElevenLabs API key not configured', { status: 503 })
  }

  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': setting.value,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  )

  if (!ttsRes.ok) {
    const body = await ttsRes.text()
    console.error('[elevenlabs/speak]', ttsRes.status, body)
    return new Response('TTS request failed', { status: 502 })
  }

  return new Response(ttsRes.body, {
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}
