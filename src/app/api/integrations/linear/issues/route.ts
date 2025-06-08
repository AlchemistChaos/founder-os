import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { getLinearIssues, makeLinearAPICall } from '@/lib/integrations/linear'
import { refreshAccessToken, updateIntegrationTokens } from '@/lib/integrations/auth'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get user from Supabase JWT
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

    // Get user's Linear integration
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service', 'linear')
      .eq('is_active', true)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Linear integration not found' }, { status: 404 })
    }

    if (!integration.access_token) {
      return NextResponse.json({ error: 'No access token available' }, { status: 400 })
    }

    try {
      // Get query parameters
      const { searchParams } = new URL(request.url)
      const after = searchParams.get('after') || undefined
      const limit = parseInt(searchParams.get('limit') || '10')
      
      // Fetch issues from Linear (recent issues from last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const result = await getLinearIssues(
        integration.access_token,
        after,
        thirtyDaysAgo.toISOString()
      )
      
      return NextResponse.json({
        success: true,
        issues: result.issues.slice(0, limit),
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor
      })
      
    } catch (error: any) {
      // Handle token expiration
      if (error.message === 'TOKEN_EXPIRED' && integration.refresh_token) {
        try {
          const newTokens = await refreshAccessToken('linear', integration.refresh_token)
          await updateIntegrationTokens(integration.id, newTokens)
          
          // Retry with new token
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          
          const result = await getLinearIssues(
            newTokens.access_token,
            undefined,
            thirtyDaysAgo.toISOString()
          )
          
          return NextResponse.json({
            success: true,
            issues: result.issues.slice(0, 10),
            hasNextPage: result.hasNextPage,
            endCursor: result.endCursor
          })
          
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          return NextResponse.json({ error: 'Authentication failed - please reconnect Linear' }, { status: 401 })
        }
      }
      
      throw error
    }

  } catch (error) {
    console.error('Linear issues API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user from Supabase JWT
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

    // Get user's Linear integration
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('service', 'linear')
      .eq('is_active', true)
      .single()

    if (error || !integration) {
      return NextResponse.json({ error: 'Linear integration not found' }, { status: 404 })
    }

    if (!integration.access_token) {
      return NextResponse.json({ error: 'No access token available' }, { status: 400 })
    }

    const body = await request.json()
    const { title, description, teamId, priority = 0, labelIds = [] } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    try {
      // Create issue in Linear
      const mutation = `
        mutation CreateIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
              url
            }
            error {
              message
            }
          }
        }
      `

      const variables = {
        input: {
          title,
          description,
          teamId,
          priority,
          labelIds
        }
      }

      const result = await makeLinearAPICall(mutation, variables, integration.access_token)
      
      if (result.issueCreate.success) {
        return NextResponse.json({
          success: true,
          issue: result.issueCreate.issue
        })
      } else {
        return NextResponse.json({
          error: result.issueCreate.error?.message || 'Failed to create issue'
        }, { status: 400 })
      }
      
    } catch (error: any) {
      // Handle token expiration
      if (error.message === 'TOKEN_EXPIRED' && integration.refresh_token) {
        try {
          const newTokens = await refreshAccessToken('linear', integration.refresh_token)
          await updateIntegrationTokens(integration.id, newTokens)
          
          // Retry with new token
          const mutation = `
            mutation CreateIssue($input: IssueCreateInput!) {
              issueCreate(input: $input) {
                success
                issue {
                  id
                  identifier
                  title
                  url
                }
                error {
                  message
                }
              }
            }
          `

          const variables = {
            input: {
              title,
              description,
              teamId,
              priority,
              labelIds
            }
          }

          const result = await makeLinearAPICall(mutation, variables, newTokens.access_token)
          
          if (result.issueCreate.success) {
            return NextResponse.json({
              success: true,
              issue: result.issueCreate.issue
            })
          } else {
            return NextResponse.json({
              error: result.issueCreate.error?.message || 'Failed to create issue'
            }, { status: 400 })
          }
          
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          return NextResponse.json({ error: 'Authentication failed - please reconnect Linear' }, { status: 401 })
        }
      }
      
      throw error
    }

  } catch (error) {
    console.error('Linear create issue API error:', error)
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    )
  }
} 