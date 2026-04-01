import Link from 'next/link'
import { format } from 'date-fns'
import { Calendar, Clock, Users } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { MeetingStatusBadge } from './meeting-status-badge'
import type { MeetingWithOrganizer } from '@/lib/types/database'

interface MeetingCardProps {
  meeting: MeetingWithOrganizer & { participant_count?: number }
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const scheduledAt = new Date(meeting.scheduled_at)

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm leading-snug line-clamp-2">
              {meeting.title}
            </h3>
            <MeetingStatusBadge status={meeting.status} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span suppressHydrationWarning>{format(scheduledAt, 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span suppressHydrationWarning>{format(scheduledAt, 'h:mm a')}</span>
          </div>
          {meeting.participant_count !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>
                {meeting.participant_count}{' '}
                {meeting.participant_count === 1 ? 'participant' : 'participants'}
              </span>
            </div>
          )}
          {meeting.agenda_items.length > 0 && (
            <div className="mt-3 space-y-1">
              {meeting.agenda_items.slice(0, 2).map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground truncate">
                  <span className="text-foreground/50 mr-1">{i + 1}.</span>
                  {item}
                </p>
              ))}
              {meeting.agenda_items.length > 2 && (
                <p className="text-xs text-muted-foreground">
                  +{meeting.agenda_items.length - 2} more
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
