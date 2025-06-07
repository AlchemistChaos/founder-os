import { NextRequest, NextResponse } from 'next/server'
import { syncFirefliesData } from '@/lib/integrations/fireflies-enhanced'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'dev-secret'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🤖 Starting automated Fireflies sync...')

    // Get all active Fireflies integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .eq('service', 'fireflies')
      .eq('is_active', true)

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active Fireflies integrations found',
        processed: 0 
      })
    }

    let totalProcessed = 0

    // Sync each integration
    for (const integration of integrations) {
      try {
        console.log(`🔄 Syncing integration ${integration.id}`)
        
        const processedCount = await syncFirefliesData(
          integration.user_id,
          process.env.FIREFLIES_API_KEY!,
          integration.id
        )

        totalProcessed += processedCount
        console.log(`✅ Synced ${processedCount} meetings for integration ${integration.id}`)

      } catch (error) {
        console.error(`❌ Error syncing integration ${integration.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Automated sync completed for ${integrations.length} integrations`,
      totalProcessed,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Cron sync error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// For manual testing
export async function GET() {
  return NextResponse.json({
    message: 'Fireflies sync cron endpoint',
    usage: 'POST with Authorization: Bearer [CRON_SECRET]',
    note: 'This endpoint is designed to be called by automated schedulers'
  })
} 