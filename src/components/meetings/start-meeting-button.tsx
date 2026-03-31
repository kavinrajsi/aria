'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function StartMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function startMeeting() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('meetings')
      .update({ status: 'active' })
      .eq('id', meetingId)

    if (error) {
      toast.error('Failed to start meeting')
      setLoading(false)
      return
    }

    router.push(`/meeting/${meetingId}`)
    router.refresh()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Start meeting
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start this meeting?</AlertDialogTitle>
          <AlertDialogDescription>
            Aria will begin listening and transcribing. Make sure all participants
            are present before starting.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={startMeeting}>Start</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
