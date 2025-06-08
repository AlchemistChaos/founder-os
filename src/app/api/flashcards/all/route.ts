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

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '9')
    const offset = (page - 1) * limit

    // Get total count
    const { count } = await supabase
      .from('flashcards')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Get paginated flashcards with all necessary data
    const { data: flashcards, error: flashcardsError } = await supabase
      .from('flashcards')
      .select(`
        id,
        question,
        answer,
        ease_factor,
        interval,
        repetition_count,
        last_reviewed_at,
        due_at,
        created_at,
        meeting_id,
        meetings(title)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (flashcardsError) {
      console.error('Error fetching flashcards:', flashcardsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Format flashcards for the frontend
    const formattedFlashcards = flashcards?.map(card => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      ease_factor: card.ease_factor || 2.5,
      interval: card.interval || 1,
      repetition_count: card.repetition_count || 0,
      last_reviewed_at: card.last_reviewed_at,
      due_at: card.due_at,
      created_at: card.created_at,
      source_meeting_id: card.meeting_id,
      source_meeting_title: card.meetings?.title || 'Meeting'
    })) || []

    return NextResponse.json({
      success: true,
      flashcards: formattedFlashcards,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 