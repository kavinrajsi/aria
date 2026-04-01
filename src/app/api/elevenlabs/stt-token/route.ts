import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: setting, error: settingError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'ELEVENLABS_API_KEY')
    .single()

  if (settingError || !setting?.value) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 503 })
  }

  // Generate a single-use ephemeral token for browser WebSocket auth
  const res = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
    method: 'POST',
    headers: { 'xi-api-key': setting.value },
  })

  if (!res.ok) {
    console.error('[elevenlabs/stt-token]', res.status, await res.text())
    return NextResponse.json({ error: 'Failed to create ElevenLabs token' }, { status: 502 })
  }

  const { token } = await res.json()
  return NextResponse.json({ token })
}
