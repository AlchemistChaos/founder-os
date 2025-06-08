import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-utils'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { extractAndRefineLearningInsights, generateFlashcard } from '@/lib/openai'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Allow testing mode to bypass auth
    const url = new URL(request.url)
    const isTestMode = url.searchParams.get('test') === 'true'
    
    let user
    if (isTestMode) {
      // Use the correct user ID that owns the meetings
      user = { id: '04d47b62-bba7-4526-a0f6-42ba34999de1' }
    } else {
      user = await getUser(request)
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { id: meetingId } = await params

    // Get the meeting with its content and transcript data
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        meeting_date,
        overview,
        action_items,
        keywords,
        topics,
        questions,
        tasks
      `)
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Get transcript segments for more detailed analysis
    const { data: transcriptSegments } = await supabase
      .from('meeting_transcripts')
      .select('speaker_name, text_content, start_time_seconds')
      .eq('meeting_id', meetingId)
      .order('start_time_seconds')

    // Prepare the structured content for AI analysis
    const meetingContent = `
MEETING TITLE: ${meeting.title}
DATE: ${new Date(meeting.meeting_date).toLocaleDateString()}
DURATION: ${Math.round((transcriptSegments?.length || 0) * 0.5)} minutes (estimated)

OVERVIEW:
${meeting.overview || 'No overview available'}

ACTION ITEMS:
${Array.isArray(meeting.action_items) ? meeting.action_items.join('\n') : meeting.action_items || 'No action items'}

KEYWORDS: ${meeting.keywords?.join(', ') || 'None'}
TOPICS: ${meeting.topics?.join(', ') || 'None'}
QUESTIONS: ${meeting.questions?.join('\n') || 'None'}
TASKS: ${meeting.tasks?.join('\n') || 'None'}
`.trim()

    // Build full transcript if available
    let fullTranscript = ''
    if (transcriptSegments && transcriptSegments.length > 0) {
      fullTranscript = transcriptSegments
        .map(segment => `[${Math.floor(segment.start_time_seconds / 60)}:${(segment.start_time_seconds % 60).toString().padStart(2, '0')}] ${segment.speaker_name}: ${segment.text_content}`)
        .join('\n')
    }

    console.log('🎯 Starting goal-aligned 3-agent learning insight extraction...')
    
    // CRITICAL: Validate content sufficiency to prevent AI hallucination
    const hasTranscriptContent = fullTranscript && fullTranscript.trim().length > 100
    const hasMetadata = meeting.overview && meeting.overview.trim().length > 20
    const hasActionItems = meeting.action_items && meeting.action_items.length > 0
    const hasKeywords = meeting.keywords && meeting.keywords.length > 0
    
    const contentSufficiency = {
      transcript: hasTranscriptContent,
      metadata: hasMetadata, 
      actionItems: hasActionItems,
      keywords: hasKeywords,
      score: (hasTranscriptContent ? 3 : 0) + (hasMetadata ? 1 : 0) + (hasActionItems ? 1 : 0) + (hasKeywords ? 1 : 0)
    }
    
    
    // Require minimum content to prevent hallucination
    if (contentSufficiency.score < 2 || (!hasTranscriptContent && !hasMetadata)) {
      console.log('⚠️ Insufficient content for reliable insight generation')
      return NextResponse.json({
        success: true,
        insights: [],
        summary: `This meeting appears to have limited recorded content. The transcript contains ${transcriptSegments?.length || 0} segments with ${fullTranscript.length} characters. For reliable insights, we need substantive conversation content or detailed meeting metadata.`,
        top_insights: [],
        goal_analysis: {
          total_insights: 0,
          high_priority_count: 0,
          reaction_count: 0,
          content_insufficient: true,
          content_score: contentSufficiency.score,
          transcript_length: fullTranscript.length,
          segments_count: transcriptSegments?.length || 0
        },
        cached: false
      })
    }
    
          try {
        // Extract goal-aligned insights using the 3-agent pipeline
        const aiInsights = await extractAndRefineLearningInsights(meetingContent, fullTranscript)

      // CONFIDENCE VALIDATION: Additional check for hallucination
      const validateInsights = (insights: any[]) => {
        return insights.filter(insight => {
          // Check if insight has proper grounding indicators
          const hasContext = insight.context && insight.context.length > 100
          const hasImplementation = insight.how_to_implement && insight.how_to_implement.length > 50
          const hasReasonableScores = insight.goal_relevance && 
            Object.values(insight.goal_relevance).some((score: any) => typeof score === 'number' && score > 0)
          
          // Flag suspicious insights
          const suspiciousIndicators = [
            insight.context && insight.context.includes('discussed'),
            insight.context && insight.context.includes('mentioned'),
            !insight.context || insight.context.length < 50,
            !hasImplementation,
            !hasReasonableScores
          ].filter(Boolean).length
          
          // Require strong grounding
          return hasContext && hasImplementation && hasReasonableScores && suspiciousIndicators < 2
        })
      }
      
      // Validate insights before storage
      const validatedInsights = validateInsights(aiInsights.refinedInsights || [])
      const filteredCount = (aiInsights.refinedInsights?.length || 0) - validatedInsights.length
      
      if (filteredCount > 0) {
      }
      
      console.log('✅ Extracted insights with goal alignment:', validatedInsights.length, 'high-priority')
      console.log('✅ Extracted', validatedInsights.length, 'goal-aligned insights')

      // Structure the response with goal relevance data
      const structuredInsights = validatedInsights.map((insight, index) => ({
        insight: insight.text,
        category: insight.goal_relevance.overall_score >= 25 ? 'high-priority' : 
                 insight.goal_relevance.overall_score >= 15 ? 'medium-priority' : 'learning',
        context: insight.context,
        how_to_implement: insight.how_to_implement,
        relevance: insight.context,
        reaction: insight.reaction,
        interest_level: insight.interest_level,
        priority: insight.goal_relevance.overall_score >= 25 ? 'high' : 
                 insight.goal_relevance.overall_score >= 15 ? 'medium' : 'low',
        goal_alignment: {
          creator_brand: insight.goal_relevance.creator_brand,
          pulse_startup: insight.goal_relevance.pulse_startup,
          data_driven: insight.goal_relevance.data_driven,
          learning_secrets: insight.goal_relevance.learning_secrets,
          overall_score: insight.goal_relevance.overall_score
        },
        priority_reason: insight.priority_reason
      }))

      // Sort insights by goal relevance score (highest first)
      structuredInsights.sort((a, b) => {
        // First prioritize reactions
        if (a.reaction && !b.reaction) return -1
        if (!a.reaction && b.reaction) return 1
        // Then by goal alignment score
        return b.goal_alignment.overall_score - a.goal_alignment.overall_score
      })

      console.log(`✅ Extracted ${structuredInsights.length} goal-aligned insights`)
      console.log(`🎯 High-priority insights: ${structuredInsights.filter(i => i.priority === 'high').length}`)
      console.log(`🔥 Reaction-based insights: ${structuredInsights.filter(i => i.reaction).length}`)

      // Store insights in database for flashcard generation
      await storeAIInsights(user.id, meetingId, structuredInsights)

      return NextResponse.json({
        success: true,
        insights: structuredInsights,
        summary: aiInsights.finalInsights.summary,
        top_insights: aiInsights.finalInsights.top_insights,
        goal_analysis: {
          total_insights: structuredInsights.length,
          high_priority_count: structuredInsights.filter(i => i.priority === 'high').length,
          reaction_count: structuredInsights.filter(i => i.reaction).length,
          avg_creator_relevance: Math.round(structuredInsights.reduce((sum, i) => sum + i.goal_alignment.creator_brand, 0) / structuredInsights.length),
          avg_pulse_relevance: Math.round(structuredInsights.reduce((sum, i) => sum + i.goal_alignment.pulse_startup, 0) / structuredInsights.length),
          avg_data_relevance: Math.round(structuredInsights.reduce((sum, i) => sum + i.goal_alignment.data_driven, 0) / structuredInsights.length),
          avg_learning_relevance: Math.round(structuredInsights.reduce((sum, i) => sum + i.goal_alignment.learning_secrets, 0) / structuredInsights.length)
        },
        agent_data: {
          initial_count: aiInsights.initialInsights.length,
          refined_count: aiInsights.refinedInsights.length,
                     high_goal_alignment_count: aiInsights.refinedInsights.filter((i: any) => i.goal_relevance.overall_score >= 20).length
        },
        cached: false
      })

    } catch (aiError) {
      console.error('AI processing failed, falling back to basic extraction:', aiError)
      
      // Enhanced fallback with goal relevance estimation
      const fallbackInsights = generateGoalAwareFallbackInsights(meetingContent)
      
      return NextResponse.json({
        success: true,
        insights: fallbackInsights,
        summary: 'AI processing temporarily unavailable. Goal-aware insights generated from content analysis.',
        top_insights: fallbackInsights.filter(i => i.priority === 'high').map(i => i.insight).slice(0, 3),
        goal_analysis: {
          fallback: true,
          error: aiError instanceof Error ? aiError.message : 'Unknown AI error'
        },
        cached: false
      })
    }

  } catch (error) {
    console.error('Error generating insights:', error)
    return NextResponse.json({ 
      error: 'Failed to generate insights',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Enhanced fallback function with goal awareness
function generateGoalAwareFallbackInsights(content: string) {
  const insights = []
  const lowerContent = content.toLowerCase()
  
  // Creator brand insights
  if (lowerContent.includes('content') || lowerContent.includes('video') || lowerContent.includes('social') || lowerContent.includes('youtube')) {
    insights.push({
      insight: "Content creation strategy and social media growth tactics discussed",
      category: "high-priority",
      context: "Directly applicable to building creator brand and content scaling",
      how_to_implement: "1. Analyze current content performance metrics\n2. Identify top-performing content patterns\n3. Create content calendar based on successful formats\n4. Implement A/B testing for optimization\n5. Scale winning content strategies",
      relevance: "Directly applicable to building creator brand and content scaling",
      reaction: false,
      interest_level: "high",
      priority: "high",
      goal_alignment: {
        creator_brand: 8,
        pulse_startup: 3,
        data_driven: 5,
        learning_secrets: 6,
        overall_score: 22
      },
      priority_reason: "High relevance to creator brand building goals"
    })
  }
  
  // Pulse startup insights
  if (lowerContent.includes('health') || lowerContent.includes('wearable') || lowerContent.includes('device') || lowerContent.includes('startup')) {
    insights.push({
      insight: "Health technology and wearable device strategies shared",
      category: "high-priority", 
      context: "Critical insights for Pulse startup development and growth",
      how_to_implement: "1. Research current health tech market trends\n2. Identify key user pain points in wearable devices\n3. Develop MVP based on insights shared\n4. Test with target user segments\n5. Iterate based on user feedback",
      relevance: "Critical insights for Pulse startup development and growth",
      reaction: false,
      interest_level: "high",
      priority: "high",
      goal_alignment: {
        creator_brand: 2,
        pulse_startup: 9,
        data_driven: 4,
        learning_secrets: 6,
        overall_score: 21
      },
      priority_reason: "Directly relevant to Pulse healthtech startup goals"
    })
  }
  
  // Data-driven insights
  if (lowerContent.includes('data') || lowerContent.includes('analytics') || lowerContent.includes('metrics') || lowerContent.includes('measurement')) {
    insights.push({
      insight: "Data-driven decision making approaches and analytics strategies discussed",
      category: "high-priority",
      context: "Essential for becoming more data-driven across all business aspects",
      how_to_implement: "1. Set up comprehensive analytics tracking\n2. Define key metrics for each business area\n3. Create data collection processes\n4. Build reporting dashboards\n5. Establish data-driven decision frameworks",
      relevance: "Essential for becoming more data-driven across all business aspects",
      reaction: false,
      interest_level: "high", 
      priority: "high",
      goal_alignment: {
        creator_brand: 6,
        pulse_startup: 6,
        data_driven: 9,
        learning_secrets: 7,
        overall_score: 28
      },
      priority_reason: "High alignment with data-driven business objectives"
    })
  }
  
  // Learning and best practices
  if (lowerContent.includes('strategy') || lowerContent.includes('framework') || lowerContent.includes('process') || lowerContent.includes('best practice')) {
    insights.push({
      insight: "Strategic frameworks and best practices for business execution",
      category: "medium-priority",
      context: "Valuable learning for systematic business improvement",
      how_to_implement: "1. Document current business processes\n2. Identify improvement opportunities\n3. Research best practices in relevant areas\n4. Create implementation timeline\n5. Test and iterate on new frameworks",
      relevance: "Valuable learning for systematic business improvement",
      reaction: false,
      interest_level: "medium",
      priority: "medium",
      goal_alignment: {
        creator_brand: 5,
        pulse_startup: 5,
        data_driven: 6,
        learning_secrets: 8,
        overall_score: 24
      },
      priority_reason: "Strong alignment with learning and best practices goals"
    })
  }
  
  // Default insight if no goal-specific keywords found
  if (insights.length === 0) {
    insights.push({
      insight: "General business discussion with potential learning opportunities",
      category: "learning",
      context: "May contain insights relevant to entrepreneurial growth",
      how_to_implement: "1. Review meeting content for hidden insights\n2. Identify applicable strategies\n3. Adapt learnings to current business context\n4. Create action plan for implementation\n5. Monitor results and adjust approach",
      relevance: "May contain insights relevant to entrepreneurial growth",
      reaction: false,
      interest_level: "low",
      priority: "low",
      goal_alignment: {
        creator_brand: 3,
        pulse_startup: 3,
        data_driven: 3,
        learning_secrets: 4,
        overall_score: 13
      },
      priority_reason: "General business content with moderate learning value"
    })
  }
  
  return insights
}

// Store AI-generated insights in database
async function storeAIInsights(userId: string, meetingId: string, insights: any[]) {
  try {
    console.log(`💾 Storing ${insights.length} AI insights to database...`)
    
    const insightsToStore = insights.map(insight => ({
      user_id: userId,
      meeting_id: meetingId,
      insight_text: insight.insight,
      context: insight.context,
      category: insight.category,
      relevance: insight.how_to_implement,
      reaction: insight.reaction || false,
      interest_level: insight.interest_level,
      priority: insight.priority,
      priority_reason: insight.priority_reason,
      goal_creator_brand: insight.goal_alignment.creator_brand,
      goal_pulse_startup: insight.goal_alignment.pulse_startup,
      goal_data_driven: insight.goal_alignment.data_driven,
      goal_learning_secrets: insight.goal_alignment.learning_secrets,
      goal_overall_score: insight.goal_alignment.overall_score,
      is_flashcard: false,
      insight_generated_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('ai_insights')
      .insert(insightsToStore)
      .select('id')

    if (error) {
      console.error('Error storing AI insights:', error)
      throw error
    }

    console.log(`✅ Successfully stored ${data?.length || 0} AI insights`)
    
    // Trigger automatic flashcard generation for high-priority insights
    await createFlashcardsFromStoredInsights(userId, meetingId)
    
  } catch (error) {
    console.error('Failed to store AI insights:', error)
    // Don't throw - insights API should still work even if storage fails
  }
}

// Create flashcards from newly stored insights
async function createFlashcardsFromStoredInsights(userId: string, meetingId: string) {
  try {
    console.log(`🧠 Creating flashcards from stored insights for meeting ${meetingId}...`)
    
    // Get high-priority insights that haven't been converted to flashcards yet
    const { data: insights, error } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('meeting_id', meetingId)
      .eq('is_flashcard', false)
      .gte('goal_overall_score', 15) // Only insights with decent goal relevance
      .order('goal_overall_score', { ascending: false })
      .limit(10) // Don't overwhelm with too many flashcards

    if (error) {
      console.error('Error fetching insights for flashcard creation:', error)
      return
    }

    if (!insights || insights.length === 0) {
      console.log('No suitable insights found for flashcard creation')
      return
    }

    let flashcardsCreated = 0
    
    for (const insight of insights) {
      const success = await createFlashcardFromAIInsight(userId, insight)
      if (success) {
        flashcardsCreated++
        
        // Mark insight as converted to flashcard
        await supabase
          .from('ai_insights')
          .update({ 
            is_flashcard: true, 
            flashcard_created_at: new Date().toISOString() 
          })
          .eq('id', insight.id)
      }
    }

    console.log(`✅ Created ${flashcardsCreated} flashcards from AI insights`)
    
  } catch (error) {
    console.error('Failed to create flashcards from insights:', error)
  }
}

// Create a single flashcard from an AI insight
async function createFlashcardFromAIInsight(userId: string, insight: any): Promise<boolean> {
  try {
    // Generate question and answer from the AI insight using your AI agents
    const { question, answer } = await generateQuestionFromAIInsight(insight)
    
    // Check if similar flashcard already exists
    const { data: existingCards } = await supabase
      .from('flashcards')
      .select('id')
      .eq('user_id', userId)
      .ilike('question', `%${question.substring(0, 30)}%`)
      .limit(1)

    if (existingCards && existingCards.length > 0) {
      console.log('Similar flashcard already exists, skipping...')
      return false
    }

    // Create entry first with AI insight metadata
    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .insert({
        user_id: userId,
        type: 'ai-insight',
        content: insight.insight_text,
        metadata: {
          insight_id: insight.id,
          meeting_id: insight.meeting_id,
          category: insight.category,
          priority: insight.priority,
          goal_alignment: {
            creator_brand: insight.goal_creator_brand,
            pulse_startup: insight.goal_pulse_startup,
            data_driven: insight.goal_data_driven,
            learning_secrets: insight.goal_learning_secrets,
            overall_score: insight.goal_overall_score
          },
          reaction: insight.reaction,
          ai_generated: true
        },
        tags: ['ai-insight', 'auto-generated', insight.priority, insight.category],
        timestamp: insight.insight_generated_at,
        is_flashcard: true,
        source_name: `AI Insight`,
        source_url: null,
        related_goal_ids: []
      })
      .select('id')
      .single()

    if (entryError) {
      console.error('Error creating entry for AI insight:', entryError)
      return false
    }

    // Calculate initial due date based on priority and reaction
    const dueDate = new Date()
    if (insight.reaction) {
      dueDate.setHours(dueDate.getHours() + 2) // 2 hours for reaction-based insights
    } else if (insight.priority === 'high') {
      dueDate.setHours(dueDate.getHours() + 6) // 6 hours for high priority
    } else {
      dueDate.setDate(dueDate.getDate() + 1) // 1 day for medium/low priority
    }

    // Create flashcard with priority-based scheduling
    const { data: flashcard, error: flashcardError } = await supabase
      .from('flashcards')
      .insert({
        user_id: userId,
        entry_id: entry.id,
        question,
        answer,
        due_at: dueDate.toISOString(),
        ease_factor: insight.reaction ? 2.8 : (insight.priority === 'high' ? 2.6 : 2.5),
        interval: insight.reaction ? 0.1 : (insight.priority === 'high' ? 0.25 : 1),
        repetition_count: 0
      })
      .select('id')
      .single()

    if (flashcardError) {
      console.error('Error creating flashcard from AI insight:', flashcardError)
      // Clean up entry if flashcard creation failed
      await supabase.from('entries').delete().eq('id', entry.id)
      return false
    }

    // Link the flashcard back to the insight
    await supabase
      .from('ai_insights')
      .update({ flashcard_id: flashcard.id })
      .eq('id', insight.id)

    console.log(`✅ Created flashcard from AI insight: "${question.substring(0, 50)}..."`)
    return true

  } catch (error) {
    console.error('Error creating flashcard from AI insight:', error)
    return false
  }
}

// Generate question and answer from AI insight using existing AI agents
async function generateQuestionFromAIInsight(insight: any): Promise<{ question: string, answer: string }> {
  try {
    // Get meeting context for richer flashcard generation
    const { data: meeting } = await supabase
      .from('meetings')
      .select('title, meeting_date')
      .eq('id', insight.meeting_id)
      .single()

    // Extract speaker names from context if available
    const speakers = insight.context ? extractSpeakerNames(insight.context) : []
    const speakerList = speakers.length > 0 ? speakers.join(', ') : 'the conversation'

    // Determine topic based on goal alignment
    let topic = 'business learning'
    if (insight.goal_creator_brand >= 7) {
      topic = 'creator brand building'
    } else if (insight.goal_pulse_startup >= 7) {
      topic = 'health tech startup strategy'
    } else if (insight.goal_data_driven >= 7) {
      topic = 'data-driven decision making'
    } else if (insight.goal_learning_secrets >= 7) {
      topic = 'business best practices'
    }

    // Determine difficulty based on priority and reaction
    let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
    if (insight.reaction || insight.priority === 'high') {
      difficulty = 'advanced' // High engagement content deserves advanced questions
    } else if (insight.priority === 'low') {
      difficulty = 'beginner'
    }

    // Create rich context for the AI prompt
    const meetingTitle = meeting?.title || 'your meeting'
    const meetingDate = meeting?.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString() : ''
    
    const enrichedContent = `
MEETING CONTEXT:
- Meeting: "${meetingTitle}" ${meetingDate ? `on ${meetingDate}` : ''}
- Participants/Speakers: ${speakerList}
- Priority Level: ${insight.priority}
- Your Reaction: ${insight.reaction ? 'You found this particularly interesting/exciting' : 'Standard insight'}

TRANSCRIPT CONTEXT:
${insight.context || 'No specific transcript context available'}

KEY INSIGHT:
${insight.insight_text}

IMPLEMENTATION GUIDANCE:
${insight.relevance || 'No specific implementation guidance provided'}
`

    // Use your existing AI agent to generate the flashcard with rich context
    const aiFlashcard = await generateFlashcard({
      content: enrichedContent,
      topic,
      difficulty
    })

    return {
      question: aiFlashcard.question,
      answer: aiFlashcard.answer
    }

  } catch (error) {
    console.error('AI flashcard generation failed, using fallback:', error)
    
    // Enhanced fallback questions with context
    const fallbackQuestion = insight.reaction 
      ? `What breakthrough insight from your meeting got you excited?`
      : `What was the key learning from your meeting?`
    
    return {
      question: fallbackQuestion,
      answer: insight.insight_text
    }
  }
}

// Helper function to extract speaker names from context
function extractSpeakerNames(context: string): string[] {
  const speakerPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):/g
  const matches = context.match(speakerPattern)
  if (!matches) return []
  
  const speakers = matches.map(match => match.replace(':', '').trim())
  return [...new Set(speakers)] // Remove duplicates
} 