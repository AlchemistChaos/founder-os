import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, question, answer } = await request.json()

    if (!id || !question?.trim() || !answer?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: id, question, and answer are required' 
      }, { status: 400 })
    }

    // Verify the flashcard exists and belongs to the user
    const { data: existingCard, error: fetchError } = await supabase
      .from('flashcards')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingCard) {
      return NextResponse.json({ 
        error: 'Flashcard not found or access denied' 
      }, { status: 404 })
    }

    // Update the flashcard
    const { data: updatedCard, error: updateError } = await supabase
      .from('flashcards')
      .update({
        question: question.trim(),
        answer: answer.trim()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating flashcard:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update flashcard' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      flashcard: updatedCard,
      message: 'Flashcard updated successfully'
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 