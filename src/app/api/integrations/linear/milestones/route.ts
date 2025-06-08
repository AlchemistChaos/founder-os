import { NextRequest, NextResponse } from 'next/server'
import { createLinearAPI } from '@/lib/integrations/linear-api'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.LINEAR_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LINEAR_API_KEY not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')
    const teamFilter = searchParams.get('team')

    const linearAPI = createLinearAPI(apiKey)

    // Get all projects and milestones
    const [projects, milestones] = await Promise.all([
      linearAPI.getProjects(),
      linearAPI.getProjectMilestones()
    ])

    // Find the Summer Launch project
    const summerLaunchProject = projects.find(p => 
      p.name.toLowerCase().includes('summer launch')
    )

    // Get milestones for Summer Launch project
    const summerLaunchMilestones = milestones.filter(m => 
      m.project.id === summerLaunchProject?.id
    )

    // Find Marketing+Community team ID
    const teams = await linearAPI.getTeams()
    const marketingTeam = teams.find(t => 
      t.name.toLowerCase().includes('marketing') || 
      t.key === 'MAR'
    )

    // Transform milestones to morning page format
    const formattedMilestones = summerLaunchMilestones.map(milestone => {
      const progress = calculateMilestoneProgress(milestone)
      const status = getStatusFromProgress(progress)
      const isOverdue = milestone.targetDate && new Date(milestone.targetDate) < new Date()

      return {
        id: milestone.id,
        title: milestone.name,
        description: milestone.description || '',
        progress,
        status,
        due_date: milestone.targetDate,
        team: {
          id: marketingTeam?.id || '',
          name: 'Marketing+Community',
          key: 'MAR',
          icon: '📢',
          color: 'blue'
        },
        project: {
          id: milestone.project.id,
          name: milestone.project.name
        },
        tasks: [], // Will be populated from issues if needed
        cycle: determineCycle(milestone.targetDate),
        priority: determinePriority(milestone),
        overdue: isOverdue,
        created_at: milestone.createdAt,
        updated_at: milestone.updatedAt
      }
    })

    // Get issues for the Summer Launch project to populate tasks
    const issues = await linearAPI.getIssues()
    const summerLaunchIssues = issues.filter(issue => 
      issue.project?.id === summerLaunchProject?.id
    )

    // Group issues by milestone
    const milestoneIssues = new Map()
    summerLaunchIssues.forEach(issue => {
      if (issue.projectMilestone?.id) {
        if (!milestoneIssues.has(issue.projectMilestone.id)) {
          milestoneIssues.set(issue.projectMilestone.id, [])
        }
        milestoneIssues.get(issue.projectMilestone.id).push({
          id: issue.id,
          title: issue.title,
          status: issue.state.name,
          assignee: issue.assignee?.name,
          priority: issue.priority,
          url: issue.url
        })
      }
    })

    // Add tasks to milestones
    formattedMilestones.forEach(milestone => {
      milestone.tasks = milestoneIssues.get(milestone.id) || []
    })

    return NextResponse.json({
      success: true,
      milestones: formattedMilestones,
      project: summerLaunchProject,
      team: marketingTeam,
      count: formattedMilestones.length
    })

  } catch (error) {
    console.error('Linear milestones API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch Linear milestones',
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