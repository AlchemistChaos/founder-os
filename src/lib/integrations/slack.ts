import { refreshAccessToken, updateIntegrationTokens } from './auth'
import { processIntegrationData } from './jobs'
import { SlackEvent, IntegrationData, SyncJob } from './types'

interface SlackAPI {
  ok: boolean
  error?: string
  response_metadata?: {
    next_cursor?: string
  }
}

interface SlackMessage {
  type: string
  text: string
  user: string
  ts: string
  thread_ts?: string
  channel?: string
  files?: any[]
  reactions?: any[]
}

interface SlackConversationsListResponse extends SlackAPI {
  channels: Array<{
    id: string
    name: string
    is_member: boolean
    is_private: boolean
  }>
}

interface SlackConversationsHistoryResponse extends SlackAPI {
  messages: SlackMessage[]
  has_more: boolean
  pin_count?: number
}

interface SlackUsersInfoResponse extends SlackAPI {
  user: {
    id: string
    name: string
    real_name: string
    profile: {
      email?: string
      display_name?: string
    }
  }
}

export async function makeSlackAPICall(
  endpoint: string,
  accessToken: string,
  params: Record<string, any> = {}
): Promise<any> {
  const url = new URL(`https://slack.com/api/${endpoint}`)
  
  // Add parameters to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value))
    }
  })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (!data.ok) {
    if (data.error === 'token_revoked' || data.error === 'invalid_auth') {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error(`Slack API error: ${data.error}`)
  }

  return data
}

export async function getSlackChannels(accessToken: string): Promise<any[]> {
  const response: SlackConversationsListResponse = await makeSlackAPICall(
    'conversations.list',
    accessToken,
    {
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 100
    }
  )

  return response.channels.filter(channel => channel.is_member)
}

export async function getSlackMessages(
  accessToken: string,
  channelId: string,
  cursor?: string,
  oldest?: string
): Promise<{ messages: SlackMessage[], nextCursor?: string }> {
  const params: any = {
    channel: channelId,
    limit: 50
  }

  if (cursor) params.cursor = cursor
  if (oldest) params.oldest = oldest

  const response: SlackConversationsHistoryResponse = await makeSlackAPICall(
    'conversations.history',
    accessToken,
    params
  )

  return {
    messages: response.messages,
    nextCursor: response.response_metadata?.next_cursor
  }
}

export async function getSlackUserInfo(
  accessToken: string,
  userId: string
): Promise<any> {
  const response: SlackUsersInfoResponse = await makeSlackAPICall(
    'users.info',
    accessToken,
    { user: userId }
  )

  return response.user
}

export async function processSlackMessage(
  message: SlackMessage,
  channelName: string,
  teamName: string,
  accessToken: string
): Promise<IntegrationData> {
  // Get user info for the message author
  let authorName = message.user
  try {
    const userInfo = await getSlackUserInfo(accessToken, message.user)
    authorName = userInfo.real_name || userInfo.name || message.user
  } catch (error) {
    console.error('Error fetching user info:', error)
  }

  // Parse timestamp
  const timestamp = new Date(parseFloat(message.ts) * 1000).toISOString()

  // Determine if this is a mention or important message
  const isImportant = message.text.includes('@here') || 
                     message.text.includes('@channel') ||
                     message.text.includes('@everyone') ||
                     message.reactions?.length > 0 ||
                     message.files?.length > 0

  // Generate source URL
  const sourceUrl = `slack://channel?team=${teamName}&id=${message.channel}&message=${message.ts}`

  return {
    id: `slack_${message.channel}_${message.ts}`,
    type: 'slack',
    content: message.text,
    source_url: sourceUrl,
    source_name: `#${channelName}`,
    metadata: {
      channel_id: message.channel,
      channel_name: channelName,
      user_id: message.user,
      thread_ts: message.thread_ts,
      is_thread: !!message.thread_ts,
      files: message.files || [],
      reactions: message.reactions || [],
      is_important: isImportant
    },
    timestamp,
    author: authorName,
    channel: channelName,
    tags: [
      'slack',
      channelName,
      ...(isImportant ? ['important'] : []),
      ...(message.thread_ts ? ['thread'] : []),
      ...(message.files?.length ? ['file'] : [])
    ]
  }
}

export async function processSlackSync(job: SyncJob, integration: any): Promise<void> {
  try {
    let accessToken = integration.access_token

    // Check if token needs refresh
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at)
      const now = new Date()
      
      if (expiresAt <= now && integration.refresh_token) {
        try {
          const tokenData = await refreshAccessToken('slack', integration.refresh_token)
          await updateIntegrationTokens(integration.id, tokenData)
          accessToken = tokenData.access_token
        } catch (error) {
          console.error('Error refreshing Slack token:', error)
          throw new Error('Failed to refresh Slack token')
        }
      }
    }

    // Get channels to sync
    const channels = await getSlackChannels(accessToken)
    
    // For incremental sync, use last sync timestamp
    const oldest = job.job_type === 'incremental_sync' && integration.last_sync_at
      ? new Date(integration.last_sync_at).getTime() / 1000
      : undefined

    const syncStartTime = new Date().toISOString()
    let processedCount = 0

    for (const channel of channels) {
      try {
        let cursor = job.job_type === 'incremental_sync' ? integration.sync_cursor : undefined
        let hasMore = true

        while (hasMore) {
          const { messages, nextCursor } = await getSlackMessages(
            accessToken,
            channel.id,
            cursor,
            oldest?.toString()
          )

          for (const message of messages) {
            // Filter out bot messages and system messages
            if (message.type !== 'message' || message.user?.startsWith('B')) {
              continue
            }

            // Skip empty messages
            if (!message.text?.trim()) {
              continue
            }

            try {
              const integrationData = await processSlackMessage(
                message,
                channel.name,
                integration.team_name || 'Slack',
                accessToken
              )

              await processIntegrationData(integrationData, integration.user_id)
              processedCount++
            } catch (error) {
              console.error(`Error processing Slack message ${message.ts}:`, error)
              // Continue processing other messages
            }
          }

          cursor = nextCursor
          hasMore = !!nextCursor && messages.length > 0

          // Rate limiting: pause between requests
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error(`Error syncing Slack channel ${channel.name}:`, error)
        // Continue with other channels
      }
    }

    // Update integration sync status
    const { createClient } = await import('@supabase/supabase-js')
    const { Database } = await import('@/lib/database.types')
    
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabaseAdmin
      .from('integrations')
      .update({
        last_sync_at: syncStartTime,
        sync_cursor: undefined, // Reset cursor for next sync
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)

    console.log(`Slack sync completed. Processed ${processedCount} messages.`)

  } catch (error) {
    console.error('Error in Slack sync:', error)
    throw error
  }
}

export async function handleSlackEvent(event: SlackEvent, integration: any): Promise<void> {
  if (!event.event) return

  const slackEvent = event.event

  // Only process message events
  if (slackEvent.type !== 'message') return

  // Skip bot messages
  if (slackEvent.user?.startsWith('B')) return

  // Skip empty messages
  if (!slackEvent.text?.trim()) return

  try {
    // Get channel info
    const channelInfo = await makeSlackAPICall(
      'conversations.info',
      integration.access_token,
      { channel: slackEvent.channel }
    )

    const integrationData = await processSlackMessage(
      {
        type: 'message',
        text: slackEvent.text!,
        user: slackEvent.user!,
        ts: slackEvent.ts!,
        thread_ts: slackEvent.thread_ts,
        channel: slackEvent.channel,
        files: slackEvent.files || []
      },
      channelInfo.channel.name,
      integration.team_name || 'Slack',
      integration.access_token
    )

    await processIntegrationData(integrationData, integration.user_id)
    
    console.log(`Processed Slack webhook event: ${slackEvent.ts}`)
  } catch (error) {
    console.error('Error processing Slack webhook event:', error)
    throw error
  }
}