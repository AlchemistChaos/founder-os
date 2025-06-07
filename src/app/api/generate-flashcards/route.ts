import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { generateFlashcardsFromMeetings } from '@/lib/flashcard-generator'

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

    const body = await request.json().catch(() => ({}))
    const days = body.days || 15

    console.log(`Generating flashcards from last ${days} days for user ${user.id}`)
    
    const createdCount = await generateFlashcardsFromMeetings(user.id, days)

    return NextResponse.json({
      success: true,
      message: `Generated ${createdCount} flashcards from meeting insights`,
      created_count: createdCount,
      days_processed: days
    })

  } catch (error) {
    console.error('Error generating flashcards:', error)
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

    // Get flashcard generation stats
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Count total flashcards
    const { data: totalCards, error: totalError } = await supabaseAdmin
      .from('flashcards')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)

    // Count meeting-based flashcards (created from insights)
    const { data: meetingEntries } = await supabaseAdmin
      .from('entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'meeting')
      .eq('is_flashcard', true)

    const entryIds = meetingEntries?.map(e => e.id) || []
    
    const { data: meetingCards, error: meetingError } = await supabaseAdmin
      .from('flashcards')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .in('entry_id', entryIds)

    // Get recent flashcards
    const { data: recentCards, error: recentError } = await supabaseAdmin
      .from('flashcards')
      .select(`
        id,
        question,
        created_at,
        entries!inner(
          source_name,
          tags
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      total_flashcards: totalCards?.length || 0,
      meeting_flashcards: meetingCards?.length || 0,
      recent_flashcards: recentCards || []
    })

  } catch (error) {
    console.error('Error fetching flashcard stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 