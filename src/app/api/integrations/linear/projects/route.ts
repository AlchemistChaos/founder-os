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
    const teamId = searchParams.get('team_id')
    const searchTerm = searchParams.get('search')

    const linearAPI = createLinearAPI(apiKey)

    let projects
    if (searchTerm) {
      // Search for projects by name (e.g., "summer launch")
      projects = await linearAPI.searchProjects(searchTerm)
    } else {
      // Get all projects or projects for a specific team
      projects = await linearAPI.getProjects(teamId || undefined)
    }

    // Also get all project milestones
    const milestones = await linearAPI.getProjectMilestones()

    return NextResponse.json({
      success: true,
      projects,
      milestones,
      count: projects.length,
      milestones_count: milestones.length
    })

  } catch (error) {
    console.error('Linear projects API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch Linear projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 