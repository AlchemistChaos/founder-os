import { NextRequest, NextResponse } from 'next/server'
import { generateFlashcard } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { content, topic, difficulty } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const flashcard = await generateFlashcard({
      content,
      topic,
      difficulty: difficulty || 'intermediate'
    })

    return NextResponse.json(flashcard)
  } catch (error) {
    console.error('Flashcard generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate flashcard' },
      { status: 500 }
    )
  }
}