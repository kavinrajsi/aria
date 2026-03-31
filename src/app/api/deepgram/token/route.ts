import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns the Deepgram API key to authenticated browser clients.
// This is acceptable for an internal-only app where every user is authenticated.
// The key is transmitted over HTTPS and only to verified session holders.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: setting, error: settingError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'DEEPGRAM_API_KEY')
    .single()

  if (settingError || !setting?.value) {
    return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 503 })
  }

  return NextResponse.json({ token: setting.value })
}
