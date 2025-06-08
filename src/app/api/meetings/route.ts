import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { apiCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import { apiCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check cache first
    const cacheKey = `${CACHE_KEYS.MEETINGS}:${user.id}`
    const cachedData = apiCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Check cache first
    const cacheKey = `meetings:${user.id}`
    const cachedData = apiCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get meetings with participants
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        meeting_date,
        duration_seconds,
        overview,
        action_items,
        keywords,
        tags,
        fireflies_id,
        created_at,
        source_integration_id
      `)
      .eq('user_id', user.id)
      .order('meeting_date', { ascending: false })

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Get participants for each meeting
    const meetingIds = meetings?.map(m => m.id) || []
    const { data: participants } = await supabase
      .from('meeting_participants')
      .select('meeting_id, name, email, is_external')
      .in('meeting_id', meetingIds)

    // Add participants to meetings
    const meetingsWithParticipants = meetings?.map(meeting => {
      const meetingParticipants = participants?.filter(p => p.meeting_id === meeting.id) || []
      return {
        ...meeting,
        participants: meetingParticipants,
        participant_count: meetingParticipants.length,
        duration_minutes: Math.round((meeting.duration_seconds || 0) / 60),
        source: meeting.source_integration_id ? 'fireflies' : 'manual'
      }
    }) || []

    const responseData = {
      success: true,
      meetings: meetingsWithParticipants,
      total: meetingsWithParticipants.length
    }

    // Cache the response
    apiCache.set(cacheKey, responseData, CACHE_TTL.MEETINGS)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 