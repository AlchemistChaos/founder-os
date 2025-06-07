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
    // Allow testing mode to bypass auth 
    const url = new URL(request.url)
    const isTestMode = url.searchParams.get('test') === 'true'
    const meetingId = url.searchParams.get('meeting_id') || 'cf2f64db-4648-43ee-afb2-5acf32767888' // Default to Ali meeting for testing
    const limit = parseInt(url.searchParams.get('limit') || '10')
    
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

    // For now, let's fetch the enriched insights from the existing meeting insights API
    // which has the rich how_to_implement data
    if (isTestMode && meetingId) {
      try {
        const insightsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/meetings/${meetingId}/insights?test=true`)
        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json()
          
          // Transform the enriched insights to our expected format
          const enrichedInsights = insightsData.insights?.slice(0, limit).map((insight: any, index: number) => ({
            id: `enriched-${index}`,
            meeting_id: meetingId,
            meeting_title: 'Meet – River and Ali Sheikh',
            meeting_date: '2025-06-06T17:05:00+00:00',
            insight_text: insight.insight,
            context: insight.context,
            how_to_implement: insight.how_to_implement,
            category: insight.category,
            relevance: insight.relevance,
            priority: insight.priority,
            priority_reason: insight.priority_reason,
            goal_scores: {
              creator_brand: insight.goal_alignment?.creator_brand || 0,
              pulse_startup: insight.goal_alignment?.pulse_startup || 0,
              data_driven: insight.goal_alignment?.data_driven || 0,
              learning_secrets: insight.goal_alignment?.learning_secrets || 0,
              overall: insight.goal_alignment?.overall_score || 0
            },
            has_flashcard: false,
            flashcard_id: null,
            flashcard_created: null,
            created_at: new Date().toISOString(),
            reaction: insight.reaction,
            interest_level: insight.interest_level
          })) || []

          const stats = {
            total_insights: enrichedInsights.length,
            high_priority_count: enrichedInsights.filter((i: any) => i.priority === 'high').length,
            medium_priority_count: enrichedInsights.filter((i: any) => i.priority === 'medium').length,
            low_priority_count: enrichedInsights.filter((i: any) => i.priority === 'low').length,
            with_flashcards: 0,
            average_score: enrichedInsights.length > 0 
              ? Math.round(enrichedInsights.reduce((sum: number, i: any) => sum + i.goal_scores.overall, 0) / enrichedInsights.length * 10) / 10
              : 0,
            goal_averages: {
              creator_brand: 0,
              pulse_startup: 0,
              data_driven: 0,
              learning_secrets: 0
            }
          }

          return NextResponse.json({
            success: true,
            insights: enrichedInsights,
            stats,
            meta: {
              total: enrichedInsights.length,
              limit,
              meeting_id: meetingId,
              generated_by: 'enriched-insights-system'
            }
          })
        }
      } catch (error) {
        console.error('Error fetching enriched insights:', error)
        // Fall back to the original system below
      }
    }

    let query = supabase
      .from('ai_insights')
      .select(`
        id,
        meeting_id,
        insight_text,
        context,
        category,
        relevance,
        priority,
        priority_reason,
        goal_creator_brand,
        goal_pulse_startup,
        goal_data_driven,
        goal_learning_secrets,
        goal_overall_score,
        is_flashcard,
        flashcard_id,
        flashcard_created_at,
        created_at,
        meetings!inner(
          id,
          title,
          meeting_date,
          overview
        )
      `)
      .eq('user_id', user.id)
      .order('goal_overall_score', { ascending: false })
      .order('created_at', { ascending: false })

    // Filter by specific meeting if provided
    if (meetingId) {
      query = query.eq('meeting_id', meetingId)
    }

    // Limit results
    query = query.limit(limit)

    const { data: aiInsights, error: insightsError } = await query

    if (insightsError) {
      console.error('Error fetching AI insights:', insightsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Transform the data for frontend consumption
    const transformedInsights = aiInsights?.map(insight => {
      const meeting = insight.meetings as any
      return {
        id: insight.id,
        meeting_id: insight.meeting_id,
        meeting_title: meeting?.title || 'Unknown Meeting',
        meeting_date: meeting?.meeting_date || null,
      insight_text: insight.insight_text,
      context: insight.context,
      category: insight.category,
      relevance: insight.relevance,
      priority: insight.priority,
      priority_reason: insight.priority_reason,
      goal_scores: {
        creator_brand: insight.goal_creator_brand,
        pulse_startup: insight.goal_pulse_startup,
        data_driven: insight.goal_data_driven,
        learning_secrets: insight.goal_learning_secrets,
        overall: insight.goal_overall_score
      },
      has_flashcard: insight.is_flashcard,
      flashcard_id: insight.flashcard_id,
      flashcard_created: insight.flashcard_created_at,
      created_at: insight.created_at
      }
    }) || []

    // Calculate summary statistics
    const stats = {
      total_insights: transformedInsights.length,
      high_priority_count: transformedInsights.filter(i => i.priority === 'high').length,
      medium_priority_count: transformedInsights.filter(i => i.priority === 'medium').length,
      low_priority_count: transformedInsights.filter(i => i.priority === 'low').length,
      with_flashcards: transformedInsights.filter(i => i.has_flashcard).length,
      average_score: transformedInsights.length > 0 
        ? Math.round(transformedInsights.reduce((sum, i) => sum + i.goal_scores.overall, 0) / transformedInsights.length * 10) / 10
        : 0,
      goal_averages: {
        creator_brand: transformedInsights.length > 0 
          ? Math.round(transformedInsights.reduce((sum, i) => sum + i.goal_scores.creator_brand, 0) / transformedInsights.length * 10) / 10
          : 0,
        pulse_startup: transformedInsights.length > 0 
          ? Math.round(transformedInsights.reduce((sum, i) => sum + i.goal_scores.pulse_startup, 0) / transformedInsights.length * 10) / 10
          : 0,
        data_driven: transformedInsights.length > 0 
          ? Math.round(transformedInsights.reduce((sum, i) => sum + i.goal_scores.data_driven, 0) / transformedInsights.length * 10) / 10
          : 0,
        learning_secrets: transformedInsights.length > 0 
          ? Math.round(transformedInsights.reduce((sum, i) => sum + i.goal_scores.learning_secrets, 0) / transformedInsights.length * 10) / 10
          : 0
      }
    }

    return NextResponse.json({
      success: true,
      insights: transformedInsights,
      stats,
      meta: {
        total: transformedInsights.length,
        limit,
        meeting_id: meetingId,
        generated_by: '3-agent-pipeline'
      }
    })

  } catch (error) {
    console.error('AI Insights API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 