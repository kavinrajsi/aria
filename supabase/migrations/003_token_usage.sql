-- ============================================================
-- Token usage tracking
-- ============================================================

create table public.token_usage (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now() not null,
  meeting_id    uuid references public.meetings(id) on delete set null,
  user_id       uuid references public.profiles(id) on delete set null,
  provider      text not null check (provider in ('anthropic', 'openai')),
  model         text not null,
  operation     text not null check (operation in ('aria_query', 'summary')),
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0
);

alter table public.token_usage enable row level security;

-- Admins can read all usage data
create policy "admins read token_usage"
  on public.token_usage for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Any authenticated user can insert (API routes run with the user's session)
create policy "authenticated users insert token_usage"
  on public.token_usage for insert
  with check (auth.uid() is not null);
