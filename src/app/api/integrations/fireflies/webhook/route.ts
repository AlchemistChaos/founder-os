import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { createSyncJob } from '@/lib/integrations/jobs'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify webhook signature (recommended for production)
    const firefliesSignature = request.headers.get('x-fireflies-signature')
    
    if (!firefliesSignature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // In production, you should verify the signature:
    // const isValid = verifyFirefliesSignature(body, firefliesSignature)
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    // Only process transcript completion events
    if (body.event_type !== 'transcript_ready') {
      return NextResponse.json({ ok: true })
    }

    // Find active Fireflies integrations and create jobs for each
    const { data: integrations, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('service', 'fireflies')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching Fireflies integrations:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Create webhook jobs for all active Fireflies integrations
    for (const integration of integrations) {
      await createSyncJob(integration.id, 'webhook_event', {
        event_type: 'fireflies_webhook',
        event_data: body
      })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Fireflies webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to verify Fireflies signature (implement in production)
function verifyFirefliesSignature(body: any, signature: string): boolean {
  // This is a simplified version - implement proper verification in production
  return true
}