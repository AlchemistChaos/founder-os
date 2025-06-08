import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { createLinearAPI, processLinearIssues } from '@/lib/integrations/linear-api'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LINEAR_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LINEAR_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Get all users who have Linear integrations
    const { data: integrations, error: integrationsError } = await supabaseAdmin
      .from('integrations')
      .select('user_id')
      .eq('service', 'linear')
      .eq('is_active', true)

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError)
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      )
    }

    const linear = createLinearAPI(apiKey)
    const results = []

    for (const integration of integrations) {
      try {
        console.log(`Syncing Linear data for user: ${integration.user_id}`)
        
        // Get latest issues
        const issues = await linear.getIssues(undefined, 50)
        
        if (issues.length > 0) {
          // Process issues into FounderOS entries format
          const entries = processLinearIssues(issues)
          
          // Add user_id to each entry
          const entriesWithUser = entries.map(entry => ({
            ...entry,
            user_id: integration.user_id
          }))

          // Insert entries into database
          // First, check for existing entries to avoid duplicates
          const existingEntries = await supabaseAdmin
            .from('entries')
            .select('source_url')
            .eq('user_id', integration.user_id)
            .in('source_url', entriesWithUser.map(e => e.source_url))

          const existingUrls = new Set(existingEntries.data?.map(e => e.source_url) || [])
          const newEntries = entriesWithUser.filter(entry => !existingUrls.has(entry.source_url))

          let insertError = null
          if (newEntries.length > 0) {
            const result = await supabaseAdmin
              .from('entries')
              .insert(newEntries)
            insertError = result.error
          }

          if (insertError) {
            console.error(`Database error for user ${integration.user_id}:`, insertError)
            results.push({
              user_id: integration.user_id,
              success: false,
              error: insertError.message
            })
            continue
          }

          // Update integration record
          await supabaseAdmin
            .from('integrations')
            .update({
              last_sync_at: new Date().toISOString(),
              config: {
                api_key_configured: true,
                last_sync_count: newEntries.length,
                last_sync_type: 'scheduled'
              }
            })
            .eq('user_id', integration.user_id)
            .eq('service', 'linear')

          results.push({
            user_id: integration.user_id,
            success: true,
            synced: newEntries.length,
            duplicates_skipped: entriesWithUser.length - newEntries.length
          })
        } else {
          results.push({
            user_id: integration.user_id,
            success: true,
            synced: 0,
            message: 'No issues found'
          })
        }

      } catch (error) {
        console.error(`Error syncing for user ${integration.user_id}:`, error)
        results.push({
          user_id: integration.user_id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0)

    return NextResponse.json({
      success: true,
      message: `Scheduled sync completed for ${successCount}/${integrations.length} users`,
      total_synced: totalSynced,
      results: results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scheduled Linear sync failed:', error)
    return NextResponse.json(
      { 
        error: 'Scheduled sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check when the next sync should run
export async function GET(request: NextRequest) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Calculate next sync times (8:30am and 9:30pm)
  const morningSync = new Date(today)
  morningSync.setHours(8, 30, 0, 0)
  
  const eveningSync = new Date(today)
  eveningSync.setHours(21, 30, 0, 0)
  
  // If both times have passed today, calculate for tomorrow
  const nextMorning = new Date(morningSync)
  const nextEvening = new Date(eveningSync)
  
  if (now > eveningSync) {
    nextMorning.setDate(nextMorning.getDate() + 1)
    nextEvening.setDate(nextEvening.getDate() + 1)
  }
  
  const nextSync = now < morningSync ? morningSync : 
                   now < eveningSync ? eveningSync : nextMorning

  return NextResponse.json({
    current_time: now.toISOString(),
    next_sync: nextSync.toISOString(),
    sync_times: {
      morning: '08:30',
      evening: '21:30'
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })
} 