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

interface Team {
  id: string
  name: string
  color: string
  icon: string
  key?: string
}

interface Milestone {
  id: string
  title: string
  description: string
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  cycle?: string
  team_id?: string
  team: Team
  tasks: Task[]
  progress: number
  progress_percentage?: number // Backward compatibility
  created_at: string
  updated_at?: string
  overdue?: boolean | null
  project?: {
    id: string
    name: string
  }
}

interface Task {
  id: string
  milestone_id?: string
  title: string
  description?: string
  status: string // Linear status names are more varied
  priority: number | 'high' | 'medium' | 'low'
  cycle?: string
  due_date?: string
  assignee?: string
  created_at?: string
  url?: string
  milestone_title?: string // Added for weekly/active task views
}

export function MorningReview() {
  const [flashcardsDue, setFlashcardsDue] = useState<FlashcardDue[]>([])
  const [businessUpdates, setBusinessUpdates] = useState<BusinessUpdate[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [availableTeams, setAvailableTeams] = useState<Team[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['all'])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [showTeamSettings, setShowTeamSettings] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)
  const [taskFilter, setTaskFilter] = useState('all')
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [milestonesLoading, setMilestonesLoading] = useState(true)
  const [currentDate] = useState(new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }))
  const [taskStatusFilter, setTaskStatusFilter] = useState('all')
  const [weeklyTasks, setWeeklyTasks] = useState<{[key: string]: Task[]}>({})
  const [activeTasks, setActiveTasks] = useState<Task[]>([])

  // Helper functions for Linear data transformation
  const getTeamColor = (teamKey: string) => {
    const colors: Record<string, string> = {
      'MAR': 'bg-blue-100 text-blue-800 border-blue-200',
      'ENG': 'bg-purple-100 text-purple-800 border-purple-200',
      'PROD': 'bg-green-100 text-green-800 border-green-200',
      'DES': 'bg-pink-100 text-pink-800 border-pink-200',
      'BIZ': 'bg-orange-100 text-orange-800 border-orange-200',
      'OPS': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    return colors[teamKey] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const mapLinearStatusToLocal = (linearStatus: string): string => {
    const statusMap: Record<string, string> = {
      'Todo': 'todo',
      'In Progress': 'in_progress',
      'In Review': 'in_progress',
      'Done': 'completed',
      'Completed': 'completed',
      'Backlog': 'backlog',
      'Triage': 'todo',
      'Started': 'in_progress',
      'Blocked': 'blocked',
      'Cancelled': 'cancelled'
    }
    console.log(`Mapping Linear status "${linearStatus}" to "${statusMap[linearStatus] || 'todo'}"`)
    return statusMap[linearStatus] || 'todo'
  }

  const mapLinearPriorityToLocal = (linearPriority: number): 'high' | 'medium' | 'low' => {
    if (linearPriority >= 2) return 'high'
    if (linearPriority >= 1) return 'medium'
    return 'low'
  }

  // Weekly task helpers
  const getWeeklyTasks = (milestones: Milestone[]) => {
    const today = new Date()
    const currentDayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // If today is Sunday, show tasks for the coming business week (Monday-Friday)
    // Otherwise, show tasks for the current business week
    let startOfBusinessWeek: Date
    
    if (currentDayOfWeek === 0) {
      // Today is Sunday, show next week's tasks (Monday to Friday)
      startOfBusinessWeek = new Date(today)
      startOfBusinessWeek.setDate(today.getDate() + 1) // Next Monday
    } else {
      // Show current week's business days
      startOfBusinessWeek = new Date(today)
      startOfBusinessWeek.setDate(today.getDate() - (currentDayOfWeek - 1)) // This Monday
    }
    
    const weeklyTasksMap: {[key: string]: Task[]} = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: []
    }
    
    console.log('Processing weekly tasks for week starting:', startOfBusinessWeek.toDateString())
    
    milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        if (task.due_date) {
          const taskDate = new Date(task.due_date)
          console.log(`Task "${task.title}" due on:`, taskDate.toDateString())
          
          // Check if task is due Monday-Friday of the target week
          for (let i = 0; i < 5; i++) {
            const dayDate = new Date(startOfBusinessWeek)
            dayDate.setDate(startOfBusinessWeek.getDate() + i)
            
            // Check if task is due on this specific day
            if (taskDate.toDateString() === dayDate.toDateString()) {
              const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
              console.log(`Adding task "${task.title}" to ${dayNames[i]}`)
              weeklyTasksMap[dayNames[i]].push({
                ...task,
                milestone_title: milestone.title,
                milestone_id: milestone.id
              })
              break
            }
          }
        }
      })
    })
    
    return weeklyTasksMap
  }

  const getWeekDates = () => {
    const today = new Date()
    const currentDayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // If today is Sunday, show dates for the coming business week
    // Otherwise, show dates for the current business week
    let startOfBusinessWeek: Date
    
    if (currentDayOfWeek === 0) {
      // Today is Sunday, show next week's dates
      startOfBusinessWeek = new Date(today)
      startOfBusinessWeek.setDate(today.getDate() + 1) // Next Monday
    } else {
      // Show current week's business days
      startOfBusinessWeek = new Date(today)
      startOfBusinessWeek.setDate(today.getDate() - (currentDayOfWeek - 1)) // This Monday
    }
    
    const weekDates: {[key: string]: { date: Date, formatted: string }} = {}
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(startOfBusinessWeek)
      dayDate.setDate(startOfBusinessWeek.getDate() + i)
      
      // Format as "Mon 10" (abbreviated day + date number only)
      const formatted = dayDate.toLocaleDateString('en-US', { 
        weekday: 'short',
        day: 'numeric' 
      })
      
      weekDates[dayNames[i]] = {
        date: dayDate,
        formatted: formatted
      }
    }
    
    return weekDates
  }

  const getActiveTasksWithoutDueDates = (milestones: Milestone[]) => {
    const activeTasks: Task[] = []
    // Include more Linear statuses to catch all active tasks
    const activeStatuses = ['backlog', 'todo', 'in_progress', 'review', 'in review', 'started', 'doing', 'blocked', 'triage']
    
    console.log('Filtering active tasks from milestones:', milestones.length)
    
    milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        console.log(`Task "${task.title}" - due_date: ${task.due_date}, status: "${task.status}"`)
        // Only include tasks without due dates that are in active statuses
        if (!task.due_date && activeStatuses.includes(task.status.toLowerCase())) {
          console.log(`Adding active task: "${task.title}" (${task.status})`)
          activeTasks.push({
            ...task,
            milestone_title: milestone.title,
            milestone_id: milestone.id
          })
        }
      })
    })
    
    console.log('Total active tasks found:', activeTasks.length)
    return activeTasks
  }

  const getTaskStatusColor = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'backlog': 'border-gray-200 bg-gray-50 text-gray-700',
      'todo': 'border-blue-200 bg-blue-50 text-blue-700',
      'in_progress': 'border-yellow-200 bg-yellow-50 text-yellow-700',
      'in progress': 'border-yellow-200 bg-yellow-50 text-yellow-700',
      'done': 'border-green-200 bg-green-50 text-green-700',
      'completed': 'border-green-200 bg-green-50 text-green-700',
      'review': 'border-purple-200 bg-purple-50 text-purple-700',
      'blocked': 'border-red-200 bg-red-50 text-red-700',
      'cancelled': 'border-gray-200 bg-gray-100 text-gray-600',
      'triage': 'border-orange-200 bg-orange-50 text-orange-700'
    }
    return statusColors[status.toLowerCase()] || statusColors['todo']
  }

  const getUniqueTaskStatuses = (milestone: Milestone) => {
    const statuses = new Set(['all'])
    milestone.tasks.forEach(task => {
      statuses.add(task.status.toLowerCase())
    })
    return Array.from(statuses)
  }

  const getFilteredTasksByStatus = (milestone: Milestone) => {
    if (taskStatusFilter === 'all') {
      return milestone.tasks
    }
    return milestone.tasks.filter(task => 
      task.status.toLowerCase() === taskStatusFilter.toLowerCase()
    )
  }

  // Load team preferences from localStorage
  useEffect(() => {
    const savedTeams = localStorage.getItem('selectedTeams')
    if (savedTeams) {
      setSelectedTeams(JSON.parse(savedTeams))
    }
  }, [])

  // Save team preferences to localStorage
  useEffect(() => {
    localStorage.setItem('selectedTeams', JSON.stringify(selectedTeams))
  }, [selectedTeams])

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

        // Define available teams (matching Linear teams)
        const teams: Team[] = [
          { id: 'mar', name: 'Marketing+Community', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '📢', key: 'MAR' },
          { id: 'eng', name: 'Engineering', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '⚙️', key: 'ENG' },
          { id: 'product', name: 'Product', color: 'bg-green-100 text-green-800 border-green-200', icon: '🎯', key: 'PROD' },
          { id: 'design', name: 'Design', color: 'bg-pink-100 text-pink-800 border-pink-200', icon: '🎨', key: 'DES' },
          { id: 'biz', name: 'Business', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '💼', key: 'BIZ' },
          { id: 'ops', name: 'Operations', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⚡', key: 'OPS' }
        ]
        setAvailableTeams(teams)

        // Set default selected teams if none are saved
        if (selectedTeams.length === 0) {
          const defaultTeams = ['mar', 'eng', 'product']
          setSelectedTeams(defaultTeams)
          setActiveTab('mar')
        } else {
          setActiveTab(selectedTeams[0] || 'all')
        }

        // Fetch real milestones from Linear Summer Launch project
        try {
          const milestonesResponse = await fetch('/api/integrations/linear/milestones', { headers })
          if (milestonesResponse.ok) {
            const milestonesData = await milestonesResponse.json()
            if (milestonesData.success) {
              // Transform Linear milestones to match our interface
              const linearMilestones: Milestone[] = milestonesData.milestones.map((milestone: any) => ({
                id: milestone.id,
                title: milestone.title,
                description: milestone.description,
                due_date: milestone.due_date,
                status: milestone.status,
                priority: milestone.priority,
                cycle: milestone.cycle,
                team_id: milestone.team.key.toLowerCase(),
                team: {
                  id: milestone.team.key.toLowerCase(),
                  name: milestone.team.name,
                  key: milestone.team.key,
                  icon: milestone.team.icon,
                  color: getTeamColor(milestone.team.key)
                },
                tasks: milestone.tasks.map((task: any) => ({
                  id: task.id,
                  title: task.title,
                  status: mapLinearStatusToLocal(task.status),
                  priority: mapLinearPriorityToLocal(task.priority),
                  cycle: milestone.cycle,
                  assignee: task.assignee,
                  due_date: task.due_date,
                  url: task.url,
                  created_at: milestone.created_at
                })),
                progress: milestone.progress,
                progress_percentage: milestone.progress,
                created_at: milestone.created_at,
                updated_at: milestone.updated_at,
                overdue: milestone.overdue,
                project: milestone.project
              }))
              setMilestones(linearMilestones)
              // Debug: Log all tasks and their due dates
              console.log('=== DEBUG: All Linear Milestones and Tasks ===')
              linearMilestones.forEach(milestone => {
                console.log(`Milestone: "${milestone.title}" (${milestone.tasks.length} tasks)`)
                milestone.tasks.forEach(task => {
                  console.log(`  - Task: "${task.title}" | due_date: ${task.due_date} | status: ${task.status}`)
                })
              })
              
              // Set weekly tasks and active tasks without due dates
              const weeklyTasksResult = getWeeklyTasks(linearMilestones)
              const activeTasksResult = getActiveTasksWithoutDueDates(linearMilestones)
              
              console.log('=== Weekly Tasks Result ===', weeklyTasksResult)
              console.log('=== Active Tasks Result ===', activeTasksResult.length, 'tasks')
              
              setWeeklyTasks(weeklyTasksResult)
              setActiveTasks(activeTasksResult)
            } else {
              console.log('Failed to fetch milestones from Linear:', milestonesData.error)
              // Fallback to empty milestones
              setMilestones([])
              setWeeklyTasks({})
              setActiveTasks([])
            }
          } else {
            console.log('Milestones API failed:', milestonesResponse.status)
            // Fallback to empty milestones  
            setMilestones([])
          }
        } catch (error) {
          console.log('Milestones fetch error:', error)
          // Fallback to empty milestones
          setMilestones([])
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

  const getFilteredMilestones = () => {
    if (activeTab === 'all') return milestones
    return milestones.filter(milestone => milestone.team_id === activeTab)
  }

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        const newTeams = prev.filter(id => id !== teamId)
        // If removing the active tab, switch to first available tab or 'all'
        if (activeTab === teamId) {
          setActiveTab(newTeams.length > 0 ? newTeams[0] : 'all')
        }
        return newTeams
      } else {
        return [...prev, teamId]
      }
    })
  }

  const getMilestoneCountForTeam = (teamId: string) => {
    return milestones.filter(m => m.team_id === teamId).length
  }

  const getAvailableTabs = () => {
    const tabs = [{ id: 'all', name: 'All Teams', count: milestones.length }]
    
    selectedTeams.forEach(teamId => {
      const team = availableTeams.find(t => t.id === teamId)
      if (team) {
        tabs.push({
          id: teamId,
          name: team.name,
          count: getMilestoneCountForTeam(teamId),
          icon: team.icon,
          color: team.color
        })
      }
    })
    
    return tabs
  }

  return (
    <div className="theme-light min-h-screen p-4">
      <div className="max-w-7xl mx-auto space-y-ritual">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <h1 className="header-text mb-2">
            good morning, River
          </h1>
          <p className="subtext">{currentDate}</p>
        </div>

        {/* Weekly Task Overview */}
        <div className="card-container animate-fade-in-up mb-6">
          <h2 className="section-title mb-4">
            📅 This Week's Tasks
          </h2>
          
          <div className="grid grid-cols-5 gap-3">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map(day => {
              const dayTasks = weeklyTasks[day] || []
              const weekDates = getWeekDates()
              const dayInfo = weekDates[day]
              
              return (
                <div key={day} className="bg-white border border-neutral-200 rounded-xl p-3">
                  <div className="text-sm font-medium text-neutral-700 mb-2 text-center">
                    <div className="font-semibold">
                      {dayInfo?.formatted || day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                  </div>
                  
                  {dayTasks.length > 0 ? (
                    <div className="space-y-2">
                      {dayTasks.slice(0, 3).map(task => (
                        <div 
                          key={task.id} 
                          className="bg-neutral-50 rounded-lg p-2 cursor-pointer hover:bg-neutral-100 transition-colors"
                          onClick={() => {
                            if (task.url) {
                              window.open(task.url, '_blank')
                            }
                          }}
                        >
                          <div className="text-xs font-medium text-neutral-900 line-clamp-1 mb-1">
                            {task.title}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={`px-1 py-0.5 rounded border ${getTaskStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                            {task.assignee && (
                              <span className="text-neutral-500 truncate ml-1">
                                {task.assignee}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-neutral-500 text-center">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-400 text-center py-4">
                      No tasks
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Active Tasks Without Due Dates */}
        {activeTasks.length > 0 && (
          <div className="card-container animate-fade-in-up mb-6">
            <h2 className="section-title mb-4">
              🔄 Active Tasks (No Due Date)
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeTasks.map(task => (
                <div 
                  key={task.id} 
                  className="bg-white border border-neutral-200 rounded-xl p-3 cursor-pointer hover:border-neutral-300 transition-colors hover:bg-neutral-50"
                  onClick={() => {
                    if (task.url) {
                      window.open(task.url, '_blank')
                    }
                  }}
                >
                  <div className="text-sm font-medium text-neutral-900 line-clamp-2 mb-2">
                    {task.title}
                  </div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className={`px-2 py-1 rounded border ${getTaskStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    {task.assignee && (
                      <span className="text-neutral-500 truncate ml-1">
                        👤 {task.assignee}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400">
                    {task.milestone_title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        <div className="card-container animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">
              🎯 Milestones
            </h2>
            <button
              onClick={() => setShowTeamSettings(true)}
              className="text-neutral-400 hover:text-neutral-600 p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              title="Team Settings"
            >
              ⚙️
            </button>
          </div>

          {/* Team Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
            {getAvailableTabs().map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.name}</span>
                <span className="text-xs opacity-75">({tab.count})</span>
              </button>
            ))}
          </div>
          
          {milestonesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl"></div>
              ))}
            </div>
          ) : getFilteredMilestones().length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredMilestones().map((milestone) => {
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
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-neutral-900 text-sm">{milestone.title}</span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${milestone.team.color}`}>
                          {milestone.team.icon}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 line-clamp-2 mb-3">{milestone.description}</p>
                      
                      <div className="flex items-center justify-between text-xs">
                        <div className={`font-medium ${isOverdue ? 'text-red-600' : 'text-neutral-500'}`}>
                          {formatDueDate(milestone.due_date)}
                        </div>
                        <div className="text-neutral-400">
                          {milestone.tasks.length} tasks
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-neutral-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${milestone.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-neutral-500 min-w-[3rem]">
                        {milestone.progress}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎯</div>
              <p className="subtext">
                {activeTab === 'all' 
                  ? 'No milestones yet. Set your first goal!' 
                  : `No milestones for ${availableTeams.find(t => t.id === activeTab)?.name || 'this team'} yet.`
                }
              </p>
              <button className="btn-secondary mt-4">
                Add Milestone
              </button>
            </div>
          )}
        </div>

        {/* Team Settings Modal */}
        {showTeamSettings && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTeamSettings(false)
              }
            }}
          >
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-neutral-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-neutral-900">
                    Team Settings
                  </h3>
                  <button 
                    onClick={() => setShowTeamSettings(false)}
                    className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <p className="text-neutral-600 text-sm mt-2">
                  Select which teams to show as tabs in your milestones view
                </p>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {availableTeams.map(team => (
                    <div key={team.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{team.icon}</span>
                        <div>
                          <div className="font-medium text-neutral-900">{team.name}</div>
                          <div className="text-xs text-neutral-500">
                            {getMilestoneCountForTeam(team.id)} milestones
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleTeamToggle(team.id)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          selectedTeams.includes(team.id)
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                          selectedTeams.includes(team.id)
                            ? 'translate-x-7'
                            : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <button
                    onClick={() => setShowTeamSettings(false)}
                    className="btn-primary w-full"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Milestone Detail Modal */}
        {selectedMilestone && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedMilestone(null)
              }
            }}
          >
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
                  <span className={`px-2 py-1 rounded-full border ${selectedMilestone.team.color}`}>
                    {selectedMilestone.team.icon} {selectedMilestone.team.name}
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
                    Tasks ({getFilteredTasksByStatus(selectedMilestone).length})
                  </h4>
                  
                  {/* Status Filter */}
                  <div className="flex gap-1 flex-wrap">
                    {getUniqueTaskStatuses(selectedMilestone).map(status => (
                      <button
                        key={status}
                        onClick={() => setTaskStatusFilter(status)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          taskStatusFilter === status 
                            ? 'bg-blue-100 text-blue-800 border-blue-200' 
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-3">
                  {getFilteredTasksByStatus(selectedMilestone).map(task => (
                    <div 
                      key={task.id} 
                      className="border border-neutral-200 rounded-xl p-4 hover:border-neutral-300 transition-colors cursor-pointer hover:bg-neutral-50"
                      onClick={() => {
                        if (task.url) {
                          window.open(task.url, '_blank')
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-neutral-900">{task.title}</span>
                            <span className={`text-xs px-2 py-1 rounded-full border ${getTaskStatusColor(task.status)}`}>
                              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-neutral-600 mb-2">{task.description}</p>
                          )}
                        </div>
                        <div className="ml-4 text-right">
                          <div className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {typeof task.priority === 'string' ? task.priority.toUpperCase() : 'MEDIUM'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <div className="flex items-center gap-4">
                          {task.due_date && (
                            <span>
                              📅 Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                          {task.assignee && (
                            <span>
                              👤 {task.assignee}
                            </span>
                          )}
                        </div>
                        {task.url && (
                          <a 
                            href={task.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            View in Linear →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {getFilteredTasksByStatus(selectedMilestone).length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-2xl mb-2">📝</div>
                      <p className="text-neutral-500">
                        {taskStatusFilter === 'all' ? 'No tasks yet' : `No ${taskStatusFilter} tasks`}
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