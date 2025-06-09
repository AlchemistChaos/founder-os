'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import React from 'react'

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

export const MorningReview = React.memo(function MorningReview() {
  const [flashcardsDue, setFlashcardsDue] = useState<FlashcardDue[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [availableTeams, setAvailableTeams] = useState<Team[]>([])
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['mar'])
  const [activeTab, setActiveTab] = useState<string>('mar')
  const [showTeamSettings, setShowTeamSettings] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)
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

  // Helper functions moved to bottom of component to avoid duplication

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const headers: HeadersInit = session?.access_token ? {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }

      if (!session?.access_token) {
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
        }
      } catch (error) {
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
        const defaultTeams = ['mar']
        setSelectedTeams(defaultTeams)
        setActiveTab('mar')
      } else {
        setActiveTab(selectedTeams[0] || 'mar')
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
            // Process weekly and active tasks
            
            // Weekly and active tasks will be calculated in a separate effect
            // when activeTab changes
            setWeeklyTasks({})
            setActiveTasks([])
          } else {
            // Fallback to empty milestones
            setMilestones([])
            setWeeklyTasks({})
            setActiveTasks([])
          }
        } else {
          // Fallback to empty milestones  
          setMilestones([])
        }
      } catch (error) {
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
        }
      } catch (error) {
      }

      // Fetch AI insights from our 3-agent pipeline
      try {
        let insightsResponse = await fetch('/api/ai-insights?limit=5', { headers })
        
        if (!insightsResponse.ok && insightsResponse.status === 401) {
          insightsResponse = await fetch('/api/ai-insights?test=true&limit=5')
        }
        
        if (insightsResponse.ok) {
          const insightsData = await insightsResponse.json()
          setAiInsights(insightsData.insights || [])
        } else {
        }
      } catch (error) {
      }

      // No business updates needed
      
    } catch (error) {
      console.error('Error fetching morning review data:', error)
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Recalculate tasks when activeTab or milestones change
  useEffect(() => {
    const updateTasks = async () => {
      // console.log('updateTasks called - milestones.length:', milestones.length, 'activeTab:', activeTab)
      
      // Get weekly tasks from Linear API (not just milestones)
      const weeklyTasksResult = await getWeeklyTasksFromLinear()
      setWeeklyTasks(weeklyTasksResult)
      
      // Get active tasks from Linear API
      // console.log('Calling getActiveTasksWithoutDueDates...')
      const activeTasksResult = await getActiveTasksWithoutDueDates()
      // console.log('Active tasks result:', activeTasksResult)
      setActiveTasks(activeTasksResult)
    }
    
    updateTasks()
  }, [activeTab, milestones])

  // Memoize event handlers
  const handleTeamToggle = useCallback((teamId: string) => {
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
  }, [selectedTeams, activeTab])

  const handleInsightAction = useCallback((_insightId: string, _action: 'star' | 'flashcard' | 'view') => {
    // TODO: Implement insight actions
  }, [])

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
    
    // Filter milestones by active tab
    const filteredMilestones = activeTab === 'all' 
      ? milestones 
      : milestones.filter(milestone => milestone.team_id === activeTab)
    
    filteredMilestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        if (task.due_date) {
          const taskDate = new Date(task.due_date)
          
          // Check if task is due Monday-Friday of the target week
          for (let i = 0; i < 5; i++) {
            const dayDate = new Date(startOfBusinessWeek)
            dayDate.setDate(startOfBusinessWeek.getDate() + i)
            
            // Check if task is due on this specific day
            if (taskDate.toDateString() === dayDate.toDateString()) {
              const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
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

  const getWeeklyTasksFromLinear = async () => {
    const weeklyTasksMap: {[key: string]: Task[]} = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: []
    }
    
    try {
      // Get all issues from Linear API
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }

      // Get team key for the API call  
      const teamKey = getTeamKeyFromId(activeTab)
      const apiUrl = activeTab === 'all' 
        ? '/api/integrations/linear/active-tasks?includeDueDates=true'
        : `/api/integrations/linear/active-tasks?team=${teamKey}&includeDueDates=true`

      const response = await fetch(apiUrl, { headers })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Calculate current business week dates
          const today = new Date()
          const currentDayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
          
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
          
          // Filter tasks with due dates in this business week
          data.tasks.forEach((task: any) => {
            if (task.due_date) {
              const taskDate = new Date(task.due_date)
              
              // Check if task is due Monday-Friday of the target week
              for (let i = 0; i < 5; i++) {
                const dayDate = new Date(startOfBusinessWeek)
                dayDate.setDate(startOfBusinessWeek.getDate() + i)
                
                // Check if task is due on this specific day
                if (taskDate.toDateString() === dayDate.toDateString()) {
                  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                  weeklyTasksMap[dayNames[i]].push({
                    id: task.id,
                    title: task.title,
                    status: task.status,
                    assignee: task.assignee,
                    priority: task.priority || 0,
                    due_date: task.due_date,
                    url: task.url,
                    milestone_title: task.milestone?.name || (task.project?.name || 'No Project'),
                    milestone_id: task.milestone?.id || null
                  })
                  break
                }
              }
            }
          })
        }
      }
    } catch (error) {
      console.error('Error fetching weekly tasks:', error)
    }
    
    return weeklyTasksMap
  }

  const getActiveTasksWithoutDueDates = async () => {
    const activeTasks: Task[] = []
    // Include more Linear statuses to catch all active tasks
    const activeStatuses = ['backlog', 'todo', 'in_progress', 'review', 'in review', 'started', 'doing', 'blocked', 'triage', 'on hold']
    
    try {
      // Get all issues from our new active tasks API
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = session?.access_token ? {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }

      // Get team key for the API call
      const teamKey = getTeamKeyFromId(activeTab)
      const apiUrl = activeTab === 'all' 
        ? '/api/integrations/linear/active-tasks'
        : `/api/integrations/linear/active-tasks?team=${teamKey}`

      // Fetch active tasks from our new API
      // console.log('Fetching active tasks from:', apiUrl)
      const response = await fetch(apiUrl, { headers })
      // console.log('Response status:', response.status, response.ok)
      if (response.ok) {
        const data = await response.json()
        // console.log('Active tasks API response:', data)
        if (data.success) {
          // Convert to our task format
          data.tasks.forEach((task: any) => {
            activeTasks.push({
              id: task.id,
              title: task.title,
              status: task.status,
              assignee: task.assignee,
              priority: task.priority || 0,
              due_date: task.due_date,
              url: task.url,
              milestone_title: task.milestone?.name || (task.project?.name || 'No Project'),
              milestone_id: task.milestone?.id || null
            })
          })
          // console.log('Processed active tasks:', activeTasks)
        }
      } else {
        console.error('API call failed:', response.status, await response.text())
      }
    } catch (error) {
      console.error('Error fetching active tasks:', error)
    }
    
    return activeTasks
  }

  // Helper function to convert team id to team key
  const getTeamKeyFromId = (teamId: string): string => {
    const teamMap: Record<string, string> = {
      'mar': 'MAR',
      'eng': 'ENG', 
      'product': 'PROD',
      'design': 'DES',
      'biz': 'BIZ',
      'ops': 'OPS',
      'fun': 'FUN',
      'pul': 'PUL',
      'fir': 'FIR',
      'hard': 'HARD',
      'cre': 'CRE',
      'web': 'WEB',
      'mob': 'MOB'
    }
    return teamMap[teamId] || teamId.toUpperCase()
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
    const savedActiveTab = localStorage.getItem('activeTab')
    
    if (savedTeams) {
      const teams = JSON.parse(savedTeams)
      setSelectedTeams(teams)
      if (savedActiveTab && teams.includes(savedActiveTab)) {
        setActiveTab(savedActiveTab)
      } else if (teams.length > 0) {
        setActiveTab(teams[0])
      }
    }
  }, [])

  // Save team preferences to localStorage
  useEffect(() => {
    localStorage.setItem('selectedTeams', JSON.stringify(selectedTeams))
  }, [selectedTeams])

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])


  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return 0
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const formatDueDate = (dueDate: string | null) => {
    if (!dueDate) return 'No due date'
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

  const getMilestoneCountForTeam = (teamId: string) => {
    return milestones.filter(m => m.team_id === teamId).length
  }

  const getAvailableTabs = () => {
    const tabs: Array<{id: string, name: string, count: number, icon?: string, color?: string}> = [
      { id: 'all', name: 'All Teams', count: milestones.length }
    ]
    
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

  // console.log('MorningReview render - activeTasks:', activeTasks, 'activeTab:', activeTab)
  
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
                      {dayTasks.slice(0, 5).map(task => (
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
                      {dayTasks.length > 5 && (
                        <div className="text-xs text-neutral-500 text-center">
                          +{dayTasks.length - 5} more
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
        <div className="card-container animate-fade-in-up mb-6">
          <h2 className="section-title mb-4">
            🔄 Active Tasks (No Due Date)
          </h2>
          
          {activeTasks.length > 0 ? (
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
          ) : (
            <div className="text-center py-4 text-neutral-500">
              No active tasks found for this team.
            </div>
          )}
        </div>

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
          ) : milestones.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestones
                .filter(milestone => activeTab === 'all' || milestone.team_id === activeTab)
                .map((milestone) => {
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
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Team Settings</h3>
              
              <div className="space-y-3 mb-6">
                {availableTeams.map(team => (
                  <label key={team.id} className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(team.id)}
                      onChange={() => handleTeamToggle(team.id)}
                      className="rounded"
                    />
                    <span className="text-xl">{team.icon}</span>
                    <span className="font-medium">{team.name}</span>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTeamSettings(false)}
                  className="flex-1 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Done
                </button>
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
            <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{selectedMilestone.title}</h3>
                  <p className="text-neutral-600 mb-4">{selectedMilestone.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className={`px-3 py-1 rounded-full border ${selectedMilestone.team.color}`}>
                      {selectedMilestone.team.icon} {selectedMilestone.team.name}
                    </span>
                    <span className="text-neutral-500">
                      Due: {formatDueDate(selectedMilestone.due_date)}
                    </span>
                    <span className="text-neutral-500">
                      {selectedMilestone.progress}% complete
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMilestone(null)}
                  className="text-neutral-400 hover:text-neutral-600 p-2"
                >
                  ✕
                </button>
              </div>

              {/* Task Status Filter */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {getUniqueTaskStatuses(selectedMilestone).map(status => (
                  <button
                    key={status}
                    onClick={() => setTaskStatusFilter(status)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      taskStatusFilter === status
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All Tasks' : status.replace('_', ' ')} 
                    ({status === 'all' ? selectedMilestone.tasks.length : selectedMilestone.tasks.filter(t => t.status.toLowerCase() === status).length})
                  </button>
                ))}
              </div>

              {/* Tasks */}
              <div className="space-y-3">
                {getFilteredTasksByStatus(selectedMilestone).map(task => (
                  <div 
                    key={task.id} 
                    className="border border-neutral-200 rounded-xl p-4 cursor-pointer hover:border-neutral-300 transition-colors"
                    onClick={() => {
                      if (task.url) {
                        window.open(task.url, '_blank')
                      }
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-neutral-900">{task.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs border ${getTaskStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-neutral-500">
                      {task.assignee && (
                        <span>👤 {task.assignee}</span>
                      )}
                      {task.due_date && (
                        <span>📅 {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                      {task.cycle && (
                        <span>🔄 {task.cycle}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Flashcards Due */}
        {flashcardsDue.length > 0 && (
          <div className="card-container animate-fade-in-up">
            <h2 className="section-title mb-4">
              🧠 Flashcards Due ({flashcardsDue.length})
            </h2>
            <div className="space-y-3">
              {flashcardsDue.slice(0, 3).map((flashcard) => (
                <div key={flashcard.id} className="p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                  <p className="font-medium text-neutral-900 mb-2">{flashcard.question}</p>
                  <div className="flex gap-2">
                    {flashcard.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {flashcardsDue.length > 3 && (
                <div className="text-center">
                  <button className="btn-primary">
                    Review All ({flashcardsDue.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Insights */}
        <div className="card-container animate-fade-in-up">
          <h2 className="section-title mb-4">
            🤖 AI Insights
          </h2>
          {insightsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 rounded-xl"></div>
              ))}
            </div>
          ) : aiInsights.length > 0 ? (
            <div className="space-y-4">
              {aiInsights.map((insight) => (
                <div key={insight.id} className="p-4 border border-neutral-200 rounded-xl">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-neutral-900 mb-1">{insight.insight_text}</h4>
                      <p className="text-sm text-neutral-600 mb-2">{insight.context}</p>
                      
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span className="bg-neutral-100 px-2 py-1 rounded">
                          {insight.category}
                        </span>
                        <span className={`px-2 py-1 rounded ${
                          insight.priority === 'high' ? 'bg-red-100 text-red-800' :
                          insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {insight.priority}
                        </span>
                        <span>{insight.meeting_title}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleInsightAction(insight.id, 'star')}
                        className="p-2 text-neutral-400 hover:text-yellow-500 transition-colors"
                        title="Star insight"
                      >
                        ⭐
                      </button>
                      {!insight.has_flashcard && (
                        <button
                          onClick={() => handleInsightAction(insight.id, 'flashcard')}
                          className="p-2 text-neutral-400 hover:text-blue-500 transition-colors"
                          title="Create flashcard"
                        >
                          🧠
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {insight.how_to_implement && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>How to implement:</strong> {insight.how_to_implement}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🤖</div>
              <p className="subtext">No insights available yet</p>
            </div>
          )}
        </div>

        {/* Recent Meetings */}
        {meetings.length > 0 && (
          <div className="card-container animate-fade-in-up">
            <h2 className="section-title mb-4">
              📋 Recent Meetings
            </h2>
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="p-4 border border-neutral-200 rounded-xl">
                  <h4 className="font-medium text-neutral-900 mb-2">{meeting.title}</h4>
                  <p className="text-sm text-neutral-600 mb-3">{meeting.summary}</p>
                  
                  {meeting.insights.length > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-sm font-medium text-neutral-700">Action Items:</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        {meeting.insights.slice(0, 3).map((insight, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-neutral-400 mt-1">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="text-xs text-neutral-400 mt-3">
                    {new Date(meeting.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})