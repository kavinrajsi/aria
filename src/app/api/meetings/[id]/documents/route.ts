import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { id: meetingId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('documents')
    .select('id, file_name, file_type, uploaded_at')
    .eq('meeting_id', meetingId)
    .order('uploaded_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: Props) {
  const { id: meetingId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const isText =
    file.type === 'text/plain' ||
    file.type === 'text/markdown' ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.txt')

  if (!isText) {
    return NextResponse.json(
      { error: 'Only plain text (.txt) and markdown (.md) files are supported' },
      { status: 400 }
    )
  }

  // Extract text content; cap at 12 000 chars to keep prompts reasonable
  let contentText = await file.text()
  if (contentText.length > 12000) {
    contentText = contentText.slice(0, 12000) + '\n…[truncated]'
  }

  // Upload raw file to Supabase Storage
  const storageKey = `${meetingId}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('meeting-documents')
    .upload(storageKey, bytes, { contentType: file.type || 'text/plain' })

  if (uploadError) {
    console.error('[documents] storage upload:', uploadError.message)
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 })
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('meeting-documents').getPublicUrl(storageKey)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('documents') as any)
    .insert({
      meeting_id: meetingId,
      file_name: file.name,
      storage_url: publicUrl,
      file_type: file.type || 'text/plain',
      uploaded_by: user.id,
      content_text: contentText,
    })
    .select('id, file_name, file_type, uploaded_at')
    .single()

  if (error) {
    console.error('[documents] insert:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const { id: meetingId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const docId = searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId)
    .eq('meeting_id', meetingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
