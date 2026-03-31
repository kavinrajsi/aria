import { Badge } from '@/components/ui/badge'
import type { Meeting } from '@/lib/types/database'

const config: Record<
  Meeting['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  scheduled: { label: 'Scheduled', variant: 'secondary' },
  active: { label: 'Live', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

export function MeetingStatusBadge({ status }: { status: Meeting['status'] }) {
  const { label, variant } = config[status]
  return <Badge variant={variant}>{label}</Badge>
}
