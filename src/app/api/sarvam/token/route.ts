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
    .eq('key', 'SARVAM_API_KEY')
    .single()

  if (settingError || !setting?.value) {
    return NextResponse.json({ error: 'Sarvam API key not configured' }, { status: 503 })
  }

  return NextResponse.json({ token: setting.value })
}
