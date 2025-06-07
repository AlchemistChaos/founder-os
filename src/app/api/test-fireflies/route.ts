import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { syncFirefliesData } from '@/lib/integrations/fireflies-enhanced'
import type { Database } from '@/lib/database.types'

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

    // Get Fireflies API key from environment
    const apiKey = process.env.FIREFLIES_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Fireflies API key not configured' },
        { status: 400 }
      )
    }

    console.log('Starting Fireflies data import...')
    
    // Create a mock integration ID for testing
    const mockIntegrationId = '550e8400-e29b-41d4-a716-446655440001'
    
    // Sync data from Fireflies
    const processedCount = await syncFirefliesData(
      user.id,
      mockIntegrationId,
      apiKey
    )

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${processedCount} meetings from Fireflies`,
      processed_count: processedCount
    })

  } catch (error) {
    console.error('Error in Fireflies import:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
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

    // Get meeting count from database
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: meetings, error } = await supabaseAdmin
      .from('meetings')
      .select('id, title, meeting_date, duration_minutes, participant_count:meeting_participants(count)')
      .eq('user_id', user.id)
      .order('meeting_date', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching meetings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch meetings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      meetings: meetings || [],
      total_count: meetings?.length || 0
    })

  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}