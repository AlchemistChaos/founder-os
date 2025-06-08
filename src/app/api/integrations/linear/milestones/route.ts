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

    // Get projects and their milestones
    const projects = await linearAPI.getProjects()
    
    // Extract all milestones from projects
    const allMilestones = projects.flatMap(project => 
      project.milestones.nodes.map(milestone => ({
        ...milestone,
        project: {
          id: project.id,
          name: project.name
        },
        team: project.team
      }))
    )

    // Also get all issues to associate with milestones
    const allIssues = await linearAPI.getIssues()
    
    // Create milestones with their tasks
    const milestonesWithTasks = allMilestones.map(milestone => {
      const tasks = allIssues.filter(issue => 
        issue.projectMilestone?.id === milestone.id
      ).map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        state: issue.state,
        assignee: issue.assignee,
        priority: issue.priority,
        dueDate: issue.dueDate,
        url: issue.url,
        labels: issue.labels?.nodes || []
      }))

      return {
        id: milestone.id,
        title: milestone.name,
        description: milestone.description,
        targetDate: milestone.targetDate,
        sortOrder: milestone.sortOrder,
        project_id: milestone.project.id,
        project_name: milestone.project.name,
        team_id: milestone.team.id,
        team_name: milestone.team.name,
        team_key: milestone.team.key,
        taskCount: tasks.length,
        tasks: tasks,
        createdAt: milestone.createdAt,
        updatedAt: milestone.updatedAt
      }
    })

    // Cache the response for 10 minutes (600000ms)
    apiCache.set(cacheKey, milestonesWithTasks, 600000)

    return NextResponse.json(milestonesWithTasks)
    
  } catch (error) {
    console.error('Error fetching Linear milestones:', error)
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
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

// Removed generateSampleDueDate function since we don't want fake due dates
// Tasks should only have due dates if they actually have them in Linear