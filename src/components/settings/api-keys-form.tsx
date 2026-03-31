'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveApiKeys, clearApiKey, type ApiKeyName } from '@/lib/actions/settings'

const KEYS: { name: ApiKeyName; label: string; description: string }[] = [
  {
    name: 'DEEPGRAM_API_KEY',
    label: 'Deepgram',
    description: 'Real-time speech-to-text transcription during meetings.',
  },
  {
    name: 'OPENAI_API_KEY',
    label: 'OpenAI',
    description: 'AI summaries, action items, and Aria assistant responses.',
  },
  {
    name: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs',
    description: 'Text-to-speech for Aria voice responses.',
  },
]

interface ApiKeysFormProps {
  statuses: Record<ApiKeyName, boolean>
  values: Record<ApiKeyName, string | null>
}

export function ApiKeysForm({ statuses, values }: ApiKeysFormProps) {
  const [isPending, startTransition] = useTransition()
  const [visible, setVisible] = useState<Partial<Record<ApiKeyName, boolean>>>({})

  function toggleVisibility(name: ApiKeyName) {
    setVisible((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const keys: Partial<Record<ApiKeyName, string>> = {}
    for (const { name } of KEYS) {
      const val = (data.get(name) as string | null)?.trim()
      if (val) keys[name] = val
    }

    startTransition(async () => {
      const result = await saveApiKeys(keys)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('API keys saved.')
      }
    })
  }

  function handleClear(name: ApiKeyName) {
    startTransition(async () => {
      const result = await clearApiKey(name)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${name} cleared.`)
      }
    })
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {KEYS.map(({ name, label, description }) => {
        const isSet = statuses[name]
        const isVisible = visible[name]

        return (
          <div key={name} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={name} className="flex items-center gap-2">
                {label}
                {isSet ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Label>
              {isSet && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  disabled={isPending}
                  onClick={() => handleClear(name)}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            <div className="relative">
              <Input
                id={name}
                name={name}
                type={isVisible ? 'text' : 'password'}
                defaultValue={values[name] ?? ''}
                placeholder={isSet ? '' : 'Paste your API key'}
                autoComplete="off"
                className="pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
                onClick={() => toggleVisibility(name)}
                tabIndex={-1}
              >
                {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )
      })}

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save keys'}
      </Button>
    </form>
  )
}
