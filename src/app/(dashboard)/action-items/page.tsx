import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { Profile } from '@/lib/types/database'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { ActionItemsTable } from '@/components/action-items/action-items-table'

export const metadata: Metadata = { title: 'Action Items' }

export default async function ActionItemsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const query = supabase
    .from('action_items')
    .select(`
      *,
      assignee:profiles!assigned_to(id, name, email),
      meeting:meetings!meeting_id(id, title)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query.eq('assigned_to', user.id)
  }

  const { data: items } = await query

  const formatted = (items ?? []).map((item) => ({
    ...item,
    assignee: Array.isArray(item.assignee) ? item.assignee[0] ?? null : item.assignee,
    meeting: Array.isArray(item.meeting) ? item.meeting[0] ?? null : item.meeting,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Action Items</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? 'All pending tasks across your organisation' : 'Your assigned tasks'}
        </p>
      </div>

      {formatted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No action items yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Action items will appear here after meetings are completed.
          </p>
        </div>
      ) : (
        <ActionItemsTable items={formatted} currentUserId={user.id} isAdmin={isAdmin} />
      )}
    </div>
  )
}
