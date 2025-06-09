import { NextRequest, NextResponse } from 'next/server'
import { createLinearAPI } from '@/lib/integrations/linear-api'
import { apiCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teamKey = searchParams.get('team') // e.g., 'MAR', 'ENG', etc.
    const includeDueDates = searchParams.get('includeDueDates') === 'true' // Include tasks with due dates
    
    // Check cache first with shorter TTL for active tasks (2 minutes)
    const cacheKey = `${CACHE_KEYS.LINEAR_ACTIVE_TASKS}_${teamKey || 'all'}_${includeDueDates ? 'with_due' : 'no_due'}`
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

    // Get all teams to find the team ID for the key
    const teams = await linearAPI.getTeams()
    let teamId: string | undefined
    
    if (teamKey) {
      const team = teams.find(t => t.key === teamKey.toUpperCase())
      teamId = team?.id
    }

    // Get all issues (don't filter by team in the API call, filter afterwards)
    const allIssues = await linearAPI.getIssues(undefined, 200) // Get all issues, no team filter

    // Filter for active tasks
    const activeStatuses = ['Todo', 'Backlog', 'In Progress', 'In Review', 'Started', 'Doing', 'Blocked', 'Triage', 'On Hold']
    
    const activeTasks = allIssues
      .filter(issue => 
        (includeDueDates ? true : !issue.dueDate) && // Include tasks with due dates if requested
        activeStatuses.includes(issue.state.name) &&
        (teamKey ? issue.team.key === teamKey.toUpperCase() : true) // Filter by team if specified
      )
      .map(issue => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        status: issue.state.name,
        assignee: issue.assignee?.name,
        priority: issue.priority,
        due_date: issue.dueDate,
        url: issue.url,
        team: {
          id: issue.team.id,
          name: issue.team.name,
          key: issue.team.key
        },
        project: issue.project ? {
          id: issue.project.id,
          name: issue.project.name
        } : null,
        milestone: issue.projectMilestone ? {
          id: issue.projectMilestone.id,
          name: issue.projectMilestone.name
        } : null,
        labels: issue.labels?.nodes || [],
        created_at: issue.createdAt,
        updated_at: issue.updatedAt
      }))

    const response = {
      success: true,
      team_key: teamKey,
      count: activeTasks.length,
      tasks: activeTasks
    }

    // Cache the response for 2 minutes (120000ms)
    apiCache.set(cacheKey, response, 120000)

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error fetching Linear active tasks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch active tasks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}