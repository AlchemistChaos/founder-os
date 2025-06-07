import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { handleSlackEvent } from '@/lib/integrations/slack'
import { SlackEvent } from '@/lib/integrations/types'
import { createSyncJob } from '@/lib/integrations/jobs'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Handle Slack challenge for webhook verification
    if (body.challenge) {
      return NextResponse.json({ challenge: body.challenge })
    }

    // Verify webhook signature (recommended for production)
    const slackSignature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')
    
    if (!slackSignature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // In production, you should verify the signature:
    // const isValid = verifySlackSignature(body, slackSignature, timestamp)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const event: SlackEvent = body

    // Skip retry events to avoid duplicates
    if (request.headers.get('x-slack-retry-num')) {
      return NextResponse.json({ ok: true })
    }

    // Find the integration for this team
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('service', 'slack')
      .eq('team_id', event.team_id)
      .eq('is_active', true)
      .single()

    if (error || !integration) {
      console.error('No active Slack integration found for team:', event.team_id)
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Create a webhook job for processing
    await createSyncJob(integration.id, 'webhook_event', {
      event_type: 'slack_webhook',
      event_data: event
    })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Slack webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to verify Slack signature (implement in production)
function verifySlackSignature(body: any, signature: string, timestamp: string): boolean {
  // This is a simplified version - implement proper verification in production
  // https://api.slack.com/authentication/verifying-requests-from-slack
  return true
}