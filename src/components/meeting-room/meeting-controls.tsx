'use client'

import { Mic, MicOff, Square, Loader2 } from 'lucide-react'
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
import { cn } from '@/lib/utils'

interface MeetingControlsProps {
  micActive: boolean
  onToggleMic: () => void
  micDisabled?: boolean
  onEndMeeting: () => void
  endingMeeting: boolean
}

export function MeetingControls({
  micActive,
  onToggleMic,
  micDisabled = false,
  onEndMeeting,
  endingMeeting,
}: MeetingControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={micActive ? 'default' : 'outline'}
        size="sm"
        onClick={onToggleMic}
        disabled={micDisabled}
        title={micDisabled ? 'Reconnecting, please wait…' : undefined}
        className={cn(micActive && 'relative')}
      >
        {micActive ? (
          <>
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <Mic className="mr-1.5 h-3.5 w-3.5" />
            Mic on
          </>
        ) : (
          <>
            <MicOff className="mr-1.5 h-3.5 w-3.5" />
            Mic off
          </>
        )}
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" disabled={endingMeeting}>
            {endingMeeting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Square className="mr-1.5 h-3.5 w-3.5" />
            )}
            End meeting
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              The transcript will be saved. Aria summaries and action items will
              be available on the meeting page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onEndMeeting}>End meeting</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
