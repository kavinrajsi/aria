'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Loader2, BotMessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Provider = 'openai' | 'elevenlabs' | 'sarvam'

interface AvailableProviders {
  openai: boolean
  elevenlabs: boolean
  sarvam: boolean
}

interface StartMeetingButtonProps {
  meetingId: string
  availableProviders: AvailableProviders
}

const PROVIDER_LABELS: Record<Provider, { name: string; model: string }> = {
  openai: { name: 'OpenAI Whisper', model: 'Realtime API' },
  elevenlabs: { name: 'ElevenLabs Scribe', model: 'scribe_v2' },
  sarvam: { name: 'Sarvam AI', model: 'saaras:v3' },
}

export function StartMeetingButton({ meetingId, availableProviders }: StartMeetingButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const options = (Object.keys(PROVIDER_LABELS) as Provider[]).filter(
    (p) => availableProviders[p]
  )
  const defaultProvider = options[0] ?? null
  const [selected, setSelected] = useState<Provider | null>(defaultProvider)

  async function startMeeting() {
    if (!selected) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('meetings')
      .update({ status: 'active', ai_provider: selected })
      .eq('id', meetingId)

    if (error) {
      toast.error('Failed to start meeting')
      setLoading(false)
      return
    }

    setOpen(false)
    router.push(`/meeting/${meetingId}`)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Start meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Start meeting</DialogTitle>
          <DialogDescription>
            Choose the AI provider for transcription analysis and Aria responses.
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <BotMessageSquare className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No AI providers configured</p>
            <p className="text-xs text-muted-foreground">
              Add an API key (OpenAI, ElevenLabs, or Sarvam) in Settings before starting a meeting.
            </p>
          </div>
        ) : (
          <RadioGroup
            value={selected ?? ''}
            onValueChange={(v) => setSelected(v as Provider)}
            className="gap-3"
          >
            {options.map((provider) => {
              const { name, model } = PROVIDER_LABELS[provider]
              return (
                <div key={provider} className="flex items-start gap-3">
                  <RadioGroupItem value={provider} id={provider} className="mt-0.5" />
                  <Label htmlFor={provider} className="flex flex-col gap-0.5 cursor-pointer font-normal">
                    <span className="font-medium text-sm">{name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{model}</span>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selected || loading}
            onClick={startMeeting}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3.5 w-3.5" />
            )}
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
