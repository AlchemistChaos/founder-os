// Linear API Integration using GraphQL
// This approach fetches data directly from Linear's API instead of using webhooks

interface LinearAPIConfig {
  apiKey: string
  baseUrl?: string
}

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string
  state: {
    id: string
    name: string
    type: string
  }
  assignee?: {
    id: string
    name: string
    email: string
  }
  team: {
    id: string
    name: string
    key: string
  }
  labels: {
    nodes: Array<{
      id: string
      name: string
      color: string
    }>
  }
  priority: number
  createdAt: string
  updatedAt: string
  url: string
  creator: {
    id: string
    name: string
    email: string
  }
  comments: {
    nodes: Array<{
      id: string
      body: string
      user: {
        id: string
        name: string
        email: string
      }
      createdAt: string
    }>
  }
}

interface LinearTeam {
  id: string
  name: string
  key: string
  description?: string
}

export class LinearAPI {
  private apiKey: string
  private baseUrl: string

  constructor(config: LinearAPIConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.linear.app/graphql'
  }

  // Make GraphQL request to Linear API
  private async makeRequest(query: string, variables: Record<string, any> = {}): Promise<any> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        })
      })

      const data = await response.json()

      if (data.errors) {
        throw new Error(`Linear API Error: ${data.errors[0].message}`)
      }

      return data.data
    } catch (error) {
      console.error('Linear API request failed:', error)
      throw error
    }
  }

  // Get user's teams
  async getTeams(): Promise<LinearTeam[]> {
    const query = `
      query GetTeams {
        teams {
          nodes {
            id
            name
            key
            description
          }
        }
      }
    `

    const data = await this.makeRequest(query)
    return data.teams.nodes
  }

  // Get issues for a team or all teams
  async getIssues(teamId?: string, limit: number = 50): Promise<LinearIssue[]> {
    const query = `
      query GetIssues($first: Int) {
        issues(
          first: $first
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            assignee {
              id
              name
              email
            }
            team {
              id
              name
              key
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            priority
            createdAt
            updatedAt
            url
            creator {
              id
              name
              email
            }
            comments {
              nodes {
                id
                body
                user {
                  id
                  name
                  email
                }
                createdAt
              }
            }
          }
        }
      }
    `

    const data = await this.makeRequest(query, { first: limit })
    
    // Filter by team if specified
    let issues = data.issues.nodes
    if (teamId) {
      issues = issues.filter((issue: LinearIssue) => issue.team.id === teamId)
    }
    
    return issues
  }

  // Get recent issues (last 7 days)
  async getRecentIssues(days: number = 7): Promise<LinearIssue[]> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const query = `
      query GetRecentIssues($first: Int) {
        issues(
          first: $first
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            assignee {
              id
              name
              email
            }
            team {
              id
              name
              key
            }
            labels {
              nodes {
                id
                name
                color
              }
            }
            priority
            createdAt
            updatedAt
            url
            creator {
              id
              name
              email
            }
            comments {
              nodes {
                id
                body
                user {
                  id
                  name
                  email
                }
                createdAt
              }
            }
          }
        }
      }
    `

    const data = await this.makeRequest(query, {
      first: 100
    })
    
    // Filter results by date in JavaScript since GraphQL filter is complex
    const filteredIssues = data.issues.nodes.filter((issue: LinearIssue) => {
      const updatedAt = new Date(issue.updatedAt)
      return updatedAt >= since
    })
    return filteredIssues
  }

  // Get my assigned issues
  async getMyIssues(): Promise<LinearIssue[]> {
    const query = `
      query GetMyIssues {
        viewer {
          assignedIssues {
            nodes {
              id
              identifier
              title
              description
              state {
                id
                name
                type
              }
              assignee {
                id
                name
                email
              }
              team {
                id
                name
                key
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              priority
              createdAt
              updatedAt
              url
              creator {
                id
                name
                email
              }
              comments {
                nodes {
                  id
                  body
                  user {
                    id
                    name
                    email
                  }
                  createdAt
                }
              }
            }
          }
        }
      }
    `

    const data = await this.makeRequest(query)
    return data.viewer.assignedIssues.nodes
  }

  // Test the API connection
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const query = `
        query TestConnection {
          viewer {
            id
            name
            email
          }
        }
      `

      const data = await this.makeRequest(query)
      return {
        success: true,
        user: data.viewer
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Helper function to create LinearAPI instance
export function createLinearAPI(apiKey: string): LinearAPI {
  return new LinearAPI({ apiKey })
}

// Helper function to process Linear issues into FounderOS entries
export function processLinearIssues(issues: LinearIssue[]): any[] {
  return issues.map(issue => ({
    type: 'linear',
    content: `# ${issue.identifier}: ${issue.title}\n\n${issue.description || ''}`,
    metadata: {
      linear_id: issue.id,
      identifier: issue.identifier,
      state: issue.state.name,
      assignee: issue.assignee?.name,
      team: issue.team.name,
      priority: issue.priority,
      labels: issue.labels.nodes.map(label => label.name),
      comments_count: issue.comments.nodes.length,
      url: issue.url
    },
    tags: [
      'linear',
      issue.team.key.toLowerCase(),
      issue.state.name.toLowerCase().replace(/\s+/g, '-'),
      ...(issue.labels.nodes.map(label => label.name.toLowerCase()))
    ],
    timestamp: issue.updatedAt,
    source_url: issue.url,
    source_name: `Linear - ${issue.identifier}`,
    is_flashcard: false
  }))
} 