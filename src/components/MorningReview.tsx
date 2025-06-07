'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface FlashcardDue {
  id: string
  question: string
  answer: string
  tags: string[]
}

interface BusinessUpdate {
  id: string
  type: 'slack' | 'linear' | 'doc'
  content: string
  source: string
  timestamp: string
}

interface Meeting {
  id: string
  title: string
  summary: string
  insights: string[]
  timestamp: string
}

interface AIInsight {
  id: string
  meeting_id: string
  meeting_title: string
  meeting_date: string | null
  insight_text: string
  context: string
  how_to_implement?: string
  category: string
  relevance: string
  priority: 'high' | 'medium' | 'low'
  priority_reason: string
  goal_scores: {
    creator_brand: number
    pulse_startup: number
    data_driven: number
    learning_secrets: number
    overall: number
  }
  has_flashcard: boolean
  flashcard_id: string | null
  created_at: string
  reaction?: boolean
  interest_level?: string
}

export function MorningReview() {
  const [flashcardsDue, setFlashcardsDue] = useState<FlashcardDue[]>([])
  const [businessUpdates, setBusinessUpdates] = useState<BusinessUpdate[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }))

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        const headers = session?.access_token ? {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        }

        if (!session?.access_token) {
          console.log('No authentication session found for morning review, trying without auth...')
        }

        // Fetch flashcards due today (gracefully handle auth errors)
        try {
          const flashcardsResponse = await fetch('/api/flashcards', { headers })
          if (flashcardsResponse.ok) {
            const flashcardsData = await flashcardsResponse.json()
            const dueFlashcards = flashcardsData.flashcards?.filter((card: any) => 
              new Date(card.due_at) <= new Date()
            ).map((card: any) => ({
              id: card.id,
              question: card.question,
              answer: card.answer,
              tags: []
            })) || []
            setFlashcardsDue(dueFlashcards)
          } else {
            console.log('Flashcards fetch failed:', flashcardsResponse.status)
          }
        } catch (error) {
          console.log('Flashcards fetch error:', error)
        }

        // Fetch recent meetings (gracefully handle auth errors)
        try {
          const meetingsResponse = await fetch('/api/meetings', { headers })
          if (meetingsResponse.ok) {
            const meetingsData = await meetingsResponse.json()
            const recentMeetings = meetingsData.meetings?.slice(0, 3).map((meeting: any) => ({
              id: meeting.id,
              title: meeting.title,
              summary: meeting.overview || 'No summary available',
              insights: meeting.action_items || [],
              timestamp: meeting.meeting_date
            })) || []
            setMeetings(recentMeetings)
          } else {
            console.log('Meetings fetch failed:', meetingsResponse.status)
          }
        } catch (error) {
          console.log('Meetings fetch error:', error)
        }

        // Fetch AI insights from our 3-agent pipeline
        try {
          let insightsResponse = await fetch('/api/ai-insights?limit=5', { headers })
          
          if (!insightsResponse.ok && insightsResponse.status === 401) {
            console.log('Auth failed for insights, trying test mode...')
            insightsResponse = await fetch('/api/ai-insights?test=true&limit=5')
          }
          
          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json()
            setAiInsights(insightsData.insights || [])
          } else {
            console.log('AI insights fetch failed:', insightsResponse.status)
          }
        } catch (error) {
          console.log('AI insights fetch error:', error)
        }

        setBusinessUpdates([])
        
      } catch (error) {
        console.error('Error fetching morning review data:', error)
      } finally {
        setInsightsLoading(false)
      }
    }
    
    fetchData()
  }, [])

  const handleInsightAction = (insightId: string, action: 'star' | 'flashcard' | 'view') => {
    console.log(`${action} action on insight ${insightId}`)
    // TODO: Implement insight actions
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-green-400'
      default: return 'text-neutral-400'
    }
  }

  return (
    <div className="min-h-screen bg-[#121212] p-4">
      <div className="max-w-2xl mx-auto space-y-ritual">
        {/* Header */}
        <div className="text-center mb-8 fade-slide-in">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            good morning, River
          </h1>
          <p className="text-[#888888]">{currentDate}</p>
        </div>

        {/* Flashcards Due */}
        <div className="card-primary fade-slide-in">
          <h2 className="section-header">
            🧠 Flashcards Due
          </h2>
          <p className="text-[#888888] mb-4">{flashcardsDue.length} cards ready for review</p>
          
          {flashcardsDue.length > 0 ? (
            <div className="space-y-3">
              {flashcardsDue.slice(0, 3).map((card) => (
                <div key={card.id} className="card-secondary">
                  <p className="text-white text-sm mb-2 line-clamp-2">{card.question}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {card.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => window.location.href = '/flashcards?mode=review'}
                  className="btn-primary flex-1"
                >
                  Start Review Session
                </button>
                <button 
                  onClick={() => window.location.href = '/flashcards'}
                  className="btn-secondary flex-1"
                >
                  View All Cards
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-[#888888]">No cards due today. Great work!</p>
            </div>
          )}
        </div>

        {/* Top Insight */}
        {aiInsights.length > 0 && (
          <div className="card-primary fade-slide-in">
            <h2 className="section-header">
              📊 Top Insight
            </h2>
            <div className="insight-card bg-[#1A1A1A] border border-neutral-700">
              <div className="insight-meta">
                From: {aiInsights[0].meeting_title} • {aiInsights[0].meeting_date ? new Date(aiInsights[0].meeting_date).toLocaleDateString() : 'Recent'}
              </div>
              <div className="insight-text">
                {aiInsights[0].insight_text}
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full bg-neutral-700 ${getPriorityColor(aiInsights[0].priority)}`}>
                    {aiInsights[0].priority.toUpperCase()}
                  </span>
                  <span className="text-xs text-neutral-400">
                    Score: {aiInsights[0].goal_scores.overall}/10
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleInsightAction(aiInsights[0].id, 'star')}
                    className="text-neutral-400 hover:text-yellow-400 transition-colors"
                    title="Save"
                  >
                    ⭐
                  </button>
                  <button 
                    onClick={() => handleInsightAction(aiInsights[0].id, 'flashcard')}
                    className="text-neutral-400 hover:text-blue-400 transition-colors"
                    title="Create Flashcard"
                  >
                    ➕
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today's Focus */}
        <div className="card-primary fade-slide-in">
          <h2 className="section-header">
            ☀️ Today's Focus
          </h2>
          <div className="card-secondary">
            <div className="text-white font-medium mb-2">Outline video script</div>
            <div className="text-[#888888] text-sm">Create detailed outline for next product demo video</div>
          </div>
          <button className="btn-secondary w-full mt-4">
            Update Focus
          </button>
        </div>

        {/* AI Insights */}
        {aiInsights.length > 1 && (
          <div className="card-primary fade-slide-in">
            <h2 className="section-header">
              🎯 Recent Insights
            </h2>
            <p className="text-[#888888] mb-4">AI-generated insights from your meetings</p>
            
            <div className="space-y-3">
              {aiInsights.slice(1, 4).map((insight) => (
                <div key={insight.id} className="insight-card">
                  <div className="insight-meta">
                    {insight.meeting_title} • {insight.meeting_date ? new Date(insight.meeting_date).toLocaleDateString() : 'Recent'}
                  </div>
                  <div className="insight-text">
                    {insight.insight_text}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full bg-neutral-700 ${getPriorityColor(insight.priority)}`}>
                        {insight.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-neutral-400">
                        Score: {insight.goal_scores.overall}/10
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleInsightAction(insight.id, 'star')}
                        className="text-neutral-400 hover:text-yellow-400 transition-colors text-sm"
                        title="Save"
                      >
                        ⭐
                      </button>
                      <button 
                        onClick={() => handleInsightAction(insight.id, 'flashcard')}
                        className="text-neutral-400 hover:text-blue-400 transition-colors text-sm"
                        title="Create Flashcard"
                      >
                        ➕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => window.location.href = '/insights'}
              className="btn-secondary w-full mt-4"
            >
              View All Insights
            </button>
          </div>
        )}

        {/* Loading state for insights */}
        {insightsLoading && (
          <div className="card-primary">
            <h2 className="section-header">
              🎯 Recent Insights
            </h2>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl"></div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Meetings */}
        {meetings.length > 0 && (
          <div className="card-primary fade-slide-in">
            <h2 className="section-header">
              🎙️ Recent Meetings
            </h2>
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="card-secondary">
                  <div className="text-white font-medium mb-1">{meeting.title}</div>
                  <div className="text-[#888888] text-sm mb-2 line-clamp-2">{meeting.summary}</div>
                  <div className="text-xs text-neutral-400">
                    {new Date(meeting.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => window.location.href = '/clips'}
              className="btn-secondary w-full mt-4"
            >
              View All Meetings
            </button>
          </div>
        )}

        {/* CTA to start the day */}
        <div className="text-center pb-8 fade-slide-in">
          <button 
            onClick={() => window.location.href = '/flashcards?mode=review'}
            className="floating-cta relative"
          >
            Start Your Day →
          </button>
        </div>
      </div>
    </div>
  )
}