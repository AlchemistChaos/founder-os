export type IntegrationType = 'slack' | 'linear' | 'google' | 'fireflies'

export interface Integration {
  id: string
  user_id: string
  service: IntegrationType
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
  config: Record<string, any>
  created_at: string
  updated_at: string
}

export interface SyncJob {
  id: string
  integration_id: string
  job_type: 'full_sync' | 'incremental_sync' | 'webhook_event'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  payload: Record<string, any>
  error_message: string | null
  retry_count: number
  max_retries: number
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
}

export interface IntegrationData {
  id: string
  type: 'slack' | 'linear' | 'doc' | 'meeting'
  content: string
  source_url?: string
  source_name: string
  metadata: Record<string, any>
  timestamp: string
  author?: string
  channel?: string
  tags: string[]
}

export interface SlackEvent {
  type: string
  event?: {
    type: string
    text?: string
    user?: string
    channel?: string
    ts?: string
    thread_ts?: string
    files?: any[]
    [key: string]: any
  }
  team_id?: string
  user_id?: string
}

export interface LinearEvent {
  action: string
  data: {
    id: string
    title?: string
    description?: string
    state?: { name: string }
    assignee?: { email: string; name: string }
    team?: { name: string }
    labels?: { name: string }[]
    priority?: number
    updatedAt: string
    url: string
  }
  type: string
  createdAt: string
}

export interface GoogleDriveEvent {
  kind: string
  id: string
  type: string
  resourceId: string
  resourceUri: string
  token: string
}