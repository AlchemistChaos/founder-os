import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { generateFlashcard } from '@/lib/openai'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MeetingInsight {
  meetingTitle: string
  meetingDate: string
  participant: string
  insight: string
  context: string
  score?: number
  hasReaction?: boolean
  goalAlignment?: {
    creator_brand: number
    pulse_startup: number
    data_driven: number
    learning_secrets: number
    total_score: number
  }
}

export async function generateFlashcardsFromMeetings(
  userId: string,
  daysSinceLastGeneration: number = 15
): Promise<number> {
  try {
    console.log(`🧠 Generating flashcards from AI insights (last ${daysSinceLastGeneration} days)...`)
    
    // Get AI insights that haven't been converted to flashcards yet
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastGeneration)
    
    const { data: aiInsights, error: insightsError } = await supabaseAdmin
      .from('ai_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_flashcard', false)
      .gte('insight_generated_at', cutoffDate.toISOString())
      .gte('goal_overall_score', 15) // Only insights with decent goal relevance
      .order('goal_overall_score', { ascending: false })
      .limit(25) // Don't overwhelm with too many flashcards

    if (insightsError) {
      console.error('Error fetching AI insights:', insightsError)
      throw insightsError
    }

    if (!aiInsights || aiInsights.length === 0) {
      console.log('No AI insights found for flashcard generation')
      return 0
    }

    console.log(`Found ${aiInsights.length} AI insights to convert to flashcards`)

    // Generate flashcards from AI insights
    let createdCount = 0
    for (const insight of aiInsights) {
      const success = await createFlashcardFromAIInsight(userId, insight)
      if (success) {
        createdCount++
        
        // Mark insight as converted to flashcard
        await supabaseAdmin
          .from('ai_insights')
          .update({ 
            is_flashcard: true, 
            flashcard_created_at: new Date().toISOString() 
          })
          .eq('id', insight.id)
      }
    }

    console.log(`✅ Created ${createdCount} new flashcards from AI insights`)
    return createdCount

  } catch (error) {
    console.error('Error generating flashcards from AI insights:', error)
    throw error
  }
}

// Create a single flashcard from an AI insight
async function createFlashcardFromAIInsight(userId: string, insight: any): Promise<boolean> {
  try {
    // Generate question and answer from the AI insight using your AI agents
    const { question, answer } = await generateQuestionFromAIInsight(insight)
    
    // Check if similar flashcard already exists
    const { data: existingCards } = await supabaseAdmin
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
    const { data: entry, error: entryError } = await supabaseAdmin
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
    const { data: flashcard, error: flashcardError } = await supabaseAdmin
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
      await supabaseAdmin.from('entries').delete().eq('id', entry.id)
      return false
    }

    // Link the flashcard back to the insight
    await supabaseAdmin
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
    const { data: meeting } = await supabaseAdmin
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

// NEW: Enhanced scoring model with goal alignment
function scoreLearningInsight(text: string): { 
  score: number; 
  hasReaction: boolean; 
  isLearning: boolean;
  goalRelevance: {
    creator_brand: number;
    pulse_startup: number;
    data_driven: number;
    learning_secrets: number;
  }
} {
  const lowerText = text.toLowerCase()
  let score = 0
  let hasReaction = false
  
  // Goal relevance scoring (0-10 each)
  let goalRelevance = {
    creator_brand: 0,
    pulse_startup: 0,
    data_driven: 0,
    learning_secrets: 0
  }
  
  // CREATOR BRAND RELEVANCE
  const creatorIndicators = [
    'content', 'video', 'youtube', 'social media', 'creator', 'audience',
    'engagement', 'views', 'subscribers', 'viral', 'thumbnail', 'editing',
    'publishing', 'schedule', 'brand', 'personal brand', 'influence',
    'storytelling', 'camera', 'production', 'content calendar'
  ]
  for (const indicator of creatorIndicators) {
    if (lowerText.includes(indicator)) {
      goalRelevance.creator_brand = Math.min(10, goalRelevance.creator_brand + 3)
    }
  }
  
  // PULSE STARTUP RELEVANCE  
  const pulseIndicators = [
    'health', 'wearable', 'device', 'sensor', 'fitness', 'tracking',
    'startup', 'hardware', 'medical', 'wellness', 'biometric', 'data',
    'monitoring', 'pulse', 'heart rate', 'sleep', 'exercise', 'app',
    'healthtech', 'medtech', 'clinical', 'fda', 'regulation'
  ]
  for (const indicator of pulseIndicators) {
    if (lowerText.includes(indicator)) {
      goalRelevance.pulse_startup = Math.min(10, goalRelevance.pulse_startup + 3)
    }
  }
  
  // DATA-DRIVEN RELEVANCE
  const dataIndicators = [
    'data', 'analytics', 'metrics', 'measurement', 'tracking', 'kpi',
    'dashboard', 'insights', 'analysis', 'numbers', 'statistics', 'trend',
    'optimization', 'testing', 'experiment', 'a/b test', 'conversion',
    'funnel', 'attribution', 'roi', 'performance', 'benchmark'
  ]
  for (const indicator of dataIndicators) {
    if (lowerText.includes(indicator)) {
      goalRelevance.data_driven = Math.min(10, goalRelevance.data_driven + 3)
    }
  }
  
  // LEARNING SECRETS RELEVANCE
  const learningIndicators = [
    'secret', 'best practice', 'framework', 'methodology', 'strategy',
    'principle', 'lesson', 'insight', 'tip', 'hack', 'technique',
    'process', 'system', 'approach', 'mental model', 'pattern',
    'what works', 'avoid', 'mistake', 'experience', 'knowledge'
  ]
  for (const indicator of learningIndicators) {
    if (lowerText.includes(indicator)) {
      goalRelevance.learning_secrets = Math.min(10, goalRelevance.learning_secrets + 3)
    }
  }
  
  // REACTION INDICATORS (highest priority)
  const reactionIndicators = [
    'whoa', 'wow', 'amazing', 'incredible', 'brilliant', 'genius',
    'interesting', 'fascinating', 'surprising', 'unexpected',
    "that's smart", "that's clever", "i love that", "that's great",
    "that's useful", "that's valuable", "good point", "excellent",
    "mind blown", "never thought of that", "that makes sense",
    "how does that work", "can you explain more", "tell me more",
    "that's fascinating", "i see", "right", "exactly"
  ]
  
  for (const reaction of reactionIndicators) {
    if (lowerText.includes(reaction)) {
      score += 50 // High boost for reactions
      hasReaction = true
      break
    }
  }
  
  // FRAMEWORK/CONCEPT INDICATORS (medium-high priority)
  const frameworkIndicators = [
    'framework', 'methodology', 'approach', 'strategy', 'principle',
    'concept', 'model', 'system', 'process', 'workflow',
    'because', 'the reason', 'this works because', 'the key is',
    'pattern', 'trend', 'correlation', 'principle behind',
    'mental model', 'way of thinking', 'perspective'
  ]
  
  for (const indicator of frameworkIndicators) {
    if (lowerText.includes(indicator)) {
      score += 30
      break
    }
  }
  
  // Add goal relevance to base score
  const totalGoalRelevance = Object.values(goalRelevance).reduce((sum, score) => sum + score, 0)
  score += totalGoalRelevance * 2 // Multiply by 2 to give goal relevance significant weight
  
  // LEARNING INDICATORS (medium priority)
  const basicLearningIndicators = [
    'learned that', 'discovered that', 'found out that', 'realized that',
    'insight', 'learning', 'key takeaway', 'important to note',
    'best practice', 'lesson learned', 'experience shows',
    'tip:', 'advice:', 'recommendation:', 'what works',
    'successful approach', 'avoid doing', 'better to',
    'observation', 'understanding', 'knowledge'
  ]
  
  for (const indicator of basicLearningIndicators) {
    if (lowerText.includes(indicator)) {
      score += 20
      break
    }
  }
  
  // SUBSTANCE CHECK (required minimum)
  const isSubstantial = text.length > 20 && text.split(' ').length > 5
  if (!isSubstantial) {
    score = 0
  }
  
  // TASK/ACTION PENALTY (major deduction)
  const taskIndicators = [
    'follow up', 'send email', 'schedule', 'call them',
    'complete by', 'deadline', 'deliverable', 'task',
    'action item', 'to do', 'will do', 'responsible for',
    'meeting with', 'check with', 'reach out to',
    'update on', 'status of', 'progress on'
  ]
  
  for (const task of taskIndicators) {
    if (lowerText.includes(task)) {
      score -= 40 // Heavy penalty for task content
      break
    }
  }
  
  // LOGISTICS PENALTY (medium deduction)
  const logisticsIndicators = [
    'next meeting', 'agenda', 'calendar', 'time', 'date',
    'location', 'zoom', 'conference room', 'attendees'
  ]
  
  for (const logistics of logisticsIndicators) {
    if (lowerText.includes(logistics)) {
      score -= 20
      break
    }
  }
  
  // Enhanced threshold based on goal relevance
  const hasGoalRelevance = totalGoalRelevance >= 5
  const isLearning = (score >= 15) || hasGoalRelevance
  
  return { 
    score: Math.max(0, score), 
    hasReaction, 
    isLearning,
    goalRelevance
  }
}

