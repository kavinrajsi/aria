export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          role: 'admin' | 'participant'
          created_at: string
        }
        Insert: {
          id: string
          name: string
          email: string
          role?: 'admin' | 'participant'
          created_at?: string
        }
        Update: {
          name?: string
          email?: string
          role?: 'admin' | 'participant'
        }
      }
      voice_profiles: {
        Row: {
          id: string
          user_id: string
          enrollment_status: 'pending' | 'in_progress' | 'enrolled' | 'failed'
          samples_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enrollment_status?: 'pending' | 'in_progress' | 'enrolled' | 'failed'
          samples_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          enrollment_status?: 'pending' | 'in_progress' | 'enrolled' | 'failed'
          samples_count?: number
          updated_at?: string
        }
      }
      voice_samples: {
        Row: {
          id: string
          voice_profile_id: string
          storage_url: string
          duration_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          voice_profile_id: string
          storage_url: string
          duration_seconds?: number | null
          created_at?: string
        }
        Update: {
          storage_url?: string
          duration_seconds?: number | null
        }
      }
      meetings: {
        Row: {
          id: string
          title: string
          scheduled_at: string
          organizer_id: string | null
          status: 'scheduled' | 'active' | 'completed' | 'cancelled'
          ai_provider: 'openai' | 'elevenlabs' | 'sarvam' | null
          agenda_items: string[]
          briefing_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          scheduled_at: string
          organizer_id?: string | null
          status?: 'scheduled' | 'active' | 'completed' | 'cancelled'
          ai_provider?: 'openai' | 'elevenlabs' | 'sarvam' | null
          agenda_items?: string[]
          briefing_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          scheduled_at?: string
          organizer_id?: string | null
          status?: 'scheduled' | 'active' | 'completed' | 'cancelled'
          ai_provider?: 'openai' | 'elevenlabs' | 'sarvam' | null
          agenda_items?: string[]
          briefing_notes?: string | null
          updated_at?: string
        }
      }
      settings: {
        Row: {
          key: string
          value: string
          updated_at: string
        }
        Insert: {
          key: string
          value: string
          updated_at?: string
        }
        Update: {
          value?: string
          updated_at?: string
        }
      }
      meeting_participants: {
        Row: {
          id: string
          meeting_id: string
          user_id: string
          joined_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          user_id: string
          joined_at?: string | null
          created_at?: string
        }
        Update: {
          joined_at?: string | null
        }
      }
      transcripts: {
        Row: {
          id: string
          meeting_id: string
          speaker_label: string | null
          user_id: string | null
          content: string
          timestamp_ms: number
          confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          speaker_label?: string | null
          user_id?: string | null
          content: string
          timestamp_ms: number
          confidence?: number | null
          created_at?: string
        }
        Update: {
          speaker_label?: string | null
          user_id?: string | null
          content?: string
        }
      }
      audio_recordings: {
        Row: {
          id: string
          meeting_id: string
          storage_url: string
          duration_seconds: number | null
          file_size_bytes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          storage_url: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          created_at?: string
        }
        Update: {
          storage_url?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
        }
      }
      meeting_summaries: {
        Row: {
          id: string
          meeting_id: string
          summary_text: string | null
          key_decisions: string[]
          generated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          summary_text?: string | null
          key_decisions?: string[]
          generated_at?: string
        }
        Update: {
          summary_text?: string | null
          key_decisions?: string[]
        }
      }
      action_items: {
        Row: {
          id: string
          meeting_id: string
          assigned_to: string | null
          description: string
          status: 'pending' | 'complete'
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          meeting_id: string
          assigned_to?: string | null
          description: string
          status?: 'pending' | 'complete'
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          description?: string
          status?: 'pending' | 'complete'
          completed_at?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          meeting_id: string
          file_name: string
          storage_url: string
          file_type: string | null
          uploaded_by: string | null
          uploaded_at: string
          content_text: string | null
        }
        Insert: {
          id?: string
          meeting_id: string
          file_name: string
          storage_url: string
          file_type?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
          content_text?: string | null
        }
        Update: {
          file_name?: string
          storage_url?: string
          file_type?: string | null
          content_text?: string | null
        }
      }
      aria_interactions: {
        Row: {
          id: string
          meeting_id: string
          triggered_by: string | null
          query_text: string
          response_text: string | null
          timestamp_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          triggered_by?: string | null
          query_text: string
          response_text?: string | null
          timestamp_ms?: number | null
          created_at?: string
        }
        Update: {
          response_text?: string | null
        }
      }
      transcript_embeddings: {
        Row: {
          id: string
          meeting_id: string
          transcript_chunk: string
          embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          transcript_chunk: string
          embedding?: number[] | null
          created_at?: string
        }
        Update: {
          transcript_chunk?: string
          embedding?: number[] | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<never, never>
        Returns: boolean
      }
      is_meeting_participant: {
        Args: { p_meeting_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type VoiceProfile = Database['public']['Tables']['voice_profiles']['Row']
export type VoiceSample = Database['public']['Tables']['voice_samples']['Row']
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type MeetingParticipant = Database['public']['Tables']['meeting_participants']['Row']
export type Transcript = Database['public']['Tables']['transcripts']['Row']
export type AudioRecording = Database['public']['Tables']['audio_recordings']['Row']
export type MeetingSummary = Database['public']['Tables']['meeting_summaries']['Row']
export type ActionItem = Database['public']['Tables']['action_items']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type AriaInteraction = Database['public']['Tables']['aria_interactions']['Row']

// Extended types with joined data
export type MeetingWithOrganizer = Meeting & {
  organizer: Pick<Profile, 'id' | 'name' | 'email'> | null
}

export type MeetingWithParticipants = Meeting & {
  organizer: Pick<Profile, 'id' | 'name' | 'email'> | null
  meeting_participants: Array<
    MeetingParticipant & { profile: Pick<Profile, 'id' | 'name' | 'email'> }
  >
}

export type ActionItemWithAssignee = ActionItem & {
  assignee: Pick<Profile, 'id' | 'name' | 'email'> | null
  meeting: Pick<Meeting, 'id' | 'title'> | null
}
