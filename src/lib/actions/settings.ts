'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const API_KEY_NAMES = ['DEEPGRAM_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY'] as const
export type ApiKeyName = (typeof API_KEY_NAMES)[number]

export async function getApiKeyStatuses(): Promise<Record<ApiKeyName, boolean>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('key')
    .in('key', [...API_KEY_NAMES])

  const configured = new Set((data ?? []).map((r: { key: string }) => r.key))
  return {
    DEEPGRAM_API_KEY: configured.has('DEEPGRAM_API_KEY'),
    OPENAI_API_KEY: configured.has('OPENAI_API_KEY'),
    ELEVENLABS_API_KEY: configured.has('ELEVENLABS_API_KEY'),
  }
}

export async function getApiKeyValues(): Promise<Record<ApiKeyName, string | null>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [...API_KEY_NAMES])

  const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))
  return {
    DEEPGRAM_API_KEY: map['DEEPGRAM_API_KEY'] ?? null,
    OPENAI_API_KEY: map['OPENAI_API_KEY'] ?? null,
    ELEVENLABS_API_KEY: map['ELEVENLABS_API_KEY'] ?? null,
  }
}

export async function saveApiKeys(
  keys: Partial<Record<ApiKeyName, string>>
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const upserts = Object.entries(keys)
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
    .map(([key, value]) => ({ key, value: (value as string).trim() }))

  if (upserts.length === 0) return {}

  const { error } = await supabase.from('settings').upsert(upserts)
  if (error) return { error: error.message }

  revalidatePath('/settings')
  return {}
}

export async function clearApiKey(key: ApiKeyName): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('settings').delete().eq('key', key)
  if (error) return { error: error.message }
  revalidatePath('/settings')
  return {}
}
