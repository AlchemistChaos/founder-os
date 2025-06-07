import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { createSyncJob } from '@/lib/integrations/jobs'
import { getUser } from '@/lib/auth-utils'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    const { integration_id, sync_type = 'incremental_sync' } = await request.json()

    if (!integration_id) {
      return NextResponse.json(
        { error: 'Integration ID required' },
        { status: 400 }
      )
    }

    // Verify user owns this integration
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('id', integration_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Create sync job
    const jobId = await createSyncJob(integration_id, sync_type, {
      manual_trigger: true,
      triggered_by: user.id
    })

    return NextResponse.json({ 
      success: true,
      job_id: jobId,
      message: 'Sync job created successfully'
    })

  } catch (error) {
    console.error('Error creating sync job:', error)
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

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integration_id')

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID required' },
        { status: 400 }
      )
    }

    // Get recent sync jobs for this integration
    const { data: jobs, error } = await supabaseAdmin
      .from('sync_jobs')
      .select('*')
      .eq('integration_id', integrationId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching sync jobs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sync jobs' },
        { status: 500 }
      )
    }

    // Verify user owns the integration
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('user_id')
      .eq('id', integrationId)
      .single()

    if (integrationError || !integration || integration.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ jobs })

  } catch (error) {
    console.error('Error fetching sync jobs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}