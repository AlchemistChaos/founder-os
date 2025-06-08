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
    const { user_id, days = 7 } = await request.json()
    
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.LINEAR_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LINEAR_API_KEY not configured' },
        { status: 500 }
      )
    }

    const linear = createLinearAPI(apiKey)
    
    // Get recent issues (simplified approach)
    console.log(`Fetching latest Linear issues...`)
    const issues = await linear.getIssues(undefined, 50)
    
    if (issues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No recent issues found',
        synced: 0
      })
    }

    // Process issues into FounderOS entries format
    const entries = processLinearIssues(issues)
    
    // Add user_id to each entry
    const entriesWithUser = entries.map(entry => ({
      ...entry,
      user_id
    }))

    console.log(`Processing ${entriesWithUser.length} Linear issues...`)

    // Insert entries into database
    // First, check for existing entries to avoid duplicates
    const existingEntries = await supabaseAdmin
      .from('entries')
      .select('source_url')
      .eq('user_id', user_id)
      .in('source_url', entriesWithUser.map(e => e.source_url))

    const existingUrls = new Set(existingEntries.data?.map(e => e.source_url) || [])
    const newEntries = entriesWithUser.filter(entry => !existingUrls.has(entry.source_url))

    let data = null
    let error = null

    if (newEntries.length > 0) {
      const result = await supabaseAdmin
        .from('entries')
        .insert(newEntries)
        .select()
      
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save entries to database', details: error.message },
        { status: 500 }
      )
    }

    // Update integration record
    const { error: integrationError } = await supabaseAdmin
      .from('integrations')
      .upsert({
        user_id,
        service: 'linear',
        is_active: true,
        last_sync_at: new Date().toISOString(),
        config: {
          api_key_configured: true,
          last_sync_count: newEntries.length
        }
      }, {
        onConflict: 'user_id,service'
      })

    if (integrationError) {
      console.warn('Failed to update integration record:', integrationError)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${newEntries.length} Linear issues (${existingUrls.size} duplicates skipped)`,
      synced: newEntries.length,
      duplicates_skipped: existingUrls.size,
      issues: issues.map(issue => ({
        identifier: issue.identifier,
        title: issue.title,
        team: issue.team.name,
        state: issue.state.name
      }))
    })

  } catch (error) {
    console.error('Linear sync failed:', error)
    return NextResponse.json(
      { 
        error: 'Linear sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id parameter is required' },
        { status: 400 }
      )
    }

    // Get Linear integration status
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', user_id)
      .eq('service', 'linear')
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to check integration status' },
        { status: 500 }
      )
    }

    // Get count of Linear entries
    const { count, error: countError } = await supabaseAdmin
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('type', 'linear')

    if (countError) {
      return NextResponse.json(
        { error: 'Failed to count Linear entries' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      integration: integration || null,
      linear_entries_count: count || 0,
      api_configured: !!process.env.LINEAR_API_KEY
    })

  } catch (error) {
    console.error('Linear sync status check failed:', error)
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    )
  }
} 