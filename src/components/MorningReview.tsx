'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

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
    // Fetch real data from APIs
    const fetchData = async () => {
      try {
        // Fetch flashcards due today
        const flashcardsResponse = await fetch('/api/flashcards', {
          headers: { 'Authorization': 'Bearer mock-token' }
        })
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
        }

        // Fetch recent meetings
        const meetingsResponse = await fetch('/api/meetings', {
          headers: { 'Authorization': 'Bearer mock-token' }
        })
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
        }

        // Fetch AI insights from our 3-agent pipeline
        const insightsResponse = await fetch('/api/ai-insights?test=true&limit=5', {
          headers: { 'Authorization': 'Bearer mock-token' }
        })
        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json()
          setAiInsights(insightsData.insights || [])
        }

        // Set empty business updates for now (no integration yet)
        setBusinessUpdates([])
        
      } catch (error) {
        console.error('Error fetching morning review data:', error)
      } finally {
        setInsightsLoading(false)
      }
    }
    
    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🌅 Good Morning!</h1>
        <p className="text-lg text-gray-600">{currentDate}</p>
      </div>

      {/* Flashcards Due Today */}
      <Card title="🧠 Flashcards Due Today" subtitle={`${flashcardsDue.length} cards ready for review`}>
        {flashcardsDue.length > 0 ? (
          <div className="space-y-4">
            {flashcardsDue.slice(0, 3).map((card) => (
              <div key={card.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-medium text-blue-900 mb-2">{card.question}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {card.tags.map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                <Button size="sm" variant="outline">Review Card</Button>
              </div>
            ))}
            <div className="flex justify-between">
              <Button 
                variant="primary" 
                onClick={() => window.location.href = '/flashcards?mode=review'}
              >
                Start Review Session
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/flashcards'}
              >
                View All Cards
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No flashcards due today! 🎉</p>
        )}
      </Card>

      {/* Yesterday's Business Updates */}
      <Card title="📊 Yesterday's Updates" subtitle="Key developments across your team">
        <div className="space-y-4">
          {businessUpdates.map((update) => (
            <div key={update.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                {update.type === 'slack' && <span className="text-purple-600">💬</span>}
                {update.type === 'linear' && <span className="text-blue-600">📋</span>}
                {update.type === 'doc' && <span className="text-green-600">📄</span>}
              </div>
              <div className="flex-1">
                <p className="text-gray-900">{update.content}</p>
                <p className="text-sm text-gray-500 mt-1">from {update.source}</p>
              </div>
              <Button size="sm" variant="outline">Tag</Button>
            </div>
          ))}
          <Button variant="outline" className="w-full">View All Updates</Button>
        </div>
      </Card>

      {/* AI-Generated Insights */}
      <Card title="🤖 AI Meeting Insights" subtitle="Goal-aligned insights from your recent meetings (3-agent pipeline)">
        {insightsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading AI insights...</p>
          </div>
        ) : aiInsights.length > 0 ? (
          <div className="space-y-4">
            {aiInsights.map((insight) => (
              <div key={insight.id} className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-amber-900 flex-1">{insight.insight_text}</h4>
                  <div className="flex items-center space-x-2 ml-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      insight.priority === 'high' ? 'bg-red-100 text-red-700' :
                      insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {insight.priority} priority
                    </span>
                    {insight.has_flashcard && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        🎴 Flashcard
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-amber-800 mb-3 text-sm leading-relaxed">{insight.context.substring(0, 200)}...</p>
                
                <div className="space-y-2 mb-3">
                  <p className="text-xs font-medium text-amber-900">Goal Alignment Scores:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-medium text-gray-700">Creator</div>
                      <div className="text-lg font-bold text-blue-600">{insight.goal_scores.creator_brand}/10</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-medium text-gray-700">Pulse</div>
                      <div className="text-lg font-bold text-purple-600">{insight.goal_scores.pulse_startup}/10</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-medium text-gray-700">Data</div>
                      <div className="text-lg font-bold text-green-600">{insight.goal_scores.data_driven}/10</div>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <div className="font-medium text-gray-700">Learning</div>
                      <div className="text-lg font-bold text-orange-600">{insight.goal_scores.learning_secrets}/10</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="inline-block bg-amber-200 text-amber-900 px-3 py-1 rounded-full text-sm font-medium">
                      Overall Score: {insight.goal_scores.overall}/40
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-xs text-amber-700">
                    From: {insight.meeting_title} • {insight.category}
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">Add Reflection</Button>
                    {!insight.has_flashcard && (
                      <Button size="sm" variant="outline">Create Flashcard</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-center">
              <Button variant="outline">View All AI Insights</Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No AI insights available yet.</p>
            <p className="text-sm text-gray-400">Process meetings through the 3-agent pipeline to see insights here.</p>
          </div>
        )}
      </Card>

      {/* Quick Goal Check-in */}
      <Card title="🎯 Quick Goal Check-in" subtitle="How are you tracking towards your objectives?">
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">Q1 Growth Target: 50% MRR increase</h4>
            <div className="w-full bg-green-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: '70%' }}></div>
            </div>
            <p className="text-sm text-green-700 mt-2">70% complete - ahead of schedule!</p>
          </div>
          
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-orange-900 mb-2">Team Expansion: Hire 5 engineers</h4>
            <div className="w-full bg-orange-200 rounded-full h-2">
              <div className="bg-orange-600 h-2 rounded-full" style={{ width: '40%' }}></div>
            </div>
            <p className="text-sm text-orange-700 mt-2">2 of 5 hired - need to accelerate recruiting</p>
          </div>
          
          <Button variant="outline" className="w-full">Update Goals</Button>
        </div>
      </Card>

      {/* Action Items */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="primary" className="flex-1">Start Daily Reflection</Button>
        <Button variant="outline" className="flex-1">Add Quick Note</Button>
        <Button variant="outline" className="flex-1">Review Yesterday</Button>
      </div>
    </div>
  )
}