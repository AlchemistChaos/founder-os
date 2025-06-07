import { NextRequest, NextResponse } from 'next/server'
import { summarizeContent } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    const { content, type, maxLength } = await request.json()

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const summary = await summarizeContent({
      content,
      type: type || 'general',
      maxLength: maxLength || 200
    })

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}