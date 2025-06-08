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

interface Milestone {
  id: string
  title: string
  description: string
  due_date: string
  status: 'not_started' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  cycle?: string
  tasks: Task[]
  progress_percentage: number
  created_at: string
}

interface Task {
  id: string
  milestone_id: string
  title: string
  description?: string
  status: 'todo' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  cycle?: string
  due_date?: string
  assignee?: string
  created_at: string
}

export function MorningReview() {
  const [flashcardsDue, setFlashcardsDue] = useState<FlashcardDue[]>([])
  const [businessUpdates, setBusinessUpdates] = useState<BusinessUpdate[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)
  const [taskFilter, setTaskFilter] = useState<string>('all') // 'all' or specific cycle
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [milestonesLoading, setMilestonesLoading] = useState(true)
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

        // Fetch milestones (mock data for now - we'll create API later)
        try {
          // For now, using mock data until we create the API
          const mockMilestones: Milestone[] = [
            {
              id: '1',
              title: 'Launch MVP',
              description: 'Complete and launch the minimum viable product',
              due_date: '2025-07-01',
              status: 'in_progress',
              priority: 'high',
              cycle: 'Q2 2025',
              progress_percentage: 75,
              created_at: '2025-05-01',
              tasks: [
                {
                  id: '1',
                  milestone_id: '1',
                  title: 'Complete user authentication',
                  status: 'completed',
                  priority: 'high',
                  cycle: 'Q2 2025',
                  created_at: '2025-05-01'
                },
                {
                  id: '2',
                  milestone_id: '1',
                  title: 'Implement core features',
                  status: 'in_progress',
                  priority: 'high',
                  cycle: 'Q2 2025',
                  created_at: '2025-05-01'
                },
                {
                  id: '3',
                  milestone_id: '1',
                  title: 'Set up deployment pipeline',
                  status: 'todo',
                  priority: 'medium',
                  cycle: 'Q2 2025',
                  created_at: '2025-05-01'
                }
              ]
            },
            {
              id: '2',
              title: 'First Customer Interview',
              description: 'Conduct initial customer discovery interviews',
              due_date: '2025-06-15',
              status: 'not_started',
              priority: 'medium',
              cycle: 'Q2 2025',
              progress_percentage: 0,
              created_at: '2025-05-01',
              tasks: [
                {
                  id: '4',
                  milestone_id: '2',
                  title: 'Create interview script',
                  status: 'todo',
                  priority: 'high',
                  cycle: 'Q2 2025',
                  created_at: '2025-05-01'
                },
                {
                  id: '5',
                  milestone_id: '2',
                  title: 'Reach out to potential customers',
                  status: 'todo',
                  priority: 'medium',
                  cycle: 'Q2 2025',
                  created_at: '2025-05-01'
                }
              ]
            },
            {
              id: '3',
              title: 'Secure Seed Funding',
              description: 'Raise initial seed round',
              due_date: '2025-08-01',
              status: 'not_started',
              priority: 'high',
              cycle: 'Q3 2025',
              progress_percentage: 10,
              created_at: '2025-05-01',
              tasks: [
                {
                  id: '6',
                  milestone_id: '3',
                  title: 'Create pitch deck',
                  status: 'in_progress',
                  priority: 'high',
                  cycle: 'Q3 2025',
                  created_at: '2025-05-01'
                },
                {
                  id: '7',
                  milestone_id: '3',
                  title: 'Research potential investors',
                  status: 'todo',
                  priority: 'medium',
                  cycle: 'Q3 2025',
                  created_at: '2025-05-01'
                }
              ]
            }
          ]
          setMilestones(mockMilestones)
        } catch (error) {
          console.log('Milestones fetch error:', error)
        } finally {
          setMilestonesLoading(false)
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
      case 'high': return 'text-red-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      default: return 'text-neutral-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'not_started': case 'todo': return 'bg-gray-100 text-gray-600 border-gray-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅'
      case 'in_progress': return '🔄'
      case 'not_started': case 'todo': return '⏳'
      default: return '⏳'
    }
  }

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const formatDueDate = (dueDate: string) => {
    const daysUntil = getDaysUntilDue(dueDate)
    const date = new Date(dueDate)
    
    if (daysUntil < 0) {
      return `Overdue by ${Math.abs(daysUntil)} days`
    } else if (daysUntil === 0) {
      return 'Due today'
    } else if (daysUntil <= 7) {
      return `${daysUntil} days left`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getUniqueCycles = () => {
    const cycles = new Set(['all'])
    milestones.forEach(milestone => {
      if (milestone.cycle) cycles.add(milestone.cycle)
      milestone.tasks.forEach(task => {
        if (task.cycle) cycles.add(task.cycle)
      })
    })
    return Array.from(cycles)
  }

  const getFilteredTasks = (milestone: Milestone) => {
    if (taskFilter === 'all') return milestone.tasks
    return milestone.tasks.filter(task => task.cycle === taskFilter)
  }

  return (
    <div className="theme-light min-h-screen p-4">
      <div className="max-w-2xl mx-auto space-y-ritual">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="header-text mb-2">
            good morning, River
          </h1>
          <p className="subtext">{currentDate}</p>
        </div>

        {/* Milestones */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-4">
            🎯 Milestones
          </h2>
          
          {milestonesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl"></div>
              ))}
            </div>
          ) : milestones.length > 0 ? (
            <div className="space-y-3">
              {milestones.map((milestone) => {
                const daysUntil = getDaysUntilDue(milestone.due_date)
                const isOverdue = daysUntil < 0
                
                return (
                  <div 
                    key={milestone.id} 
                    className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all hover:shadow-md ${
                      isOverdue ? 'border-red-200 bg-red-50' : 'border-neutral-200'
                    }`}
                    onClick={() => setSelectedMilestone(milestone)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-neutral-900">{milestone.title}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(milestone.status)}`}>
                            {getStatusIcon(milestone.status)} {milestone.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-600 line-clamp-1">{milestone.description}</p>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-neutral-500'}`}>
                          {formatDueDate(milestone.due_date)}
                        </div>
                        <div className="text-xs text-neutral-400 mt-1">
                          {milestone.tasks.length} tasks
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${milestone.progress_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-neutral-500 min-w-[3rem]">
                        {milestone.progress_percentage}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎯</div>
              <p className="subtext">No milestones yet. Set your first goal!</p>
              <button className="btn-secondary mt-4">
                Add Milestone
              </button>
            </div>
          )}
        </div>

        {/* Milestone Detail Modal */}
        {selectedMilestone && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-neutral-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-900 mb-1">
                      {selectedMilestone.title}
                    </h3>
                    <p className="text-neutral-600">{selectedMilestone.description}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedMilestone(null)}
                    className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className={`px-2 py-1 rounded-full border ${getStatusColor(selectedMilestone.status)}`}>
                    {getStatusIcon(selectedMilestone.status)} {selectedMilestone.status.replace('_', ' ')}
                  </span>
                  <span className="text-neutral-500">
                    Due: {new Date(selectedMilestone.due_date).toLocaleDateString()}
                  </span>
                  <span className={`font-medium ${getPriorityColor(selectedMilestone.priority)}`}>
                    {selectedMilestone.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
                
                {/* Progress */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-neutral-700">Progress</span>
                    <span className="text-sm text-neutral-500">{selectedMilestone.progress_percentage}%</span>
                  </div>
                  <div className="bg-neutral-200 rounded-full h-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${selectedMilestone.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-neutral-900">
                    Tasks ({getFilteredTasks(selectedMilestone).length})
                  </h4>
                  
                  {/* Cycle Filter */}
                  <div className="flex gap-1">
                    {getUniqueCycles().map(cycle => (
                      <button
                        key={cycle}
                        onClick={() => setTaskFilter(cycle)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          taskFilter === cycle 
                            ? 'bg-blue-100 text-blue-800 border-blue-200' 
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {cycle === 'all' ? 'All' : cycle}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {getFilteredTasks(selectedMilestone).map(task => (
                    <div key={task.id} className="border border-neutral-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-neutral-900">{task.title}</span>
                            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(task.status)}`}>
                              {getStatusIcon(task.status)} {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-neutral-600">{task.description}</p>
                          )}
                        </div>
                        <div className="ml-4 text-right">
                          <div className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority.toUpperCase()}
                          </div>
                          {task.cycle && (
                            <div className="text-xs text-neutral-400 mt-1">
                              {task.cycle}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {task.due_date && (
                        <div className="text-xs text-neutral-500">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {getFilteredTasks(selectedMilestone).length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-2xl mb-2">📝</div>
                      <p className="text-neutral-500">
                        {taskFilter === 'all' ? 'No tasks yet' : `No tasks for ${taskFilter}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Flashcards Due */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-2">
            🧠 Flashcards Due
          </h2>
          <p className="subtext mb-4">{flashcardsDue.length} cards ready for review</p>
          
          {flashcardsDue.length > 0 ? (
            <div className="space-y-3">
              {flashcardsDue.slice(0, 3).map((card) => (
                <div key={card.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <p className="text-neutral-900 text-sm mb-2 line-clamp-2">{card.question}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {card.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200">
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
              <p className="subtext">No cards due today. Great work!</p>
            </div>
          )}
        </div>

        {/* Top Insight */}
        {aiInsights.length > 0 && (
          <div className="card-container animate-fade-in-up">
            <h2 className="section-title mb-4">
              📊 Top Insight
            </h2>
            <div className="bg-white border border-neutral-200 rounded-2xl p-4">
              <div className="text-xs text-neutral-500 mb-2 uppercase tracking-wide">
                From: {aiInsights[0].meeting_title} • {aiInsights[0].meeting_date ? new Date(aiInsights[0].meeting_date).toLocaleDateString() : 'Recent'}
              </div>
              <div className="text-neutral-900 text-sm mb-4">
                {aiInsights[0].insight_text}
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full bg-neutral-100 border ${getPriorityColor(aiInsights[0].priority)}`}>
                    {aiInsights[0].priority.toUpperCase()}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Score: {aiInsights[0].goal_scores.overall}/10
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleInsightAction(aiInsights[0].id, 'star')}
                    className="text-neutral-400 hover:text-yellow-600 transition-colors touch-target"
                    title="Save"
                  >
                    ⭐
                  </button>
                  <button 
                    onClick={() => handleInsightAction(aiInsights[0].id, 'flashcard')}
                    className="text-neutral-400 hover:text-blue-600 transition-colors touch-target"
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
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-4">
            ☀️ Today's Focus
          </h2>
          <div className="bg-white border border-neutral-200 rounded-2xl p-4">
            <div className="text-neutral-900 font-medium mb-2">Outline video script</div>
            <div className="subtext">Create detailed outline for next product demo video</div>
          </div>
          <button className="btn-secondary w-full mt-4">
            Update Focus
          </button>
        </div>

        {/* AI Insights */}
        {aiInsights.length > 1 && (
          <div className="card-container animate-fade-in-up">
            <h2 className="section-title mb-2">
              🎯 Recent Insights
            </h2>
            <p className="subtext mb-4">AI-generated insights from your meetings</p>
            
            <div className="space-y-3">
              {aiInsights.slice(1, 4).map((insight) => (
                <div key={insight.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-xs text-neutral-500 mb-2 uppercase tracking-wide">
                    {insight.meeting_title} • {insight.meeting_date ? new Date(insight.meeting_date).toLocaleDateString() : 'Recent'}
                  </div>
                  <div className="text-neutral-900 text-sm mb-4">
                    {insight.insight_text}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full bg-neutral-100 border ${getPriorityColor(insight.priority)}`}>
                        {insight.priority.toUpperCase()}
                      </span>
                      <span className="text-xs text-neutral-500">
                        Score: {insight.goal_scores.overall}/10
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleInsightAction(insight.id, 'star')}
                        className="text-neutral-400 hover:text-yellow-600 transition-colors text-sm touch-target"
                        title="Save"
                      >
                        ⭐
                      </button>
                      <button 
                        onClick={() => handleInsightAction(insight.id, 'flashcard')}
                        className="text-neutral-400 hover:text-blue-600 transition-colors text-sm touch-target"
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
          <div className="card-container">
            <h2 className="section-title mb-4">
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
          <div className="card-container animate-fade-in-up">
            <h2 className="section-title mb-4">
              🎙️ Recent Meetings
            </h2>
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="bg-white border border-neutral-200 rounded-2xl p-4">
                  <div className="text-neutral-900 font-medium mb-1">{meeting.title}</div>
                  <div className="subtext mb-2 line-clamp-2">{meeting.summary}</div>
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
        <div className="text-center pb-8 animate-fade-in-up">
          <button 
            onClick={() => window.location.href = '/flashcards?mode=review'}
            className="btn-primary px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Start Your Day →
          </button>
        </div>
      </div>
    </div>
  )
}