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

export function MorningReview() {
  const [flashcardsDue, setFlashcardsDue] = useState<FlashcardDue[]>([])
  const [businessUpdates, setBusinessUpdates] = useState<BusinessUpdate[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
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

        // Set empty business updates for now (no integration yet)
        setBusinessUpdates([])
        
      } catch (error) {
        console.error('Error fetching morning review data:', error)
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

      {/* Meeting Summaries */}
      <Card title="🤝 Meeting Insights" subtitle="Key takeaways from recent meetings">
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-900 mb-2">{meeting.title}</h4>
              <p className="text-amber-800 mb-3">{meeting.summary}</p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900">Key Insights:</p>
                <ul className="space-y-1">
                  {meeting.insights.map((insight, index) => (
                    <li key={index} className="text-sm text-amber-800 flex items-start">
                      <span className="mr-2">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 flex space-x-2">
                <Button size="sm" variant="outline">Add Reflection</Button>
              </div>
            </div>
          ))}
        </div>
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