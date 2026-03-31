import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { status } = (await req.json()) as { status: 'pending' | 'complete' }
  if (status !== 'pending' && status !== 'complete') {
    return NextResponse.json({ error: 'status must be pending or complete' }, { status: 400 })
  }

  // Verify the user is assigned to this item or is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: item } = await supabase
    .from('action_items')
    .select('id, assigned_to')
    .eq('id', id)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = profile?.role === 'admin'
  const isAssignee = item.assigned_to === user.id
  if (!isAdmin && !isAssignee) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('action_items')
    .update({
      status,
      completed_at: status === 'complete' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id, status, completed_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
