import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { OAuthConfig, IntegrationType } from './types'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OAUTH_CONFIGS: Record<IntegrationType, OAuthConfig> = {
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || 'demo-client-id',
    clientSecret: process.env.SLACK_CLIENT_SECRET || 'demo-client-secret',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/slack/callback`,
    scopes: ['channels:history', 'channels:read', 'chat:write', 'im:history', 'im:read', 'users:read', 'team:read'],
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'demo-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'demo-client-secret',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/google/callback`,
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly'],
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token'
  },
  fireflies: {
    clientId: process.env.FIREFLIES_CLIENT_ID || 'demo-client-id',
    clientSecret: process.env.FIREFLIES_CLIENT_SECRET || 'demo-client-secret',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/fireflies/callback`,
    scopes: ['read:transcripts'],
    authUrl: 'https://api.fireflies.ai/oauth/authorize',
    tokenUrl: 'https://api.fireflies.ai/oauth/token'
  },
  linear: {
    clientId: process.env.LINEAR_CLIENT_ID || 'demo-client-id',
    clientSecret: process.env.LINEAR_CLIENT_SECRET || 'demo-client-secret',
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/linear/callback`,
    scopes: ['read'],
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token'
  }
}

export function getOAuthConfig(service: IntegrationType): OAuthConfig {
  return OAUTH_CONFIGS[service]
}

export function buildAuthUrl(service: IntegrationType, state: string): string {
  const config = getOAuthConfig(service)
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    response_type: 'code'
  })

  // Service-specific parameters
  if (service === 'google') {
    params.append('access_type', 'offline')
    params.append('prompt', 'consent')
  }

  return `${config.authUrl}?${params.toString()}`
}

export async function exchangeCodeForTokens(
  service: IntegrationType,
  code: string
): Promise<{
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
  scope?: string
  team?: any
  user?: any
}> {
  const config = getOAuthConfig(service)
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri
  })

  if (service === 'slack') {
    // Slack uses different parameter name
    params.append('grant_type', 'authorization_code')
  } else {
    params.append('grant_type', 'authorization_code')
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()
  
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`)
  }

  return data
}

export async function refreshAccessToken(
  service: IntegrationType,
  refreshToken: string
): Promise<{
  access_token: string
  refresh_token?: string
  expires_in?: number
}> {
  const config = getOAuthConfig(service)
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data = await response.json()
  
  if (data.error) {
    throw new Error(`Refresh error: ${data.error_description || data.error}`)
  }

  return data
}

export async function saveIntegration(
  userId: string,
  service: IntegrationType,
  tokenData: any,
  teamInfo?: any
): Promise<string> {
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .upsert({
      user_id: userId,
      service,
      team_id: teamInfo?.id || teamInfo?.team?.id,
      team_name: teamInfo?.name || teamInfo?.team?.name,
      user_email: teamInfo?.user?.email || teamInfo?.email,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : null,
      is_active: true
    }, {
      onConflict: 'user_id,service,team_id'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error saving integration:', error)
    throw new Error('Failed to save integration')
  }

  return data.id
}

export async function updateIntegrationTokens(
  integrationId: string,
  tokenData: any
): Promise<void> {
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const { error } = await supabaseAdmin
    .from('integrations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || undefined,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', integrationId)

  if (error) {
    console.error('Error updating integration tokens:', error)
    throw new Error('Failed to update integration tokens')
  }
}

export async function getIntegration(integrationId: string) {
  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (error) {
    console.error('Error fetching integration:', error)
    return null
  }

  return data
}

export async function getUserIntegrations(userId: string, service?: IntegrationType) {
  let query = supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (service) {
    query = query.eq('service', service)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching user integrations:', error)
    return []
  }

  return data || []
}

export async function deactivateIntegration(integrationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('integrations')
    .update({ 
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', integrationId)

  if (error) {
    console.error('Error deactivating integration:', error)
    throw new Error('Failed to deactivate integration')
  }
}