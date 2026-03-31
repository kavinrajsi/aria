-- ============================================================
-- Aria — Initial Schema Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- Extensions
create extension if not exists "pgvector";

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  name       text not null,
  email      text not null unique,
  role       text not null default 'participant' check (role in ('admin', 'participant')),
  created_at timestamptz default now() not null
);

-- Voice profiles (one per user)
create table public.voice_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles(id) on delete cascade not null unique,
  enrollment_status text not null default 'pending'
                      check (enrollment_status in ('pending', 'in_progress', 'enrolled', 'failed')),
  samples_count     integer not null default 0,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);

-- Voice samples (audio files uploaded during enrollment)
create table public.voice_samples (
  id               uuid primary key default gen_random_uuid(),
  voice_profile_id uuid references public.voice_profiles(id) on delete cascade not null,
  storage_url      text not null,
  duration_seconds real,
  created_at       timestamptz default now() not null
);

-- Meetings
create table public.meetings (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  scheduled_at   timestamptz not null,
  organizer_id   uuid references public.profiles(id) on delete set null,
  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  agenda_items   text[] not null default '{}',
  briefing_notes text,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

-- Meeting participants (join table)
create table public.meeting_participants (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  joined_at  timestamptz,
  created_at timestamptz default now() not null,
  unique(meeting_id, user_id)
);

-- Transcripts (real-time, per utterance)
create table public.transcripts (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid references public.meetings(id) on delete cascade not null,
  speaker_label text,    -- generic: "Speaker 0", "Speaker 1" (Phase 1)
  user_id       uuid references public.profiles(id) on delete set null, -- resolved in Phase 3+
  content       text not null,
  timestamp_ms  bigint not null,  -- ms from meeting start
  confidence    real,
  created_at    timestamptz default now() not null
);

-- Audio recordings (stored in Cloudflare R2)
create table public.audio_recordings (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid references public.meetings(id) on delete cascade not null,
  storage_url      text not null,
  duration_seconds integer,
  file_size_bytes  bigint,
  created_at       timestamptz default now() not null
);

-- Meeting summaries (auto-generated in Phase 4)
create table public.meeting_summaries (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid references public.meetings(id) on delete cascade not null unique,
  summary_text  text,
  key_decisions text[] not null default '{}',
  generated_at  timestamptz default now() not null
);

-- Action items
create table public.action_items (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references public.meetings(id) on delete cascade not null,
  assigned_to  uuid references public.profiles(id) on delete set null,
  description  text not null,
  status       text not null default 'pending' check (status in ('pending', 'complete')),
  created_at   timestamptz default now() not null,
  completed_at timestamptz
);

-- Pre-meeting documents
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid references public.meetings(id) on delete cascade not null,
  file_name   text not null,
  storage_url text not null,
  file_type   text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz default now() not null
);

-- Aria interactions (wake-word triggered)
create table public.aria_interactions (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid references public.meetings(id) on delete cascade not null,
  triggered_by uuid references public.profiles(id) on delete set null,
  query_text   text not null,
  response_text text,
  timestamp_ms bigint,
  created_at   timestamptz default now() not null
);

-- Transcript embeddings (semantic search — Phase 5)
create table public.transcript_embeddings (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid references public.meetings(id) on delete cascade not null,
  transcript_chunk text not null,
  embedding        vector(1536),
  created_at       timestamptz default now() not null
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.handle_updated_at();

create trigger voice_profiles_updated_at
  before update on public.voice_profiles
  for each row execute function public.handle_updated_at();

-- Auto-create profile on user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'participant')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update voice_profiles.samples_count on sample insert/delete
create or replace function public.sync_samples_count()
returns trigger
language plpgsql
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.voice_profiles
    set samples_count = samples_count + 1,
        enrollment_status = case
          when samples_count + 1 >= 3 then 'enrolled'
          when samples_count + 1 >= 1 then 'in_progress'
          else 'pending'
        end
    where id = new.voice_profile_id;
  elsif (TG_OP = 'DELETE') then
    update public.voice_profiles
    set samples_count = greatest(0, samples_count - 1),
        enrollment_status = case
          when samples_count - 1 <= 0 then 'pending'
          when samples_count - 1 < 3  then 'in_progress'
          else 'enrolled'
        end
    where id = old.voice_profile_id;
  end if;
  return null;
end;
$$;

create trigger voice_samples_count
  after insert or delete on public.voice_samples
  for each row execute function public.sync_samples_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles             enable row level security;
alter table public.voice_profiles       enable row level security;
alter table public.voice_samples        enable row level security;
alter table public.meetings             enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.transcripts          enable row level security;
alter table public.audio_recordings     enable row level security;
alter table public.meeting_summaries    enable row level security;
alter table public.action_items         enable row level security;
alter table public.documents            enable row level security;
alter table public.aria_interactions    enable row level security;
alter table public.transcript_embeddings enable row level security;

-- Helper: check if calling user is admin
create or replace function public.is_admin()
returns boolean
language sql security definer stable
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helper: check if calling user is participant/organizer of a meeting
create or replace function public.is_meeting_participant(p_meeting_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.meeting_participants
    where meeting_id = p_meeting_id and user_id = auth.uid()
  ) or exists (
    select 1 from public.meetings
    where id = p_meeting_id and organizer_id = auth.uid()
  );
$$;

-- ---------- Profiles ----------
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles"
  on public.profiles for select using (public.is_admin());
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ---------- Voice profiles ----------
create policy "Users can manage own voice profile"
  on public.voice_profiles for all using (auth.uid() = user_id);
create policy "Admins can manage all voice profiles"
  on public.voice_profiles for all using (public.is_admin());

-- ---------- Voice samples ----------
create policy "Users can manage own voice samples"
  on public.voice_samples for all using (
    exists (
      select 1 from public.voice_profiles
      where id = voice_profile_id and user_id = auth.uid()
    )
  );
create policy "Admins can manage all voice samples"
  on public.voice_samples for all using (public.is_admin());

-- ---------- Meetings ----------
create policy "Admins can manage all meetings"
  on public.meetings for all using (public.is_admin());
create policy "Organizers can manage own meetings"
  on public.meetings for all using (auth.uid() = organizer_id);
create policy "Participants can view their meetings"
  on public.meetings for select using (public.is_meeting_participant(id));

-- ---------- Meeting participants ----------
create policy "Admins can manage meeting participants"
  on public.meeting_participants for all using (public.is_admin());
create policy "Organizers can manage their meeting participants"
  on public.meeting_participants for all using (
    exists (
      select 1 from public.meetings
      where id = meeting_id and organizer_id = auth.uid()
    )
  );
create policy "Users can view own participation"
  on public.meeting_participants for select using (auth.uid() = user_id);

-- ---------- Transcripts ----------
create policy "Admins can manage all transcripts"
  on public.transcripts for all using (public.is_admin());
create policy "Meeting participants can view transcripts"
  on public.transcripts for select using (public.is_meeting_participant(meeting_id));
create policy "API can insert transcripts"
  on public.transcripts for insert with check (true);

-- ---------- Audio recordings ----------
create policy "Admins can manage all recordings"
  on public.audio_recordings for all using (public.is_admin());
create policy "Meeting participants can view recordings"
  on public.audio_recordings for select using (public.is_meeting_participant(meeting_id));

-- ---------- Meeting summaries ----------
create policy "Admins can manage all summaries"
  on public.meeting_summaries for all using (public.is_admin());
create policy "Meeting participants can view summaries"
  on public.meeting_summaries for select using (public.is_meeting_participant(meeting_id));

-- ---------- Action items ----------
create policy "Admins can manage all action items"
  on public.action_items for all using (public.is_admin());
create policy "Meeting participants can view action items"
  on public.action_items for select using (public.is_meeting_participant(meeting_id));
create policy "Assigned users can complete their items"
  on public.action_items for update using (auth.uid() = assigned_to);

-- ---------- Documents ----------
create policy "Admins can manage all documents"
  on public.documents for all using (public.is_admin());
create policy "Organizers can manage their meeting documents"
  on public.documents for all using (
    exists (
      select 1 from public.meetings
      where id = meeting_id and organizer_id = auth.uid()
    )
  );
create policy "Meeting participants can view documents"
  on public.documents for select using (public.is_meeting_participant(meeting_id));

-- ---------- Aria interactions ----------
create policy "Admins can manage all aria interactions"
  on public.aria_interactions for all using (public.is_admin());
create policy "Meeting participants can view aria interactions"
  on public.aria_interactions for select using (public.is_meeting_participant(meeting_id));
create policy "API can insert aria interactions"
  on public.aria_interactions for insert with check (true);

-- ---------- Transcript embeddings ----------
create policy "Admins can manage transcript embeddings"
  on public.transcript_embeddings for all using (public.is_admin());
create policy "Meeting participants can view transcript embeddings"
  on public.transcript_embeddings for select using (public.is_meeting_participant(meeting_id));

-- ============================================================
-- INDEXES (performance)
-- ============================================================

create index meetings_organizer_id_idx on public.meetings(organizer_id);
create index meetings_status_idx on public.meetings(status);
create index meetings_scheduled_at_idx on public.meetings(scheduled_at desc);
create index meeting_participants_user_id_idx on public.meeting_participants(user_id);
create index meeting_participants_meeting_id_idx on public.meeting_participants(meeting_id);
create index transcripts_meeting_id_idx on public.transcripts(meeting_id);
create index transcripts_timestamp_idx on public.transcripts(meeting_id, timestamp_ms);
create index action_items_assigned_to_idx on public.action_items(assigned_to);
create index action_items_meeting_id_idx on public.action_items(meeting_id);
create index action_items_status_idx on public.action_items(status);
