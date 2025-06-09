import { NextRequest, NextResponse } from 'next/server'
import { createLinearAPI } from '@/lib/integrations/linear-api'
import { apiCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    // Check cache first with longer TTL for milestones (10 minutes)
    const cacheKey = CACHE_KEYS.LINEAR_MILESTONES
    const cachedData = apiCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    const linearApiKey = process.env.LINEAR_API_KEY
    if (!linearApiKey) {
      return NextResponse.json(
        { error: 'Linear API key not configured' },
        { status: 500 }
      )
    }

    const linearAPI = createLinearAPI(linearApiKey)

    // Get project milestones, projects, teams, and issues
    const [projectMilestones, projects, teams, allIssues] = await Promise.all([
      linearAPI.getProjectMilestones(),
      linearAPI.getProjects(),
      linearAPI.getTeams(),
      linearAPI.getIssues()
    ])
    
    // Match milestones with their projects
    const allMilestones = projectMilestones.map(milestone => {
      const project = projects.find(p => p.id === milestone.project.id)
      return {
        ...milestone,
        project: project ? {
          id: project.id,
          name: project.name
        } : milestone.project
      }
    })
    
    // Create milestones with their tasks
    const milestonesWithTasks = allMilestones.map(milestone => {
      const tasks = allIssues.filter(issue => 
        issue.projectMilestone?.id === milestone.id
      ).map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.state?.name || 'Todo',
        assignee: issue.assignee?.name,
        priority: issue.priority || 0,
        due_date: issue.dueDate,
        url: issue.url,
        labels: issue.labels?.nodes || []
      }))

      // Get team from the first task's team, or default to a general team
      const firstTask = allIssues.find(issue => issue.projectMilestone?.id === milestone.id)
      const team = firstTask?.team || { key: 'GEN', name: 'General', id: 'general' }

      const progress = calculateMilestoneProgress(milestone)

      return {
        id: milestone.id,
        title: milestone.name,
        description: milestone.description || 'No description',
        due_date: milestone.targetDate,
        status: getStatusFromProgress(progress),
        priority: determinePriority(milestone),
        cycle: determineCycle(milestone.targetDate),
        team: {
          id: team.key.toLowerCase(),
          name: team.name,
          key: team.key,
          icon: getTeamIcon(team.key),
          color: getTeamColor(team.key)
        },
        tasks: tasks,
        progress: progress,
        created_at: milestone.createdAt,
        updated_at: milestone.updatedAt,
        overdue: milestone.targetDate ? new Date(milestone.targetDate) < new Date() : false,
        project: {
          id: milestone.project.id,
          name: milestone.project.name
        }
      }
    })

    const response = {
      success: true,
      milestones: milestonesWithTasks
    }

    // Cache the response for 10 minutes (600000ms)
    apiCache.set(cacheKey, response, 600000)

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error fetching Linear milestones:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch milestones',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function calculateMilestoneProgress(milestone: any): number {
  // For now, use a simple calculation
  // In a real implementation, you'd calculate based on completed vs total issues
  const targetDate = milestone.targetDate ? new Date(milestone.targetDate) : null
  const now = new Date()
  
  if (!targetDate) return 0
  
  if (targetDate < now) {
    return 75 // If overdue, assume some progress
  }
  
  // Mock progress based on milestone name patterns
  if (milestone.name.includes('Hype Site')) return 85
  if (milestone.name.includes('TikTok')) return 40
  if (milestone.name.includes('Teaser 1')) return 30
  if (milestone.name.includes('Teaser 2')) return 15
  if (milestone.name.includes('Launch Party')) return 25
  if (milestone.name.includes('Origins')) return 20
  if (milestone.name.includes('Waitlist')) return 60
  
  return Math.floor(Math.random() * 80) + 10 // Random for others
}

function getStatusFromProgress(progress: number): string {
  if (progress === 0) return 'not_started'
  if (progress >= 100) return 'completed'
  return 'in_progress'
}

function determineCycle(targetDate: string | null): string {
  if (!targetDate) return 'Q3 2025'
  
  const date = new Date(targetDate)
  const month = date.getMonth() + 1 // 1-12
  
  if (month <= 3) return 'Q1 2025'
  if (month <= 6) return 'Q2 2025'
  if (month <= 9) return 'Q3 2025'
  return 'Q4 2025'
}

function determinePriority(milestone: any): 'high' | 'medium' | 'low' {
  const name = milestone.name.toLowerCase()
  
  if (name.includes('launch') || name.includes('teaser')) return 'high'
  if (name.includes('tiktok') || name.includes('origins')) return 'medium'
  return 'low'
}

function getTeamIcon(teamKey: string): string {
  const icons: Record<string, string> = {
    'MAR': '📢',
    'ENG': '⚙️',
    'PROD': '🎯',
    'DES': '🎨',
    'BIZ': '💼',
    'OPS': '⚡',
    'GEN': '📋',
    'FUN': '💰',
    'PUL': '📱',
    'FIR': '🔧',
    'HARD': '🛠️',
    'CRE': '🎨',
    'WEB': '🌐',
    'MOB': '📱'
  }
  return icons[teamKey] || '📋'
}

function getTeamColor(teamKey: string): string {
  const colors: Record<string, string> = {
    'MAR': 'bg-blue-100 text-blue-800 border-blue-200',
    'ENG': 'bg-purple-100 text-purple-800 border-purple-200',
    'PROD': 'bg-green-100 text-green-800 border-green-200',
    'DES': 'bg-pink-100 text-pink-800 border-pink-200',
    'BIZ': 'bg-orange-100 text-orange-800 border-orange-200',
    'OPS': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'GEN': 'bg-gray-100 text-gray-800 border-gray-200',
    'FUN': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'PUL': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'FIR': 'bg-red-100 text-red-800 border-red-200',
    'HARD': 'bg-slate-100 text-slate-800 border-slate-200',
    'CRE': 'bg-pink-100 text-pink-800 border-pink-200',
    'WEB': 'bg-cyan-100 text-cyan-800 border-cyan-200',
    'MOB': 'bg-violet-100 text-violet-800 border-violet-200'
  }
  return colors[teamKey] || 'bg-gray-100 text-gray-800 border-gray-200'
}

