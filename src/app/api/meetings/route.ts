import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

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

    return NextResponse.json({
      success: true,
      meetings: meetingsWithParticipants,
      total: meetingsWithParticipants.length
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 