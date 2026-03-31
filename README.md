# Aria — AI Meeting Intelligence Platform

Aria is an in-person AI meeting assistant that listens silently, transcribes speech in real-time, responds to voice queries ("Hey Aria"), and delivers summaries and action items after every meeting.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Database & Auth | Supabase (PostgreSQL, Auth, RLS, Realtime) |
| Transcription | OpenAI Whisper + Deepgram (real-time) |
| AI Intelligence | Anthropic Claude |
| Text-to-Speech | ElevenLabs |
| Hosting | Vercel |

## Architecture

```mermaid
graph TD
    subgraph Browser["Browser / Client Layer"]
        subgraph Pages["Pages (App Router)"]
            AuthPages["(auth)\nsign-in · sign-up"]
            DashPages["(dashboard)\nmeetings · detail · action items\nparticipants · settings · usage"]
            MeetingPage["meeting/[id]\nLive Meeting Room"]
        end

        subgraph Components["Components"]
            MeetingRoom["MeetingRoom\nTranscriptFeed · MeetingControls"]
            AriaPanel["AriaPanel"]
            MeetingsUI["MeetingsView · MeetingCard\nMeetingSummary · TranscriptReplay\nDocumentUpload"]
            SettingsUI["ApiKeysForm · ChangePasswordForm"]
        end

        subgraph Hooks["Hooks"]
            useMic["use-microphone"]
            useWhisper["use-whisper (chunked STT)"]
            useDeepgram["use-deepgram (streaming STT)"]
            useRealtime["use-realtime (Supabase Realtime)"]
            useTTS["use-tts (ElevenLabs)"]
        end
    end

    subgraph API["API Layer"]
        Transcribe["/api/transcribe"]
        AriaQuery["/api/aria/query"]
        Summarise["/api/meetings/[id]/summarise"]
        EndMeeting["/api/meetings/[id]/end"]
        Documents["/api/meetings/[id]/documents"]
        DGToken["/api/deepgram/token"]
        ELSpeak["/api/elevenlabs/speak"]
    end

    subgraph External["External Services"]
        SupabaseAuth["Supabase Auth + RLS"]
        SupabaseDB["Supabase DB\nprofiles · meetings · transcripts\nsummaries · action_items · documents"]
        SupabaseRT["Supabase Realtime"]
        Claude["Anthropic Claude"]
        Whisper["OpenAI Whisper"]
        DeepgramSvc["Deepgram"]
        ElevenLabs["ElevenLabs"]
    end

    DashPages --> SupabaseAuth
    MeetingPage --> MeetingRoom
    MeetingRoom --> useMic
    useMic --> useWhisper & useDeepgram
    useWhisper -->|audio chunks| Transcribe
    Transcribe --> Whisper --> Transcribe -->|save| SupabaseDB
    useDeepgram --> DGToken --> DeepgramSvc --> useDeepgram
    SupabaseDB --> SupabaseRT --> useRealtime --> MeetingRoom
    MeetingRoom -->|wake word| AriaPanel --> AriaQuery --> Claude --> AriaQuery --> ELSpeak --> ElevenLabs --> useTTS --> AriaPanel
    DashPages --> Summarise --> Claude
    Summarise -->|save| SupabaseDB
    DashPages --> EndMeeting --> SupabaseDB
    MeetingsUI --> Documents --> SupabaseDB
    DashPages --> SupabaseDB
```

## Key Flows

**Live meeting**
Browser mic → `use-realtime` → `/api/transcribe` (Whisper) → Supabase DB → Supabase Realtime → all participants' transcript feeds in real time.

**Hey Aria (wake word)**
Wake word detected client-side → `AriaPanel` → `/api/aria/query` → Claude → `/api/elevenlabs/speak` → audio response played back.

**Post-meeting**
`/api/meetings/[id]/summarise` → pulls transcripts from DB → Claude generates summary + action items → saved back to DB → visible in meeting detail page.

**Auth & roles**
`proxy.ts` guards all dashboard routes. Two roles via Supabase Auth: `admin` (sees all meetings, manages team) and `member` (sees only their meetings). Row-level security enforced at the DB layer.

## Project Structure

```
src/
├── app/
│   ├── (auth)/            — Sign in / Sign up
│   ├── (dashboard)/       — Authenticated pages
│   │   ├── meetings/      — List, detail, create, edit
│   │   ├── meeting/[id]/  — Live meeting room
│   │   ├── action-items/  — Action items tracker
│   │   ├── participants/  — Team management
│   │   ├── settings/      — API keys, password
│   │   └── usage/         — Token usage
│   └── api/               — Route handlers
├── components/
│   ├── meeting-room/      — Live room UI
│   ├── meetings/          — Meeting cards, forms, summaries
│   ├── participants/      — Team table
│   ├── settings/          — Settings forms
│   └── ui/                — shadcn/ui primitives
├── hooks/                 — Audio, transcription, TTS hooks
├── lib/
│   ├── actions/           — Server Actions
│   ├── supabase/          — Supabase client instances
│   └── types/             — Shared TypeScript types
└── proxy.ts               — Auth middleware
```

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

3. Run Supabase migrations:

```bash
supabase db push
```

4. Start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Migrations

Migrations live in `supabase/migrations/`:

| File | Description |
|---|---|
| `001_initial_schema.sql` | Core tables: profiles, meetings, participants, transcripts, documents, summaries, action items |
| `002_phase3_documents_and_storage.sql` | Document storage and Aria interactions |
| `003_token_usage.sql` | Token usage tracking |
