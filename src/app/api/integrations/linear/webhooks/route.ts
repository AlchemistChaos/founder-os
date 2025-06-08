import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Create Linear webhook via GraphQL API
async function createLinearWebhook(url: string, teamId?: string, allPublicTeams: boolean = false) {
  const mutation = `
    mutation WebhookCreate($input: WebhookCreateInput!) {
      webhookCreate(input: $input) {
        success
        webhook {
          id
          url
          enabled
          label
          resourceTypes
          team {
            id
            name
          }
        }
        error {
          message
        }
      }
    }
  `

  const input: any = {
    url,
    label: 'FounderOS Integration',
    resourceTypes: ['Issue', 'Comment', 'Project', 'Cycle']
  }

  if (allPublicTeams) {
    input.allPublicTeams = true
  } else if (teamId) {
    input.teamId = teamId
  } else {
    throw new Error('Either teamId or allPublicTeams must be specified')
  }

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input }
    })
  })

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${data.errors[0].message}`)
  }

  return data.data.webhookCreate
}

// List existing webhooks
async function listLinearWebhooks() {
  const query = `
    query {
      webhooks {
        nodes {
          id
          url
          enabled
          label
          resourceTypes
          team {
            id
            name
            key
          }
          creator {
            name
            email
          }
          createdAt
        }
      }
    }
  `

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${data.errors[0].message}`)
  }

  return data.data.webhooks.nodes
}

// Delete webhook
async function deleteLinearWebhook(webhookId: string) {
  const mutation = `
    mutation WebhookDelete($id: String!) {
      webhookDelete(id: $id) {
        success
      }
    }
  `

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: mutation,
      variables: { id: webhookId }
    })
  })

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${data.errors[0].message}`)
  }

  return data.data.webhookDelete
}

// GET - List existing webhooks
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    if (!process.env.LINEAR_API_KEY) {
      return NextResponse.json({ 
        error: 'Linear API key not configured. Please set LINEAR_API_KEY environment variable.' 
      }, { status: 400 })
    }

    const webhooks = await listLinearWebhooks()
    
    return NextResponse.json({
      success: true,
      webhooks
    })
    
  } catch (error: any) {
    console.error('Error listing Linear webhooks:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list webhooks' },
      { status: 500 }
    )
  }
}

// POST - Create new webhook
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    if (!process.env.LINEAR_API_KEY) {
      return NextResponse.json({ 
        error: 'Linear API key not configured. Please set LINEAR_API_KEY environment variable.' 
      }, { status: 400 })
    }

    const body = await request.json()
    const { teamId, allPublicTeams = false } = body

    // Construct webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/linear/webhook`

    const result = await createLinearWebhook(webhookUrl, teamId, allPublicTeams)
    
    if (result.success) {
      // Store webhook info in database
      const { error } = await supabaseAdmin
        .from('linear_webhooks')
        .insert({
          user_id: user.id,
          webhook_id: result.webhook.id,
          url: result.webhook.url,
          team_id: result.webhook.team?.id,
          team_name: result.webhook.team?.name,
          resource_types: result.webhook.resourceTypes,
          enabled: result.webhook.enabled,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error storing webhook in database:', error)
      }

      return NextResponse.json({
        success: true,
        webhook: result.webhook
      })
    } else {
      return NextResponse.json({
        error: result.error?.message || 'Failed to create webhook'
      }, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('Error creating Linear webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create webhook' },
      { status: 500 }
    )
  }
}

// DELETE - Remove webhook
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('id')

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID is required' }, { status: 400 })
    }

    if (!process.env.LINEAR_API_KEY) {
      return NextResponse.json({ 
        error: 'Linear API key not configured. Please set LINEAR_API_KEY environment variable.' 
      }, { status: 400 })
    }

    const result = await deleteLinearWebhook(webhookId)
    
    if (result.success) {
      // Remove from database
      const { error } = await supabaseAdmin
        .from('linear_webhooks')
        .delete()
        .eq('webhook_id', webhookId)

      if (error) {
        console.error('Error removing webhook from database:', error)
      }

      return NextResponse.json({
        success: true,
        message: 'Webhook deleted successfully'
      })
    } else {
      return NextResponse.json({
        error: 'Failed to delete webhook'
      }, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('Error deleting Linear webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete webhook' },
      { status: 500 }
    )
  }
} 