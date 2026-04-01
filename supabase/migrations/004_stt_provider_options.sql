-- Add ai_provider column (if missing) and widen the check constraint
-- to support ElevenLabs and Sarvam as STT providers.

-- Add column if it doesn't exist yet
alter table public.meetings
  add column if not exists ai_provider text default 'openai';

-- Drop the old check constraint (name may vary — try common patterns)
do $$
begin
  -- Supabase auto-generates constraint names like meetings_ai_provider_check
  alter table public.meetings drop constraint if exists meetings_ai_provider_check;
exception when undefined_object then null;
end $$;

-- Add the new constraint with all three providers
alter table public.meetings
  add constraint meetings_ai_provider_check
  check (ai_provider in ('openai', 'elevenlabs', 'sarvam'));
