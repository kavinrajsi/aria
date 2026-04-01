'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { ActionItemWithAssignee } from '@/lib/types/database'

interface ActionItemsTableProps {
  items: ActionItemWithAssignee[]
  currentUserId: string
  isAdmin: boolean
}

export function ActionItemsTable({ items, currentUserId, isAdmin }: ActionItemsTableProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function toggleStatus(item: ActionItemWithAssignee) {
    if (item.assigned_to !== currentUserId && !isAdmin) return
    setTogglingId(item.id)
    const supabase = createClient()
    const newStatus = item.status === 'pending' ? 'complete' : 'pending'
    const { error } = await supabase
      .from('action_items')
      .update({
        status: newStatus,
        completed_at: newStatus === 'complete' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)

    setTogglingId(null)
    if (error) {
      toast.error('Failed to update item')
      return
    }
    toast.success(newStatus === 'complete' ? 'Marked complete' : 'Reopened')
    startTransition(() => router.refresh())
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Task</TableHead>
            {isAdmin && <TableHead>Assigned to</TableHead>}
            <TableHead>Meeting</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const canToggle = item.assigned_to === currentUserId || isAdmin
            const initials = item.assignee?.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <TableRow key={item.id} className="group">
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!canToggle || togglingId === item.id}
                    onClick={() => toggleStatus(item)}
                  >
                    {item.status === 'complete' ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TableCell>
                <TableCell>
                  <p
                    className={
                      item.status === 'complete'
                        ? 'line-through text-muted-foreground text-sm'
                        : 'text-sm'
                    }
                  >
                    {item.description}
                  </p>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {item.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{item.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {item.meeting ? (
                    <Link
                      href={`/meetings/${item.meeting.id}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {item.meeting.title}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={item.status === 'complete' ? 'outline' : 'secondary'}
                    className="capitalize"
                  >
                    {item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {format(new Date(item.created_at), 'MMM d')}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
