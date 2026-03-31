'use client'

import { useRef, useEffect, KeyboardEvent } from 'react'
import { BotMessageSquare, Send, Loader2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Interaction {
  query: string
  response: string
}

interface AriaPanelProps {
  query: string
  onQueryChange: (v: string) => void
  onSubmit: () => void
  response: string
  loading: boolean
  history: Interaction[]
  aiProvider: 'anthropic' | 'openai' | null
  // TTS
  hasVoice: boolean
  voiceEnabled: boolean
  speaking: boolean
  onToggleVoice: () => void
  onStopVoice: () => void
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'ChatGPT',
}

export function AriaPanel({
  query,
  onQueryChange,
  onSubmit,
  response,
  loading,
  history,
  aiProvider,
  hasVoice,
  voiceEnabled,
  speaking,
  onToggleVoice,
  onStopVoice,
}: AriaPanelProps) {
  const responseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (response) responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [response])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  const hasActivity = history.length > 0 || loading || response

  return (
    <div className="w-80 shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BotMessageSquare className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Aria
          </p>
          {speaking && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Speaking
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasVoice && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6',
                voiceEnabled ? 'text-primary' : 'text-muted-foreground'
              )}
              onClick={speaking ? onStopVoice : onToggleVoice}
              title={
                speaking
                  ? 'Stop speaking'
                  : voiceEnabled
                  ? 'Voice on — click to disable'
                  : 'Voice off — click to enable'
              }
            >
              {speaking ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          {aiProvider && (
            <span className="text-xs text-muted-foreground">
              via {PROVIDER_LABEL[aiProvider] ?? aiProvider}
            </span>
          )}
        </div>
      </div>

      {/* History + live response */}
      <ScrollArea className="flex-1 px-4 py-3">
        {!hasActivity ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1.5 text-center">
            <p className="text-xs text-muted-foreground">Ask Aria anything about this meeting.</p>
            <p className="text-xs text-muted-foreground opacity-60">⌘ Enter to send</p>
            {hasVoice && !voiceEnabled && (
              <p className="text-xs text-muted-foreground opacity-50">
                Enable voice for spoken responses
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-xs font-medium">{item.query}</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {item.response}
                </p>
                {i < history.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}

            {/* Live streaming response */}
            {(loading || response) && (
              <div className="space-y-1.5">
                {history.length > 0 && <Separator />}
                {query && !response && (
                  <p className="text-xs font-medium">{query}</p>
                )}
                <div ref={responseRef}>
                  {loading && !response ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking…
                    </div>
                  ) : (
                    <p
                      className={cn(
                        'text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap',
                        loading && 'after:content-["▋"] after:animate-pulse after:ml-0.5'
                      )}
                    >
                      {response}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t shrink-0 space-y-2">
        <Textarea
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Aria…"
          rows={2}
          disabled={loading}
          className="resize-none text-sm"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!query.trim() || loading}
          onClick={onSubmit}
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          Ask Aria
        </Button>
      </div>
    </div>
  )
}
