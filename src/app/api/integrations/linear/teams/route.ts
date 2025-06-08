import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { getLinearTeams, makeLinearAPICall } from '@/lib/integrations/linear'
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
      // Fetch teams from Linear
      const teams = await getLinearTeams(integration.access_token)
      
      return NextResponse.json({
        success: true,
        teams
      })
      
    } catch (error: any) {
      // Handle token expiration
      if (error.message === 'TOKEN_EXPIRED' && integration.refresh_token) {
        try {
          const newTokens = await refreshAccessToken('linear', integration.refresh_token)
          await updateIntegrationTokens(integration.id, newTokens)
          
          // Retry with new token
          const teams = await getLinearTeams(newTokens.access_token)
          
          return NextResponse.json({
            success: true,
            teams
          })
          
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          return NextResponse.json({ error: 'Authentication failed - please reconnect Linear' }, { status: 401 })
        }
      }
      
      throw error
    }

  } catch (error) {
    console.error('Linear teams API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    )
  }
} 