import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Token Usage' }

// Approximate pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4.6': { input: 3.0, output: 15.0 },
  'gpt-4o-mini':       { input: 0.15, output: 0.6 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? { input: 0, output: 0 }
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}

interface ProviderStat {
  provider: 'anthropic' | 'openai'
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  ariaTokens: number
  summaryTokens: number
}

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  anthropic: { label: 'Anthropic',  color: 'bg-amber-500',  bg: 'bg-amber-500/10' },
  openai:    { label: 'OpenAI',     color: 'bg-indigo-500', bg: 'bg-indigo-500/10' },
}

export default async function UsagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/meetings')

  const { data: rows } = await supabase
    .from('token_usage')
    .select('provider, model, operation, input_tokens, output_tokens')

  // Aggregate by provider
  const statsMap: Record<string, ProviderStat> = {}

  for (const row of rows ?? []) {
    if (!statsMap[row.provider]) {
      statsMap[row.provider] = {
        provider: row.provider as 'anthropic' | 'openai',
        model: row.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
        ariaTokens: 0,
        summaryTokens: 0,
      }
    }
    const s = statsMap[row.provider]
    const total = row.input_tokens + row.output_tokens
    s.inputTokens  += row.input_tokens
    s.outputTokens += row.output_tokens
    s.totalTokens  += total
    s.cost         += estimateCost(row.model, row.input_tokens, row.output_tokens)
    if (row.operation === 'aria_query') s.ariaTokens    += total
    else                                s.summaryTokens += total
  }

  const stats = Object.values(statsMap).sort((a, b) => b.totalTokens - a.totalTokens)
  const grandTotal = stats.reduce((sum, s) => sum + s.totalTokens, 0)
  const grandCost  = stats.reduce((sum, s) => sum + s.cost, 0)
  const isEmpty = grandTotal === 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Token Usage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI API consumption across all meetings
        </p>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total tokens</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{formatTokens(grandTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Estimated cost</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{formatCost(grandCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stacked bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Breakdown by provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No token usage recorded yet. Use Aria or generate a meeting summary to start tracking.
            </p>
          ) : (
            <>
              {/* Bar */}
              <div className="flex h-8 rounded-lg overflow-hidden gap-0.5 bg-muted">
                {stats.map((s) => {
                  const pct = grandTotal > 0 ? (s.totalTokens / grandTotal) * 100 : 0
                  const meta = PROVIDER_META[s.provider]
                  return (
                    <div
                      key={s.provider}
                      className={`${meta.color} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${meta.label}: ${pct.toFixed(1)}%`}
                    />
                  )
                })}
              </div>

              {/* Legend cards */}
              <div className="grid grid-cols-2 gap-3">
                {stats.map((s) => {
                  const pct  = grandTotal > 0 ? (s.totalTokens / grandTotal) * 100 : 0
                  const meta = PROVIDER_META[s.provider]
                  return (
                    <div
                      key={s.provider}
                      className={`rounded-xl border p-4 space-y-3 ${meta.bg}`}
                    >
                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.color}`} />
                        <span className="text-sm font-medium">{meta.label}</span>
                        <span className="ml-auto text-sm font-semibold tabular-nums">
                          {pct.toFixed(1)}%
                        </span>
                      </div>

                      {/* Tokens + cost */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Total tokens</span>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatTokens(s.totalTokens)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Input</span>
                          <span className="tabular-nums">{formatTokens(s.inputTokens)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Output</span>
                          <span className="tabular-nums">{formatTokens(s.outputTokens)}</span>
                        </div>
                      </div>

                      {/* Operation breakdown */}
                      {(s.ariaTokens > 0 || s.summaryTokens > 0) && (
                        <div className="space-y-1 text-xs text-muted-foreground border-t pt-2">
                          {s.ariaTokens > 0 && (
                            <div className="flex justify-between">
                              <span>Aria queries</span>
                              <span className="tabular-nums">{formatTokens(s.ariaTokens)}</span>
                            </div>
                          )}
                          {s.summaryTokens > 0 && (
                            <div className="flex justify-between">
                              <span>Summaries</span>
                              <span className="tabular-nums">{formatTokens(s.summaryTokens)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Estimated cost */}
                      <div className="flex justify-between text-xs border-t pt-2">
                        <span className="text-muted-foreground">Est. cost</span>
                        <span className="font-semibold tabular-nums">{formatCost(s.cost)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Cost estimates are approximate. Transcription (OpenAI Realtime) is billed per minute and not included here.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
