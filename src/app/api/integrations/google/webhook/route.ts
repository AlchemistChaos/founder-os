import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { GoogleDriveEvent } from '@/lib/integrations/types'
import { createSyncJob } from '@/lib/integrations/jobs'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Google Drive webhooks are sent as headers, not body
    const channelId = request.headers.get('x-goog-channel-id')
    const resourceId = request.headers.get('x-goog-resource-id')
    const resourceUri = request.headers.get('x-goog-resource-uri')
    const eventType = request.headers.get('x-goog-resource-state')
    const token = request.headers.get('x-goog-channel-token')

    if (!channelId || !resourceId || !eventType) {
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 })
    }

    // Only process 'update' events (file changes)
    if (eventType !== 'update') {
      return NextResponse.json({ ok: true })
    }

    const event: GoogleDriveEvent = {
      kind: 'api#channel',
      id: channelId,
      type: eventType,
      resourceId: resourceId!,
      resourceUri: resourceUri || '',
      token: token || ''
    }

    // Find the integration that set up this webhook
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('service', 'google')
      .eq('webhook_url', `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/webhook`)
      .eq('is_active', true)
      .single()

    if (error || !integration) {
      console.error('No active Google integration found for webhook:', channelId)
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Create a webhook job for processing
    await createSyncJob(integration.id, 'webhook_event', {
      event_type: 'google_webhook',
      event_data: event
    })

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Google webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}