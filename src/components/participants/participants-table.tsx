'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { format } from 'date-fns'
import { Mic, MicOff, Shield, User } from 'lucide-react'
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
import type { Profile, VoiceProfile } from '@/lib/types/database'
import { changeParticipantRole } from '@/lib/actions/participants'

type ParticipantWithVoice = Profile & {
  voice_profile: Pick<VoiceProfile, 'enrollment_status' | 'samples_count'> | null
}

const enrollmentConfig: Record<
  VoiceProfile['enrollment_status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Not enrolled', variant: 'outline' },
  in_progress: { label: 'In progress', variant: 'secondary' },
  enrolled: { label: 'Enrolled', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
}

interface ParticipantsTableProps {
  participants: ParticipantWithVoice[]
  currentUserId: string
  isAdmin: boolean
}

export function ParticipantsTable({ participants, currentUserId, isAdmin }: ParticipantsTableProps) {
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    startTransition(async () => {
      const result = await changeParticipantRole(userId, newRole)
      if (result.error) toast.error(result.error)
      else toast.success(`Role updated to ${newRole}.`)
    })
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Voice enrollment</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p) => {
            const initials = p.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            const enrollment = p.voice_profile
              ? enrollmentConfig[p.voice_profile.enrollment_status]
              : enrollmentConfig.pending

            const isCurrentUser = p.id === currentUserId

            return (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {p.name}
                      {isCurrentUser && (
                        <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.role === 'admin' ? (
                        <Shield className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                      <span className="capitalize">{p.role}</span>
                    </div>
                    {isAdmin && !isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        className="h-6 px-2 text-xs text-muted-foreground"
                        onClick={() =>
                          handleRoleChange(p.id, p.role === 'admin' ? 'member' : 'admin')
                        }
                      >
                        {p.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={enrollment.variant}>{enrollment.label}</Badge>
                    {p.voice_profile?.samples_count ? (
                      <span className="text-xs text-muted-foreground">
                        {p.voice_profile.samples_count} sample
                        {p.voice_profile.samples_count !== 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(p.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/participants/${p.id}/enroll`}>
                      {p.voice_profile?.enrollment_status === 'enrolled' ? (
                        <>
                          <Mic className="mr-1.5 h-3.5 w-3.5" />
                          Re-enrol
                        </>
                      ) : (
                        <>
                          <MicOff className="mr-1.5 h-3.5 w-3.5" />
                          Enrol voice
                        </>
                      )}
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
