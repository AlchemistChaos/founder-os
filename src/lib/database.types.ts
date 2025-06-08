export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      entries: {
        Row: {
          id: string
          user_id: string
          type: 'slack' | 'linear' | 'doc' | 'meeting' | 'clip' | 'reflection'
          content: string
          metadata: Json
          tags: string[]
          timestamp: string
          is_flashcard: boolean
          source_url: string | null
          source_name: string | null
          related_goal_ids: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'slack' | 'linear' | 'doc' | 'meeting' | 'clip' | 'reflection'
          content: string
          metadata?: Json
          tags?: string[]
          timestamp?: string
          is_flashcard?: boolean
          source_url?: string | null
          source_name?: string | null
          related_goal_ids?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'slack' | 'linear' | 'doc' | 'meeting' | 'clip' | 'reflection'
          content?: string
          metadata?: Json
          tags?: string[]
          timestamp?: string
          is_flashcard?: boolean
          source_url?: string | null
          source_name?: string | null
          related_goal_ids?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      flashcards: {
        Row: {
          id: string
          user_id: string
          entry_id: string
          question: string
          answer: string
          due_at: string
          last_reviewed_at: string | null
          ease_factor: number
          interval: number
          repetition_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entry_id: string
          question: string
          answer: string
          due_at?: string
          last_reviewed_at?: string | null
          ease_factor?: number
          interval?: number
          repetition_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entry_id?: string
          question?: string
          answer?: string
          due_at?: string
          last_reviewed_at?: string | null
          ease_factor?: number
          interval?: number
          repetition_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      integrations: {
        Row: {
          id: string
          user_id: string
          service: 'slack' | 'linear' | 'google' | 'fireflies'
          is_active: boolean
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          team_id: string | null
          team_name: string | null
          user_email: string | null
          scopes: string[] | null
          webhook_url: string | null
          last_sync_at: string | null
          sync_cursor: string | null
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          service: 'slack' | 'linear' | 'google' | 'fireflies'
          is_active?: boolean
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          team_id?: string | null
          team_name?: string | null
          user_email?: string | null
          scopes?: string[] | null
          webhook_url?: string | null
          last_sync_at?: string | null
          sync_cursor?: string | null
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          service?: 'slack' | 'linear' | 'google' | 'fireflies'
          is_active?: boolean
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          team_id?: string | null
          team_name?: string | null
          user_email?: string | null
          scopes?: string[] | null
          webhook_url?: string | null
          last_sync_at?: string | null
          sync_cursor?: string | null
          config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      sync_jobs: {
        Row: {
          id: string
          integration_id: string
          job_type: 'full_sync' | 'incremental_sync' | 'webhook_event'
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
          payload: Json
          error_message: string | null
          retry_count: number
          max_retries: number
          scheduled_at: string
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          integration_id: string
          job_type: 'full_sync' | 'incremental_sync' | 'webhook_event'
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
          payload?: Json
          error_message?: string | null
          retry_count?: number
          max_retries?: number
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          integration_id?: string
          job_type?: 'full_sync' | 'incremental_sync' | 'webhook_event'
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
          payload?: Json
          error_message?: string | null
          retry_count?: number
          max_retries?: number
          scheduled_at?: string
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
        }
      }
      webhook_events: {
        Row: {
          id: string
          service: 'linear' | 'slack' | 'google' | 'fireflies'
          event_type: string
          action: string
          external_id: string
          data: Json
          url: string | null
          processed: boolean
          processed_at: string | null
          error_message: string | null
          webhook_id: string | null
          delivery_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service: 'linear' | 'slack' | 'google' | 'fireflies'
          event_type: string
          action: string
          external_id: string
          data: Json
          url?: string | null
          processed?: boolean
          processed_at?: string | null
          error_message?: string | null
          webhook_id?: string | null
          delivery_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service?: 'linear' | 'slack' | 'google' | 'fireflies'
          event_type?: string
          action?: string
          external_id?: string
          data?: Json
          url?: string | null
          processed?: boolean
          processed_at?: string | null
          error_message?: string | null
          webhook_id?: string | null
          delivery_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}