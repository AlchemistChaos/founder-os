import { refreshAccessToken, updateIntegrationTokens } from './auth'
import { processIntegrationData } from './jobs'
import { LinearEvent, IntegrationData, SyncJob } from './types'

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string
  state: {
    id: string
    name: string
    type: string
  }
  assignee?: {
    id: string
    name: string
    email: string
  }
  team: {
    id: string
    name: string
    key: string
  }
  labels: {
    nodes: Array<{
      id: string
      name: string
      color: string
    }>
  }
  priority: number
  estimate?: number
  createdAt: string
  updatedAt: string
  url: string
  creator: {
    id: string
    name: string
    email: string
  }
  comments: {
    nodes: Array<{
      id: string
      body: string
      createdAt: string
      user: {
        name: string
        email: string
      }
    }>
  }
}

interface LinearResponse {
  data: any
  errors?: any[]
}

export async function makeLinearAPICall(
  query: string,
  variables: Record<string, any> = {},
  accessToken: string
): Promise<any> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status} ${response.statusText}`)
  }

  const data: LinearResponse = await response.json()
  
  if (data.errors) {
    // Check for token expiration
    const hasAuthError = data.errors.some(error => 
      error.message?.includes('authentication') || 
      error.message?.includes('unauthorized')
    )
    
    if (hasAuthError) {
      throw new Error('TOKEN_EXPIRED')
    }
    
    throw new Error(`Linear GraphQL error: ${data.errors[0].message}`)
  }

  return data.data
}

export async function getLinearIssues(
  accessToken: string,
  after?: string,
  updatedSince?: string
): Promise<{ issues: LinearIssue[], hasNextPage: boolean, endCursor?: string }> {
  const query = `
    query GetIssues($after: String, $updatedSince: DateTime) {
      issues(
        first: 50
        after: $after
        filter: {
          updatedAt: { gte: $updatedSince }
        }
        orderBy: updatedAt
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          identifier
          title
          description
          state {
            id
            name
            type
          }
          assignee {
            id
            name
            email
          }
          team {
            id
            name
            key
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          priority
          estimate
          createdAt
          updatedAt
          url
          creator {
            id
            name
            email
          }
          comments {
            nodes {
              id
              body
              createdAt
              user {
                name
                email
              }
            }
          }
        }
      }
    }
  `

  const variables: any = {}
  if (after) variables.after = after
  if (updatedSince) variables.updatedSince = updatedSince

  const data = await makeLinearAPICall(query, variables, accessToken)
  
  return {
    issues: data.issues.nodes,
    hasNextPage: data.issues.pageInfo.hasNextPage,
    endCursor: data.issues.pageInfo.endCursor
  }
}

export async function getLinearTeams(accessToken: string): Promise<any[]> {
  const query = `
    query GetTeams {
      teams {
        nodes {
          id
          name
          key
          description
        }
      }
    }
  `

  const data = await makeLinearAPICall(query, {}, accessToken)
  return data.teams.nodes
}

export async function processLinearIssue(issue: LinearIssue): Promise<IntegrationData> {
  // Build content from issue details
  let content = `${issue.title}`
  
  if (issue.description) {
    content += `\n\n${issue.description}`
  }

  // Add recent comments
  if (issue.comments.nodes.length > 0) {
    content += '\n\nRecent Comments:'
    issue.comments.nodes.slice(-3).forEach(comment => {
      content += `\n- ${comment.user.name}: ${comment.body}`
    })
  }

  // Determine tags
  const tags = [
    'linear',
    issue.team.key.toLowerCase(),
    issue.state.name.toLowerCase().replace(/\s+/g, '-'),
    ...issue.labels.nodes.map(label => label.name.toLowerCase().replace(/\s+/g, '-'))
  ]

  // Add priority tag
  if (issue.priority > 0) {
    const priorityNames = ['', 'urgent', 'high', 'medium', 'low']
    tags.push(`priority-${priorityNames[issue.priority] || 'unknown'}`)
  }

  // Add assignee tag
  if (issue.assignee) {
    tags.push('assigned')
  }

  return {
    id: `linear_${issue.id}`,
    type: 'linear',
    content,
    source_url: issue.url,
    source_name: `${issue.team.name} - ${issue.identifier}`,
    metadata: {
      issue_id: issue.id,
      identifier: issue.identifier,
      team_id: issue.team.id,
      team_name: issue.team.name,
      team_key: issue.team.key,
      state_id: issue.state.id,
      state_name: issue.state.name,
      state_type: issue.state.type,
      assignee_id: issue.assignee?.id,
      assignee_name: issue.assignee?.name,
      assignee_email: issue.assignee?.email,
      creator_name: issue.creator.name,
      creator_email: issue.creator.email,
      priority: issue.priority,
      estimate: issue.estimate,
      labels: issue.labels.nodes,
      comment_count: issue.comments.nodes.length
    },
    timestamp: issue.updatedAt,
    author: issue.assignee?.name || issue.creator.name,
    tags
  }
}

export async function processLinearSync(job: SyncJob, integration: any): Promise<void> {
  try {
    let accessToken = integration.access_token

    // Check if token needs refresh (Linear tokens typically don't expire, but handle it anyway)
    if (integration.token_expires_at && integration.refresh_token) {
      const expiresAt = new Date(integration.token_expires_at)
      const now = new Date()
      
      if (expiresAt <= now) {
        try {
          const tokenData = await refreshAccessToken('linear', integration.refresh_token)
          await updateIntegrationTokens(integration.id, tokenData)
          accessToken = tokenData.access_token
        } catch (error) {
          console.error('Error refreshing Linear token:', error)
          throw new Error('Failed to refresh Linear token')
        }
      }
    }

    // For incremental sync, use last sync timestamp
    const updatedSince = job.job_type === 'incremental_sync' && integration.last_sync_at
      ? integration.last_sync_at
      : undefined

    const syncStartTime = new Date().toISOString()
    let processedCount = 0
    let cursor = job.job_type === 'incremental_sync' ? integration.sync_cursor : undefined
    let hasMore = true

    while (hasMore) {
      try {
        const { issues, hasNextPage, endCursor } = await getLinearIssues(
          accessToken,
          cursor,
          updatedSince
        )

        for (const issue of issues) {
          try {
            const integrationData = await processLinearIssue(issue)
            await processIntegrationData(integrationData, integration.user_id)
            processedCount++
          } catch (error) {
            console.error(`Error processing Linear issue ${issue.identifier}:`, error)
            // Continue processing other issues
          }
        }

        cursor = endCursor
        hasMore = hasNextPage

        // Rate limiting: pause between requests
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error('Error fetching Linear issues:', error)
        break
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
        sync_cursor: cursor,
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)

    console.log(`Linear sync completed. Processed ${processedCount} issues.`)

  } catch (error) {
    console.error('Error in Linear sync:', error)
    throw error
  }
}

export async function handleLinearWebhook(event: LinearEvent, integration: any): Promise<void> {
  try {
    // Only process issue-related events
    if (!event.data || !event.data.id) return

    // Convert webhook data to issue-like format
    const issue: Partial<LinearIssue> = {
      id: event.data.id,
      identifier: event.data.title ? `${event.data.team?.name || 'ISSUE'}-${event.data.id.slice(-4)}` : event.data.id,
      title: event.data.title || 'Issue Update',
      description: event.data.description,
      state: event.data.state ? {
        id: event.data.state.name,
        name: event.data.state.name,
        type: 'state'
      } : {
        id: 'unknown',
        name: 'Unknown',
        type: 'state'
      },
      assignee: event.data.assignee ? {
        id: event.data.assignee.email,
        name: event.data.assignee.name,
        email: event.data.assignee.email
      } : undefined,
      team: event.data.team ? {
        id: event.data.team.name,
        name: event.data.team.name,
        key: event.data.team.name.toUpperCase()
      } : {
        id: 'unknown',
        name: 'Unknown Team',
        key: 'UNK'
      },
      labels: { nodes: event.data.labels?.map(label => ({
        id: label.name,
        name: label.name,
        color: '#000000'
      })) || [] },
      priority: event.data.priority || 0,
      createdAt: event.createdAt,
      updatedAt: event.data.updatedAt || event.createdAt,
      url: event.data.url || `https://linear.app/issue/${event.data.id}`,
      creator: {
        id: 'webhook',
        name: 'Linear Webhook',
        email: 'webhook@linear.app'
      },
      comments: { nodes: [] }
    }

    const integrationData = await processLinearIssue(issue as LinearIssue)
    
    // Add webhook-specific metadata
    integrationData.metadata.webhook_action = event.action
    integrationData.metadata.webhook_type = event.type
    integrationData.tags.push('webhook', event.action)

    await processIntegrationData(integrationData, integration.user_id)
    
    console.log(`Processed Linear webhook event: ${event.action} on ${event.data.id}`)
  } catch (error) {
    console.error('Error processing Linear webhook event:', error)
    throw error
  }
}