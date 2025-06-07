'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface TodayActivity {
  id: string
  type: 'slack' | 'linear' | 'doc'
  content: string
  source: string
  timestamp: string
  starred: boolean
}

interface ReflectionPrompt {
  id: string
  question: string
  category: 'wins' | 'challenges' | 'learnings' | 'tomorrow'
}

interface TopItem {
  id: string
  content: string
  source: string
  type: string
  selected: boolean
}

export function NightlyReview() {
  const [todayActivities, setTodayActivities] = useState<TodayActivity[]>([])
  const [reflectionPrompts, setReflectionPrompts] = useState<ReflectionPrompt[]>([])
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<string, string>>({})
  const [topItems, setTopItems] = useState<TopItem[]>([])
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
        // Get auth headers
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) {
          console.log('No authentication session found for nightly review')
          setTodayActivities([])
          return
        }

        const headers = {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }

        // Fetch today's meetings as activities
        const meetingsResponse = await fetch('/api/meetings', { headers })
        if (meetingsResponse.ok) {
          const meetingsData = await meetingsResponse.json()
          const today = new Date().toDateString()
          const todayMeetings = meetingsData.meetings?.filter((meeting: any) => 
            new Date(meeting.meeting_date).toDateString() === today
          ).map((meeting: any) => ({
            id: meeting.id,
            type: 'meeting' as const,
            content: `${meeting.title} - ${meeting.overview || 'Meeting completed'}`,
            source: 'Fireflies',
            timestamp: meeting.meeting_date,
            starred: false
          })) || []
          setTodayActivities(todayMeetings)
        }
      } catch (error) {
        console.error('Error fetching nightly review data:', error)
        setTodayActivities([])
      }
    }
    
    fetchData()

    setReflectionPrompts([
      {
        id: '1',
        question: 'What was your biggest win today?',
        category: 'wins'
      },
      {
        id: '2',
        question: 'What challenge did you overcome, and how?',
        category: 'challenges'
      },
      {
        id: '3',
        question: 'What did you learn about your customers or market today?',
        category: 'learnings'
      },
      {
        id: '4',
        question: 'What is the most important thing to focus on tomorrow?',
        category: 'tomorrow'
      }
    ])

    setTopItems([
      {
        id: '1',
        content: 'Enterprise pricing strategy discussion',
        source: 'Slack #strategy',
        type: 'Strategic Decision',
        selected: false
      },
      {
        id: '2',
        content: 'Customer feedback on mobile app performance',
        source: 'Support tickets',
        type: 'Customer Insight',
        selected: false
      },
      {
        id: '3',
        content: 'New competitor analysis from marketing team',
        source: 'Research Doc',
        type: 'Market Intelligence',
        selected: false
      }
    ])
  }, [])

  const toggleStarred = (id: string) => {
    setTodayActivities(prev => 
      prev.map(activity => 
        activity.id === id ? { ...activity, starred: !activity.starred } : activity
      )
    )
  }

  const updateReflection = (promptId: string, answer: string) => {
    setReflectionAnswers(prev => ({ ...prev, [promptId]: answer }))
  }

  const toggleTopItem = (id: string) => {
    setTopItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    )
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'wins': return '🎉'
      case 'challenges': return '💪'
      case 'learnings': return '💡'
      case 'tomorrow': return '🎯'
      default: return '🤔'
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🌙 Daily Reflection</h1>
        <p className="text-lg text-gray-600">{currentDate}</p>
      </div>

      {/* Today's Activity Summary */}
      <Card title="📊 Today's Activity" subtitle="Summary of key developments">
        <div className="space-y-4">
          {todayActivities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                {activity.type === 'slack' && <span className="text-purple-600">💬</span>}
                {activity.type === 'linear' && <span className="text-blue-600">📋</span>}
                {activity.type === 'doc' && <span className="text-green-600">📄</span>}
              </div>
              <div className="flex-1">
                <p className="text-gray-900">{activity.content}</p>
                <p className="text-sm text-gray-500 mt-1">from {activity.source}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleStarred(activity.id)}
                  className={`p-1 rounded ${activity.starred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                >
                  ⭐
                </button>
                <Button size="sm" variant="outline">Add to Cards</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Reflection Prompts */}
      <Card title="🤔 Daily Reflection" subtitle="Take a moment to reflect on today">
        <div className="space-y-6">
          {reflectionPrompts.map((prompt) => (
            <div key={prompt.id} className="space-y-3">
              <label className="flex items-center text-sm font-medium text-gray-700">
                <span className="mr-2">{getCategoryIcon(prompt.category)}</span>
                {prompt.question}
              </label>
              <textarea
                value={reflectionAnswers[prompt.id] || ''}
                onChange={(e) => updateReflection(prompt.id, e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Write your reflection here..."
              />
            </div>
          ))}
          <Button variant="primary">Save Reflections</Button>
        </div>
      </Card>

      {/* Starred Items */}
      <Card title="⭐ Starred Items" subtitle="Items you marked as important today">
        {todayActivities.filter(a => a.starred).length > 0 ? (
          <div className="space-y-3">
            {todayActivities.filter(a => a.starred).map((activity) => (
              <div key={activity.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-yellow-900">{activity.content}</p>
                <p className="text-sm text-yellow-700 mt-1">from {activity.source}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No starred items today</p>
        )}
      </Card>

      {/* Top 10 Things */}
      <Card title="🔟 Top Things from Today" subtitle="Select up to 10 items to remember">
        <div className="space-y-3 mb-4">
          {topItems.map((item) => (
            <div key={item.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={item.selected}
                onChange={() => toggleTopItem(item.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <p className="text-gray-900">{item.content}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {item.type}
                  </span>
                  <span className="text-sm text-gray-500">from {item.source}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Selected: {topItems.filter(item => item.selected).length} / 10
        </p>
        <div className="flex space-x-3">
          <Button variant="primary">Save Top Items</Button>
          <Button variant="outline">Add to Flashcards</Button>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button variant="primary" className="flex-1">Complete Daily Review</Button>
        <Button variant="outline" className="flex-1">Export Summary</Button>
        <Button variant="outline" className="flex-1">Schedule Tomorrow</Button>
      </div>
    </div>
  )
}