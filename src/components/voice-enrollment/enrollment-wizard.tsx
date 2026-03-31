'use client'

import { useState } from 'react'
import { CheckCircle2, Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

const REQUIRED_SAMPLES = 3

const PROMPTS = [
  '"The quick brown fox jumps over the lazy dog."',
  '"Aria, please summarise the last five minutes of our discussion."',
  '"Good morning everyone. Let\'s get started with today\'s agenda."',
  '"I\'d like to add an action item for the team to review before next week."',
  '"Can we schedule a follow-up meeting to discuss the budget proposal?"',
]

interface EnrollmentWizardProps {
  participantId: string
  participantName: string
  voiceProfileId: string | null
  currentSamples: number
}

export function EnrollmentWizard({
  participantId,
  participantName,
  voiceProfileId,
  currentSamples,
}: EnrollmentWizardProps) {
  const [samplesRecorded, setSamplesRecorded] = useState(currentSamples)
  const [currentPrompt, setCurrentPrompt] = useState(Math.min(currentSamples, PROMPTS.length - 1))
  const isComplete = samplesRecorded >= REQUIRED_SAMPLES

  // Audio recording will be implemented in Phase 2 alongside the full audio pipeline.
  // For now this wizard shows the UX flow and prompt sequence.
  function handleSampleRecorded() {
    setSamplesRecorded((n) => n + 1)
    setCurrentPrompt((n) => Math.min(n + 1, PROMPTS.length - 1))
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Samples recorded
          </span>
          <span className="font-medium tabular-nums">
            {samplesRecorded} / {REQUIRED_SAMPLES}
          </span>
        </div>
        <Progress value={(samplesRecorded / REQUIRED_SAMPLES) * 100} className="h-2" />
      </div>

      {isComplete ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <div>
              <p className="font-medium">Enrollment complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {participantName}&apos;s voice profile is ready. Aria will be able to
                identify them in meetings.
              </p>
            </div>
            <Badge variant="default">Enrolled</Badge>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-6 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sample {samplesRecorded + 1} of {REQUIRED_SAMPLES}
                </p>
                <p className="text-sm">
                  Ask <span className="font-medium">{participantName}</span> to read aloud:
                </p>
              </div>
              <blockquote className="border-l-2 pl-4 text-sm italic text-muted-foreground">
                {PROMPTS[currentPrompt]}
              </blockquote>
            </CardContent>
          </Card>

          <Alert>
            <Mic className="h-4 w-4" />
            <AlertDescription>
              Audio recording is coming in Phase 2. For now, use this wizard to
              familiarise participants with the enrollment flow.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            {/* Placeholder — will trigger MediaRecorder in Phase 2 */}
            <Button
              className="flex-1"
              onClick={handleSampleRecorded}
              disabled={samplesRecorded >= PROMPTS.length}
            >
              <Mic className="mr-2 h-4 w-4" />
              Record sample {samplesRecorded + 1}
            </Button>
          </div>

          {samplesRecorded > 0 && (
            <div className="space-y-2">
              {Array.from({ length: samplesRecorded }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Sample {i + 1} recorded
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
