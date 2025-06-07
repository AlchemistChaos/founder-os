'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface TodayActivity {
  id: string
  type: 'slack' | 'linear' | 'doc' | 'meeting'
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
    <div className="theme-dark min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-ritual">
        <div className="text-center mb-6 md:mb-8 animate-fade-in-up">
          <h1 className="header-text mb-2">🌙 Daily Reflection</h1>
          <p className="subtext">{currentDate}</p>
        </div>

        {/* Today's Activity Summary */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-2">📊 Today's Activity</h2>
          <p className="subtext mb-4">Summary of key developments</p>
          <div className="space-y-4">
            {todayActivities.length > 0 ? (
              todayActivities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 md:p-4 bg-[#1A1A1A] rounded-2xl border border-neutral-700">
                  <div className="flex-shrink-0 text-lg">
                    {activity.type === 'slack' && <span className="text-purple-400">💬</span>}
                    {activity.type === 'linear' && <span className="text-blue-400">📋</span>}
                    {activity.type === 'doc' && <span className="text-green-400">📄</span>}
                    {activity.type === 'meeting' && <span className="text-amber-400">🎙️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm md:text-base break-words">{activity.content}</p>
                    <p className="text-xs md:text-sm text-neutral-400 mt-1">from {activity.source}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleStarred(activity.id)}
                      className={`p-2 rounded text-lg touch-target transition-colors ${activity.starred ? 'text-yellow-400' : 'text-neutral-400 hover:text-yellow-400'}`}
                      title={activity.starred ? 'Unstar' : 'Star'}
                    >
                      ⭐
                    </button>
                    <button className="btn-secondary text-xs whitespace-nowrap">Add to Cards</button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 md:py-8">
                <div className="text-3xl md:text-4xl mb-4">📊</div>
                <p className="text-neutral-400 text-sm md:text-base mb-2">No activities recorded today</p>
                <p className="text-xs md:text-sm text-neutral-500">Connect your integrations to see activities here</p>
              </div>
            )}
          </div>
        </div>

        {/* Reflection Prompts */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-2">🤔 Daily Reflection</h2>
          <p className="subtext mb-6">Take a moment to reflect on today</p>
          <div className="space-y-6">
            {reflectionPrompts.map((prompt) => (
              <div key={prompt.id} className="space-y-3">
                <label className="flex items-start text-sm font-medium text-white">
                  <span className="mr-2 mt-0.5 text-base">{getCategoryIcon(prompt.category)}</span>
                  <span className="leading-relaxed">{prompt.question}</span>
                </label>
                <textarea
                  value={reflectionAnswers[prompt.id] || ''}
                  onChange={(e) => updateReflection(prompt.id, e.target.value)}
                  className="w-full p-3 bg-[#1A1A1A] border border-neutral-700 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white text-sm md:text-base placeholder-neutral-400"
                  rows={3}
                  placeholder="Write your reflection here..."
                />
              </div>
            ))}
            <button className="btn-primary w-full sm:w-auto text-sm md:text-base">
              Save Reflections
            </button>
          </div>
        </div>

        {/* Starred Items */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-2">⭐ Starred Items</h2>
          <p className="subtext mb-4">Items you marked as important today</p>
          {todayActivities.filter(a => a.starred).length > 0 ? (
            <div className="space-y-3">
              {todayActivities.filter(a => a.starred).map((activity) => (
                <div key={activity.id} className="p-3 md:p-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
                  <p className="text-yellow-200 text-sm md:text-base break-words">{activity.content}</p>
                  <p className="text-xs md:text-sm text-yellow-300/70 mt-1">from {activity.source}</p>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button className="btn-secondary text-sm md:text-base">
                  Create Flashcards from Starred
                </button>
                <button className="btn-secondary text-sm md:text-base">
                  Export Starred Items
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 md:py-8">
              <div className="text-3xl md:text-4xl mb-4">⭐</div>
              <p className="text-neutral-400 text-sm md:text-base">No starred items today</p>
              <p className="text-xs md:text-sm text-neutral-500 mt-1">Star items above to see them here</p>
            </div>
          )}
        </div>

        {/* Top 10 Things */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-2">🔟 Top Things from Today</h2>
          <p className="subtext mb-4">Select up to 10 items to remember</p>
          <div className="space-y-3 mb-4">
            {topItems.map((item) => (
              <div key={item.id} className="flex items-start space-x-3 p-3 bg-[#1A1A1A] rounded-2xl border border-neutral-700">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleTopItem(item.id)}
                  className="w-4 h-4 text-blue-500 bg-neutral-700 border-neutral-600 rounded focus:ring-blue-500 focus:ring-2 mt-1 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm md:text-base break-words">{item.content}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full whitespace-nowrap border border-blue-500/30">
                      {item.type}
                    </span>
                    <span className="text-xs md:text-sm text-neutral-400">from {item.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-neutral-400">
                Selected: {topItems.filter(item => item.selected).length} / 10
              </span>
              <div className="text-right">
                <button
                  onClick={() => setTopItems(prev => prev.map(item => ({ ...item, selected: false })))}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill transition-all duration-300" 
                style={{ width: `${(topItems.filter(item => item.selected).length / 10) * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="btn-primary text-sm md:text-base">Save Top Items</button>
            <button className="btn-secondary text-sm md:text-base">Add to Flashcards</button>
            <button className="btn-secondary text-sm md:text-base">Export List</button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 animate-fade-in-up">
          <button className="btn-primary text-sm md:text-base py-3">
            <span className="mr-2">✅</span>
            Complete Daily Review
          </button>
          <button className="btn-secondary text-sm md:text-base py-3">
            <span className="mr-2">📄</span>
            Export Summary
          </button>
          <button className="btn-secondary text-sm md:text-base py-3">
            <span className="mr-2">📅</span>
            Schedule Tomorrow
          </button>
        </div>

        {/* Quick Stats Footer */}
        <div className="card-container animate-fade-in-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3">
              <div className="text-lg md:text-xl font-bold text-blue-400">
                {todayActivities.length}
              </div>
              <div className="text-xs md:text-sm text-neutral-500">Activities</div>
            </div>
            <div className="p-3">
              <div className="text-lg md:text-xl font-bold text-yellow-400">
                {todayActivities.filter(a => a.starred).length}
              </div>
              <div className="text-xs md:text-sm text-neutral-500">Starred</div>
            </div>
            <div className="p-3">
              <div className="text-lg md:text-xl font-bold text-green-400">
                {topItems.filter(item => item.selected).length}
              </div>
              <div className="text-xs md:text-sm text-neutral-500">Top Items</div>
            </div>
            <div className="p-3">
              <div className="text-lg md:text-xl font-bold text-purple-400">
                {Object.values(reflectionAnswers).filter(answer => answer.trim()).length}
              </div>
              <div className="text-xs md:text-sm text-neutral-500">Reflections</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}