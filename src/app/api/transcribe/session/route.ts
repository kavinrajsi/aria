import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Creates an ephemeral OpenAI Realtime API token for browser WebSocket auth.
// Tokens expire after 60 seconds — the client connects immediately after receiving one.
export async function GET() {
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

  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${setting.value}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'gpt-4o-realtime-preview-2024-12-17' }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[transcribe/session]', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 502 })
  }

  const session = await res.json()
  return NextResponse.json({ token: session.client_secret?.value ?? null })
}
