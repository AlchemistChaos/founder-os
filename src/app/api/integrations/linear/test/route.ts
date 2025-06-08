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

    const linear = createLinearAPI(apiKey)
    
    // Test the connection
    const connectionTest = await linear.testConnection()
    
    if (!connectionTest.success) {
      return NextResponse.json(
        { error: 'Failed to connect to Linear API', details: connectionTest.error },
        { status: 401 }
      )
    }

    // Get user's teams
    const teams = await linear.getTeams()
    
    // Get latest issues for testing
    const recentIssues = await linear.getIssues(undefined, 10)
    
    return NextResponse.json({
      success: true,
      connection: connectionTest,
      teams: teams,
      recent_issues: {
        count: recentIssues.length,
        issues: recentIssues.slice(0, 5) // First 5 for preview
      }
    })

  } catch (error) {
    console.error('Linear API test failed:', error)
    return NextResponse.json(
      { 
        error: 'Linear API test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 