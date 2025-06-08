import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { apiCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

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

    // Create cache key with user ID and reset parameter
    const cacheKey = `${CACHE_KEYS.FLASHCARDS}:${user.id}:${todayReset}`
    const cachedData = apiCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

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
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      query = query.gte('created_at', today.toISOString())
    } else {
      // Get flashcards due for review
      const now = new Date().toISOString()
      query = query.lte('due_at', now)
    }

    const { data: flashcards, error } = await query
      .order('due_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const responseData = {
      flashcards: flashcards || [],
      count: flashcards?.length || 0
    }

    // Cache the response (shorter TTL since flashcards update frequently)
    apiCache.set(cacheKey, responseData, CACHE_TTL.FLASHCARDS)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Flashcards API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch flashcards',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
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