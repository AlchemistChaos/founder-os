import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Spaced repetition algorithm (SM-2)
function calculateNextInterval(rating: 'easy' | 'medium' | 'hard', easeFactor: number, interval: number, repetitionCount: number) {
  let newEaseFactor = easeFactor
  let newInterval = interval
  let newRepetitionCount = repetitionCount + 1

  // Adjust ease factor based on rating
  switch (rating) {
    case 'hard':
      newEaseFactor = Math.max(1.3, easeFactor - 0.2)
      newInterval = 1 // Reset to 1 day for hard cards
      newRepetitionCount = 0 // Reset repetition count
      break
    case 'medium':
      newEaseFactor = Math.max(1.3, easeFactor - 0.15)
      if (newRepetitionCount === 1) {
        newInterval = 1
      } else if (newRepetitionCount === 2) {
        newInterval = 6
      } else {
        newInterval = Math.round(interval * newEaseFactor)
      }
      break
    case 'easy':
      newEaseFactor = easeFactor + 0.1
      if (newRepetitionCount === 1) {
        newInterval = 1
      } else if (newRepetitionCount === 2) {
        newInterval = 6
      } else {
        newInterval = Math.round(interval * newEaseFactor)
      }
      break
  }

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitionCount: newRepetitionCount
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const todayReset = searchParams.get('today') === 'true'
    console.log('API called with todayReset:', todayReset)

    // Get flashcards that are due for review (or all today's flashcards in reset mode)
    let query = supabase
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

    if (todayReset) {
      // Get all flashcards created today
      const today = new Date().toISOString().split('T')[0] // Get YYYY-MM-DD format
      console.log('Looking for flashcards created today:', `${today}T00:00:00.000Z`)
      query = query.gte('created_at', `${today}T00:00:00.000Z`)
    } else {
      // Normal mode: only due cards
      const now = new Date().toISOString()
      console.log('Looking for flashcards due before:', now)
      query = query.or(`due_at.lte.${now},due_at.is.null`)
    }

    const { data: flashcards, error: flashcardsError } = await query
      .order('created_at', { ascending: false })

    console.log('Found flashcards:', flashcards?.length || 0)
    if (flashcardsError) {
      console.error('Error fetching flashcards:', flashcardsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Format flashcards for the frontend
    const formattedFlashcards = flashcards?.map(card => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      difficulty: 'medium' as const, // This is just for the interface
      source_meeting_id: card.meeting_id,
      source_meeting_title: card.meetings?.title || 'Meeting',
      created_at: card.created_at
    })) || []

    return NextResponse.json({
      success: true,
      flashcards: formattedFlashcards,
      total: formattedFlashcards.length,
      todayReset
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { flashcardId, rating } = await request.json()

    if (!flashcardId || !rating || !['easy', 'medium', 'hard'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Get current flashcard data
    const { data: flashcard, error: fetchError } = await supabase
      .from('flashcards')
      .select('ease_factor, interval, repetition_count')
      .eq('id', flashcardId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !flashcard) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 })
    }

    // Calculate next review date using spaced repetition
    const { easeFactor, interval, repetitionCount } = calculateNextInterval(
      rating,
      flashcard.ease_factor || 2.5,
      flashcard.interval || 1,
      flashcard.repetition_count || 0
    )

    const now = new Date()
    const dueAt = new Date(now.getTime() + (interval * 24 * 60 * 60 * 1000))

    // Update flashcard with new spaced repetition data
    const { error: updateError } = await supabase
      .from('flashcards')
      .update({
        ease_factor: easeFactor,
        interval: interval,
        repetition_count: repetitionCount,
        last_reviewed_at: now.toISOString(),
        due_at: dueAt.toISOString()
      })
      .eq('id', flashcardId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating flashcard:', updateError)
      return NextResponse.json({ error: 'Failed to update flashcard' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      nextDue: dueAt.toISOString(),
      interval: interval,
      easeFactor: easeFactor
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 