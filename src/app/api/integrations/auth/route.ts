import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { buildAuthUrl, getOAuthConfig } from '@/lib/integrations/auth'
import { IntegrationType } from '@/lib/integrations/types'
import { getUser } from '@/lib/auth-utils'

const supabaseAdmin = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { service } = await request.json()

    if (!service || !['slack', 'linear', 'google', 'fireflies'].includes(service)) {
      return NextResponse.json(
        { error: 'Invalid service' },
        { status: 400 }
      )
    }

    // Check if we're in demo mode (no real OAuth credentials)
    const config = getOAuthConfig(service as IntegrationType)
    if (config.clientId === 'demo-client-id') {
      return NextResponse.json(
        { 
          error: 'Demo mode: OAuth credentials not configured. Please set up your OAuth credentials in environment variables to test the actual integration flows.' 
        },
        { status: 400 }
      )
    }

    // Generate state for OAuth flow (includes user ID for security)
    const state = Buffer.from(
      JSON.stringify({
        user_id: user.id,
        service,
        timestamp: Date.now()
      })
    ).toString('base64')

    // Build OAuth URL
    const authUrl = buildAuthUrl(service as IntegrationType, state)

    return NextResponse.json({ 
      auth_url: authUrl,
      state 
    })

  } catch (error) {
    console.error('Error initiating OAuth:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if Supabase is configured
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        integrations: [],
        message: 'Database not configured'
      })
    }

    // Get user's integrations
    const { data: integrations, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching integrations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      )
    }

    // Remove sensitive data before returning
    const sanitizedIntegrations = integrations.map(integration => ({
      ...integration,
      access_token: undefined,
      refresh_token: undefined
    }))

    return NextResponse.json({ integrations: sanitizedIntegrations })

  } catch (error) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if Supabase is configured
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('id')

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID required' },
        { status: 400 }
      )
    }

    // Deactivate the integration
    const { error } = await supabaseAdmin
      .from('integrations')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId)
      .eq('user_id', user.id) // Ensure user owns this integration

    if (error) {
      console.error('Error deactivating integration:', error)
      return NextResponse.json(
        { error: 'Failed to deactivate integration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deactivating integration:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}