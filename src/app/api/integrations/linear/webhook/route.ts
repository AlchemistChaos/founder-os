import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { LinearEvent } from '@/lib/integrations/types'
import { createSyncJob } from '@/lib/integrations/jobs'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify webhook signature (recommended for production)
    const linearSignature = request.headers.get('linear-signature')
    
    if (!linearSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // In production, you should verify the signature:
    // const isValid = verifyLinearSignature(body, linearSignature)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const event: LinearEvent = body

    // Only process issue-related events
    if (!event.type || !event.type.startsWith('Issue')) {
      return NextResponse.json({ ok: true })
    }

    // Find active Linear integrations and create jobs for each
    const { data: integrations, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('service', 'linear')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching Linear integrations:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Create webhook jobs for all active Linear integrations
    for (const integration of integrations) {
      await createSyncJob(integration.id, 'webhook_event', {
        event_type: 'linear_webhook',
        event_data: event
      })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Linear webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to verify Linear signature (implement in production)
function verifyLinearSignature(body: any, signature: string): boolean {
  // This is a simplified version - implement proper verification in production
  // https://developers.linear.app/docs/webhooks#webhook-signature-verification
  return true
}