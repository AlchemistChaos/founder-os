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
  dueDate?: string
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
  project?: {
    id: string
    name: string
  }
  projectMilestone?: {
    id: string
    name: string
  }
}

interface LinearTeam {
  id: string
  name: string
  key: string
  description?: string
}

interface LinearProject {
  id: string
  name: string
  description?: string
  state: string
  startDate?: string
  targetDate?: string
  progress: number
  team: {
    id: string
    name: string
    key: string
  }
  lead?: {
    id: string
    name: string
    email: string
  }
  members: {
    nodes: Array<{
      id: string
      name: string
      email: string
    }>
  }
  milestones: {
    nodes: Array<LinearProjectMilestone>
  }
  issues: {
    nodes: Array<LinearIssue>
  }
  createdAt: string
  updatedAt: string
  url: string
}

interface LinearProjectMilestone {
  id: string
  name: string
  description?: string
  targetDate?: string
  sortOrder: number
  project: {
    id: string
    name: string
  }
  issues: {
    nodes: Array<LinearIssue>
  }
  createdAt: string
  updatedAt: string
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

  // Get projects for a team or all projects
  async getProjects(teamId?: string): Promise<LinearProject[]> {
    const query = `
      query GetProjects {
        projects {
          nodes {
            id
            name
            description
            state
            startDate
            targetDate
            progress
            lead {
              id
              name
              email
            }
            members {
              nodes {
                id
                name
                email
              }
            }
            createdAt
            updatedAt
            url
          }
        }
      }
    `

    const data = await this.makeRequest(query)
    return data.projects.nodes
  }

  // Get project milestones
  async getProjectMilestones(projectId?: string): Promise<LinearProjectMilestone[]> {
    const query = `
      query GetProjectMilestones {
        projectMilestones {
          nodes {
            id
            name
            description
            targetDate
            sortOrder
            project {
              id
              name
            }
            createdAt
            updatedAt
          }
        }
      }
    `

    const data = await this.makeRequest(query)
    let milestones = data.projectMilestones.nodes
    
    // Filter by project if specified
    if (projectId) {
      milestones = milestones.filter((milestone: LinearProjectMilestone) => milestone.project.id === projectId)
    }
    
    return milestones
  }

  // Search for projects by name (e.g., "summer launch")
  async searchProjects(searchTerm: string): Promise<LinearProject[]> {
    const query = `
      query SearchProjects($searchTerm: String!) {
        projects(filter: { name: { containsIgnoreCase: $searchTerm } }) {
          nodes {
            id
            name
            description
            state
            startDate
            targetDate
            progress
            lead {
              id
              name
              email
            }
            createdAt
            updatedAt
            url
          }
        }
      }
    `

    const data = await this.makeRequest(query, { searchTerm })
    return data.projects.nodes
  }

  // Get issues for a team or all teams
  async getIssues(teamId?: string, limit: number = 200): Promise<LinearIssue[]> {
    const query = `
      query GetIssues($first: Int, $teamFilter: IssueFilter) {
        issues(
          first: $first
          orderBy: updatedAt
          filter: $teamFilter
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
            dueDate
            createdAt
            updatedAt
            url
            creator {
              id
              name
              email
            }
            project {
              id
              name
            }
            projectMilestone {
              id
              name
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

    const variables: any = { first: limit }
    if (teamId) {
      variables.teamFilter = { team: { id: { eq: teamId } } }
    }

    const data = await this.makeRequest(query, variables)
    return data.issues.nodes
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
          filter: {
            updatedAt: {
              gte: "${since.toISOString()}"
            }
          }
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
            dueDate
            createdAt
            updatedAt
            url
            creator {
              id
              name
              email
            }
            project {
              id
              name
            }
            projectMilestone {
              id
              name
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

    const data = await this.makeRequest(query, { first: 50 })
    return data.issues.nodes
  }

  // Get my assigned issues
  async getMyIssues(): Promise<LinearIssue[]> {
    const query = `
      query GetMyIssues {
        issues(
          filter: {
            assignee: { isMe: { eq: true } }
          }
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
            dueDate
            createdAt
            updatedAt
            url
            creator {
              id
              name
              email
            }
            project {
              id
              name
            }
            projectMilestone {
              id
              name
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

    const data = await this.makeRequest(query)
    return data.issues.nodes
  }

  // Test connection and get user info
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const query = `
        query Me {
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

// Factory function to create LinearAPI instance
export function createLinearAPI(apiKey: string): LinearAPI {
  return new LinearAPI({ apiKey })
}

// Process Linear issues into FounderOS entry format
export function processLinearIssues(issues: LinearIssue[]): any[] {
  return issues.map(issue => {
    const date = new Date(issue.updatedAt)
    const content = `
## ${issue.identifier}: ${issue.title}

**Team:** ${issue.team.name} (${issue.team.key})
**Status:** ${issue.state.name}
**Priority:** ${issue.priority}
${issue.assignee ? `**Assignee:** ${issue.assignee.name}` : ''}
${issue.project ? `**Project:** ${issue.project.name}` : ''}
${issue.projectMilestone ? `**Milestone:** ${issue.projectMilestone.name}` : ''}

${issue.description || ''}

${issue.comments.nodes.length > 0 ? `
### Recent Comments:
${issue.comments.nodes.slice(0, 3).map(comment => 
  `- **${comment.user.name}** (${new Date(comment.createdAt).toLocaleDateString()}): ${comment.body}`
).join('\n')}
` : ''}

[View in Linear](${issue.url})
    `.trim()

    return {
      id: `linear-${issue.id}`,
      content,
      type: 'linear_issue',
      source_meeting_title: `Linear: ${issue.team.name}`,
      source_url: issue.url,
      metadata: {
        linear_id: issue.id,
        identifier: issue.identifier,
        team_id: issue.team.id,
        team_name: issue.team.name,
        state: issue.state.name,
        priority: issue.priority,
        project_id: issue.project?.id,
        project_name: issue.project?.name,
        milestone_id: issue.projectMilestone?.id,
        milestone_name: issue.projectMilestone?.name
      },
      created_at: issue.createdAt,
      updated_at: issue.updatedAt
    }
  })
} 