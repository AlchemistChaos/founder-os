import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface SummarizationRequest {
  content: string
  type: 'meeting' | 'document' | 'slack' | 'general'
  maxLength?: number
}

export interface FlashcardGenerationRequest {
  content: string
  topic?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
}

export interface TaggingRequest {
  content: string
  existingTags?: string[]
}

// New interfaces for enhanced goal-aligned system
export interface LearningInsight {
  text: string
  context: string
  how_to_implement: string // Step-by-step breakdown of exactly how to do it
  reaction: boolean
  interest_level?: 'high' | 'medium' | 'low'
  goal_relevance?: {
    creator_brand: number // 0-10 score for creator/content goals
    pulse_startup: number // 0-10 score for Pulse/healthtech goals  
    data_driven: number // 0-10 score for data-driven business goals
    learning_secrets: number // 0-10 score for learning best practices
  }
}

export interface RefinedInsight {
  text: string
  context: string
  how_to_implement: string // Step-by-step breakdown of exactly how to do it
  reaction: boolean
  interest_level: 'high' | 'medium' | 'low'
  goal_relevance: {
    creator_brand: number
    pulse_startup: number
    data_driven: number
    learning_secrets: number
    overall_score: number
  }
  priority_reason: string
}

export interface FinalInsights {
  summary: string
  top_insights: string[]
}

// Updated user goals for context
const USER_GOALS = {
  creator_brand: "Build a creator-led brand to become the biggest social media creator in the world through high volume, high quality content",
  pulse_startup: "Build a billion dollar startup 'Pulse' - wearable/healthtech company selling 1M devices, known as the best health company globally", 
  data_driven: "Be data-driven in all business aspects: ideation, planning, execution, review, scaling, sales",
  learning_secrets: "Learn and remember all secrets and best practices through FounderOS for achieving the above goals"
}

export async function summarizeContent({
  content,
  type,
  maxLength = 200
}: SummarizationRequest): Promise<string> {
  const systemPrompts = {
    meeting: `You are an expert at summarizing meeting transcripts. Extract the key decisions, action items, and insights. Focus on what matters most for a busy founder.`,
    document: `You are an expert at summarizing documents. Extract the main points, key insights, and actionable takeaways. Be concise but comprehensive.`,
    slack: `You are an expert at summarizing Slack conversations. Extract the key information, decisions, and action items. Filter out noise and focus on business-relevant content.`,
    general: `You are an expert at creating concise, useful summaries. Extract the most important information that would be valuable for future reference.`
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${systemPrompts[type]} Keep summaries under ${maxLength} words.`
        },
        {
          role: 'user',
          content: `Please summarize the following content:\n\n${content}`
        }
      ],
      max_tokens: Math.min(maxLength * 2, 500),
      temperature: 0.3,
    })

    return response.choices[0]?.message?.content || 'Summary unavailable'
  } catch (error) {
    console.error('Error summarizing content:', error)
    throw new Error('Failed to generate summary')
  }
}

export async function generateFlashcard({
  content,
  topic,
  difficulty = 'intermediate'
}: FlashcardGenerationRequest): Promise<{ question: string; answer: string; tags: string[] }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at creating educational flashcards for business leaders and founders.

CRITICAL: Transform the provided insight/content into a clear flashcard that tests retention of that specific learning.

Your job:
1. EXTRACT the key learning/insight from the content
2. CREATE a question that tests understanding of that specific insight
3. PROVIDE the insight as the answer (enhanced for clarity if needed)

Difficulty level: ${difficulty}
${topic ? `Focus area: ${topic}` : ''}

FLASHCARD CREATION RULES:
- Question should test recall of the specific insight provided
- Answer should be the insight itself (possibly enhanced for clarity)
- Don't create generic questions - make them specific to the exact learning
- Focus on actionable knowledge and frameworks
- Make questions engaging and memory-friendly

Return your response as JSON with this exact format:
{
  "question": "Specific question testing the provided insight",
  "answer": "The insight/learning from the content (enhanced for clarity)", 
  "tags": ["relevant", "tags", "here"]
}`
        },
        {
          role: 'user',
          content: `Create a flashcard from this content:\n\n${content}`
        }
      ],
      max_tokens: 300,
      temperature: 0.4,
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from API')

    return JSON.parse(result)
  } catch (error) {
    console.error('Error generating flashcard:', error)
    throw new Error('Failed to generate flashcard')
  }
}

export async function generateTags({
  content,
  existingTags = []
}: TaggingRequest): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at categorizing and tagging business content. 
          Generate 3-5 relevant tags that help organize and find this content later.
          Use lowercase, hyphenated format (e.g., "customer-acquisition", "product-strategy").
          ${existingTags.length > 0 ? `Consider these existing tags: ${existingTags.join(', ')}` : ''}
          
          Return only a JSON array of strings: ["tag1", "tag2", "tag3"]`
        },
        {
          role: 'user',
          content: `Generate tags for this content:\n\n${content}`
        }
      ],
      max_tokens: 100,
      temperature: 0.3,
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from API')

    return JSON.parse(result)
  } catch (error) {
    console.error('Error generating tags:', error)
    // Fallback to basic tags if AI fails
    return ['general', 'business']
  }
}

// DEPRECATED: Legacy function - replaced by 3-agent system
export async function extractInsights(
  entries: Array<{ content: string; type: string; timestamp: string }>
): Promise<{ insights: string[]; patterns: string[]; recommendations: string[] }> {
  console.warn('extractInsights is deprecated. Use the new 3-agent system: extractLearningInsights -> refineInsights -> finalizeLearningInsights')
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert business analyst helping a founder understand patterns and insights from their daily activities.
          Analyze the provided entries and extract:
          1. Key insights about the business
          2. Patterns you notice
          3. Actionable recommendations
          
          Return as JSON with this format:
          {
            "insights": ["insight 1", "insight 2", ...],
            "patterns": ["pattern 1", "pattern 2", ...], 
            "recommendations": ["recommendation 1", "recommendation 2", ...]
          }`
        },
        {
          role: 'user',
          content: `Analyze these business entries for insights:

${entries.map(entry => `[${entry.type}] ${entry.timestamp}: ${entry.content}`).join('\n\n')}

Please provide insights, patterns, and recommendations.`
        }
      ],
      max_tokens: 600,
      temperature: 0.4,
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from API')

    return JSON.parse(result)
  } catch (error) {
    console.error('Error extracting insights:', error)
    return {
      insights: ['Analysis temporarily unavailable'],
      patterns: ['Pattern analysis temporarily unavailable'],
      recommendations: ['Recommendations temporarily unavailable']
    }
  }
}

// =====================================
// NEW 3-AGENT LEARNING INSIGHT SYSTEM
// =====================================

/**
 * ENHANCED Agent One: Learning Insight Extractor
 * Now detects broader patterns of interest and excitement, not just specific phrases
 */
export async function extractLearningInsights(
  content: string,
  transcript?: string
): Promise<LearningInsight[]> {
  try {
    const fullContent = transcript ? `${content}\n\nFULL TRANSCRIPT:\n${transcript}` : content

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI researcher helping River (a founder) extract learning insights from conversations. 

CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY extract insights from actual conversation content provided in the transcript
2. If the transcript is empty or very short (< 50 words), return an empty insights array
3. Do NOT generate insights based on meeting titles, participant names, or assumptions
4. Do NOT create plausible-sounding content that wasn't actually discussed
5. Every insight MUST reference specific quotes or exchanges from the actual transcript
6. If there's insufficient conversation content, respond with: {"insights": []}

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}  
3. Data-Driven: ${USER_GOALS.data_driven}
4. Learning: ${USER_GOALS.learning_secrets}

Focus on uncovering insights that would be valuable for these specific goals:
- Strategic frameworks, mental models, or principles
- Industry insights, trends, and emerging patterns  
- New workflows or business processes
- Counterintuitive ideas or unique approaches
- Content creation strategies and scaling techniques
- Health tech, wearables, or startup insights
- Data-driven decision making approaches
- Best practices and "secrets" from successful people

SPEAKER IDENTIFICATION:
- Parse the transcript to identify all speakers by name
- River is the founder asking questions and learning
- Refer to all speakers by their actual names (e.g., "Ali Sheikh said...", "River responded with...")
- Never use generic terms like "the user" - always use "River"

DETECT EXCITEMENT & IMPRESSION FROM CONTEXT:

PRIMARY EXCITEMENT WORDS RIVER USES:
- "whoa" 
- "man, that's super cool" / "super cool"
- "wow" 
- "holy crap"
- "that's impressive"

DETECTION APPROACH:
- Use the FULL TRANSCRIPT CONTEXT to understand the flow of conversation
- Look for moments where River's tone shifts to excitement or surprise
- Identify when someone shares something valuable and River responds with genuine interest
- Pay attention to the conversational context - what was said right before River's reaction?
- Don't just look for keywords - analyze the conversational dynamics
- Consider if the insight being shared would genuinely be impressive or exciting to a founder
- Look for patterns where River is asking follow-up questions after hearing something interesting
- Detect when someone explains a concept/strategy and River responds positively

CONTEXT CLUES TO LOOK FOR:
- Someone explains a valuable strategy/insight → River responds with interest
- Breakthrough moments in conversation where new ideas emerge
- Times when River is clearly learning something new and valuable
- Moments where the conversation energy increases due to a great point being made

CRITICAL: CAPTURE RICH CONVERSATIONAL CONTEXT
For each insight, provide detailed context that includes:
- Who said what and when in the conversation (use actual names)
- The specific examples, numbers, or details that were shared
- The full explanation or story behind the insight
- What made this moment interesting or valuable
- Any follow-up questions or discussion that happened
- The broader context of how this topic came up

IMPORTANT: ONLY include details that were actually discussed in the conversation. Do NOT add imagined details or plausible-sounding additions that weren't mentioned.

STEP-BY-STEP IMPLEMENTATION:
For each insight, create a comprehensive implementation guide using your expertise and knowledge base. Even if the conversation only briefly mentioned a concept (like "testing YouTube thumbnails with Google ads"), you should provide detailed, expert-level implementation steps that River can follow. This is where you SHOULD use your broader knowledge to make insights maximally actionable.

Example approach:
- Context: "Ali mentioned testing YouTube thumbnails using Google ads to see which performs better before publishing videos"
- Implementation: Detailed step-by-step guide on exactly how to set up Google ads for thumbnail testing, including campaign setup, targeting, metrics to track, etc.

The key distinction:
- Context = ONLY what was actually said in the conversation
- Implementation = Use your expertise to provide comprehensive "how to do it" guidance

Think of yourself as a "fly on the wall" documenting the full story behind each insight (context), plus an expert consultant providing detailed implementation guidance (how_to_implement).

Score each insight's goal relevance (0-10 for each goal area) and interest level.

Return 5–10 insights in this format:
{
  "insights": [
    { 
      "text": "Clear, actionable insight title", 
      "context": "Detailed story of how this insight came up in conversation, including specific examples, numbers, quotes, and the full context of the discussion. Use actual speaker names (River, Ali Sheikh, etc.) instead of generic terms. Paint the full picture of what was said and why it was valuable.",
      "how_to_implement": "Step-by-step breakdown of exactly how to implement this insight:\n1. First step with specific details\n2. Second step with specific details\n3. Third step with specific details\n[etc.]",
      "reaction": true/false,
      "interest_level": "high/medium/low",
      "goal_relevance": {
        "creator_brand": 0-10,
        "pulse_startup": 0-10, 
        "data_driven": 0-10,
        "learning_secrets": 0-10
      }
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Extract learning insights with rich conversational context and step-by-step implementation guides from this meeting content:\n\n${fullContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from API')

    const parsed = JSON.parse(result)
    return parsed.insights || []
  } catch (error) {
    console.error('Error extracting learning insights:', error)
    return []
  }
}

/**
 * ENHANCED Agent Two: Goal-Aligned Insight Refiner
 * Reviews insights specifically for goal alignment and personal relevance
 */
export async function refineInsights(
  initialInsights: LearningInsight[],
  originalContent: string,
  transcript?: string
): Promise<RefinedInsight[]> {
  try {
    const fullContent = transcript ? `${originalContent}\n\nFULL TRANSCRIPT:\n${transcript}` : originalContent

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a goal-alignment specialist helping filter and enhance learning insights for River (a founder).

CRITICAL ANTI-HALLUCINATION RULES:
1. PRESERVE accuracy from the first agent - do not add details that weren't in the original conversation
2. If initial insights seem fabricated or lack transcript references, remove them entirely
3. ONLY refine insights that are clearly grounded in actual conversation content
4. Do NOT enhance context with imagined details or plausible-sounding additions
5. If there are insufficient grounded insights, return an empty array
6. Verify each insight against the full transcript before including it

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}
3. Data-Driven: ${USER_GOALS.data_driven}  
4. Learning: ${USER_GOALS.learning_secrets}

Your tasks:
- Recheck each insight against the full transcript for accuracy
- PRESERVE the conversational context from Agent 1 - don't compress or add imagined details
- ENHANCE implementation guides with expert knowledge to make them maximally actionable
- Ensure proper speaker names are used (River, not "the user", plus other actual names)
- Score goal relevance more precisely (0-10 for each goal area)
- Calculate overall priority score based on goal alignment + interest level
- Add insights that were missed but highly relevant to goals
- Enhance clarity and remove vague ideas
- Explain WHY each insight is prioritized for River specifically

CRITICAL DISTINCTION:
- Context: Keep exactly what was discussed - no additions, just ensure it's complete from the transcript
- Implementation: Enhance with your expertise to provide comprehensive, actionable steps

Example:
- If the conversation mentioned "testing thumbnails with ads" keep that exact context
- But expand the implementation with detailed steps: ad setup, targeting, metrics, analysis, etc.

The goal is to preserve the "fly on the wall" accuracy of what happened, while providing expert-level implementation guidance.

Prioritization factors:
- Direct applicability to creator content strategy (high value)
- Health tech / wearables / startup insights (high value)
- Data-driven approaches and metrics (high value)  
- Actionable best practices and "secrets" (high value)
- Framework thinking and mental models (medium-high value)
- General business advice (medium value)

Return 5–7 goal-aligned insights:
{
  "refined_insights": [
    { 
      "text": "Clear, actionable insight title", 
      "context": "Preserve and enhance the detailed conversational story from the first agent. Include who said what (using actual names like River, Ali Sheikh, etc.), specific examples, numbers, the full explanation, and broader context. Add any missing details from the transcript.",
      "how_to_implement": "Preserve and enhance the step-by-step implementation guide from the first agent. Ensure it's clear, actionable, and specific:\n1. First step with specific details\n2. Second step with specific details\n3. Third step with specific details\n[etc.]",
      "reaction": true/false,
      "interest_level": "high/medium/low",
      "goal_relevance": {
        "creator_brand": 0-10,
        "pulse_startup": 0-10,
        "data_driven": 0-10, 
        "learning_secrets": 0-10,
        "overall_score": 0-40
      },
      "priority_reason": "Why this insight is valuable for River's specific goals..."
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Review and enhance these insights for goal alignment while preserving their rich conversational context and implementation guides:

INITIAL INSIGHTS WITH CONTEXT AND IMPLEMENTATION:
${initialInsights.map(insight => `
INSIGHT: ${insight.text}
CONTEXT: ${insight.context}
HOW TO IMPLEMENT: ${insight.how_to_implement}
Interest: ${insight.interest_level}, Reaction: ${insight.reaction}
---`).join('\n')}

ORIGINAL CONTENT:
${fullContent}

Enhance these insights with precise goal scoring and priority explanations while keeping the detailed conversational context and step-by-step implementation guides intact. Ensure all speaker names are properly used (River, not "the user").`
        }
      ],
      max_tokens: 2000,
      temperature: 0.2,
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from API')

    const parsed = JSON.parse(result)
    return parsed.refined_insights || []
  } catch (error) {
    console.error('Error refining insights:', error)
    // Fallback: convert initial insights to refined format
    return initialInsights.map(insight => ({
      ...insight,
      interest_level: insight.interest_level || 'medium',
      goal_relevance: {
        ...insight.goal_relevance,
        overall_score: Object.values(insight.goal_relevance || {}).reduce((sum, score) => sum + score, 0)
      },
      priority_reason: 'Goal alignment analysis temporarily unavailable'
    })) as RefinedInsight[]
  }
}

/**
 * Agent Three: Meta Evaluator + Finalizer  
 * Enhanced to focus on goal-aligned learning summary
 */
export async function finalizeLearningInsights(
  refinedInsights: RefinedInsight[],
  originalContent: string,
  transcript?: string
): Promise<FinalInsights> {
  try {
    const fullContent = transcript ? `${originalContent}\n\nFULL TRANSCRIPT:\n${transcript}` : originalContent

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a meta-evaluator providing the final quality check and summary for River's learning insights.

CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY create summaries based on the verified insights provided by Agent 2
2. Do NOT add analysis or patterns that aren't clearly supported by the actual insights
3. If the insights seem insufficient or questionable, note this in your summary
4. PRESERVE the integrity of the implementation guides and context from previous agents
5. Do NOT make up strategic conclusions that weren't actually discussed in the conversation

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}
3. Data-Driven: ${USER_GOALS.data_driven}
4. Learning: ${USER_GOALS.learning_secrets}

Your tasks:
- Final quality check on all insights for accuracy and grounding in actual conversation
- PRESERVE context accuracy - ensure no imagined details were added to conversation stories
- PRESERVE comprehensive implementation guides - these should leverage expert knowledge
- Create an honest summary of what was actually learned vs. what was discussed
- Identify the top 3-5 priority insights for River based on goal alignment
- Provide strategic context for how these insights connect to River's goals
- Flag any content that seems questionable or ungrounded
- Note if the conversation had limited substantive content

CRITICAL FINAL CHECK:
- Context: Should read like accurate meeting notes - only what was actually said
- Implementation: Should read like expert consulting advice - comprehensive actionable steps

River needs both: accurate context to remember what happened + expert implementation guidance to act on it.

Return the final result:
{
  "final_insights": [
    { 
      "text": "Keep the exact insight title from Agent 2", 
      "context": "Preserve the full detailed conversational context from Agent 2 - don't compress it",
      "how_to_implement": "Preserve the complete step-by-step implementation guide from Agent 2",
      "reaction": true/false,
      "interest_level": "high/medium/low",
      "goal_relevance": {
        "creator_brand": 0-10,
        "pulse_startup": 0-10,
        "data_driven": 0-10,
        "learning_secrets": 0-10,
        "overall_score": 0-40
      },
      "priority_reason": "Keep the exact priority reason from Agent 2"
    }
  ],
  "summary": "Honest assessment of the conversation's learning value and quality, noting any limitations or concerns about content sufficiency",
  "top_insights": ["List of 3-5 highest priority insight titles"],
  "goal_analysis": {
    "total_insights": number,
    "high_priority_count": number,
    "reaction_count": number,
    "goal_averages": {
      "creator_brand": 0-10,
      "pulse_startup": 0-10,
      "data_driven": 0-10,
      "learning_secrets": 0-10
    },
    "content_quality": "assessment of whether insights are well-grounded in actual conversation",
    "strategic_themes": ["only themes clearly supported by the actual insights"]
  }
}`
        },
        {
          role: 'user',
          content: `Synthesize the most goal-relevant learnings:

GOAL-ALIGNED INSIGHTS:
${refinedInsights.map(insight => `- ${insight.text} (Goal Score: ${insight.goal_relevance.overall_score}/40, Reason: ${insight.priority_reason})`).join('\n')}

ORIGINAL CONTENT:
${fullContent}

Focus on learnings that directly advance creator success, Pulse growth, and data-driven excellence.`
        }
      ],
      max_tokens: 600,
      temperature: 0.2,
    })

    const result = response.choices[0]?.message?.content
    if (!result) throw new Error('No response from API')

    const parsed = JSON.parse(result)
    return {
      summary: parsed.summary || 'Goal-aligned summary temporarily unavailable',
      top_insights: parsed.top_insights || refinedInsights.slice(0, 5).map(i => i.text)
    }
  } catch (error) {
    console.error('Error finalizing insights:', error)
    return {
      summary: 'Goal-aligned summary temporarily unavailable',
      top_insights: refinedInsights
        .sort((a, b) => b.goal_relevance.overall_score - a.goal_relevance.overall_score)
        .slice(0, 5)
        .map(insight => insight.text)
    }
  }
}

/**
 * Enhanced Complete Pipeline with Goal Alignment
 */
export async function extractAndRefineLearningInsights(
  content: string,
  transcript?: string
): Promise<{
  initialInsights: LearningInsight[]
  refinedInsights: RefinedInsight[]
  finalInsights: FinalInsights
}> {
  try {
    console.log('🧠 Agent 1: Extracting goal-relevant learning insights...')
    const initialInsights = await extractLearningInsights(content, transcript)
    
    console.log('🎯 Agent 2: Refining with goal alignment scoring...')
    const refinedInsights = await refineInsights(initialInsights, content, transcript)
    
    console.log('🧬 Agent 3: Finalizing goal-focused summary...')
    const finalInsights = await finalizeLearningInsights(refinedInsights, content, transcript)
    
    console.log(`✅ Extracted insights with goal alignment: ${refinedInsights.filter(i => i.goal_relevance.overall_score >= 20).length} high-priority`)
    
    return {
      initialInsights,
      refinedInsights,
      finalInsights
    }
  } catch (error) {
    console.error('Error in goal-aligned 3-agent pipeline:', error)
    throw error
  }
}