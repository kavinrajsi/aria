import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check meeting exists and user is participant/organizer
  const { data: meeting } = await supabase
    .from('meetings')
    .select('organizer_id, status')
    .eq('id', id)
    .single()

  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('audio') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
  }

  const ext = file.type.includes('ogg') ? 'ogg' : 'webm'
  const path = `${id}/${Date.now()}.${ext}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('meeting-recordings')
    .upload(path, file, { contentType: file.type || 'audio/webm', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Save record in audio_recordings table
  const { error: dbError } = await supabase
    .from('audio_recordings')
    .insert({
      meeting_id: id,
      storage_url: path,
      file_size_bytes: file.size,
    })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path })
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: recordings } = await supabase
    .from('audio_recordings')
    .select('id, storage_url, duration_seconds, file_size_bytes, created_at')
    .eq('meeting_id', id)
    .order('created_at', { ascending: false })

  if (!recordings?.length) return NextResponse.json({ recordings: [] })

  // Generate short-lived signed URLs (1 hour)
  const withUrls = await Promise.all(
    recordings.map(async (r) => {
      const { data } = await supabase.storage
        .from('meeting-recordings')
        .createSignedUrl(r.storage_url, 3600)
      return { ...r, signedUrl: data?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ recordings: withUrls })
}
