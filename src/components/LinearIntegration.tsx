'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

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
  labels: Array<{
    id: string
    name: string
    color: string
  }>
  priority: number
  createdAt: string
  updatedAt: string
  url: string
  creator: {
    id: string
    name: string
    email: string
  }
}

interface LinearTeam {
  id: string
  name: string
  key: string
  description?: string
}

interface LinearIntegration {
  id: string
  service: 'linear'
  is_active: boolean
  team_name: string | null
  user_email: string | null
  last_sync_at: string | null
  created_at: string
  scopes: string[] | null
}

export function LinearIntegration() {
  const [integration, setIntegration] = useState<LinearIntegration | null>(null)
  const [issues, setIssues] = useState<LinearIssue[]>([])
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        await fetchIntegration()
      } else {
        setError('Please sign in to manage Linear integration')
      }
    } catch (error) {
      console.error('Error checking user:', error)
      setError('Authentication error')
    } finally {
      setLoading(false)
    }
  }

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      setError('No authentication session found')
      return null
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  const fetchIntegration = async () => {
    try {
      const headers = await getAuthHeaders()
      if (!headers) return

      const response = await fetch('/api/integrations/auth', { headers })
      
      if (response.ok) {
        const data = await response.json()
        const linearIntegration = data.integrations?.find((i: any) => i.service === 'linear')
        setIntegration(linearIntegration || null)
        
        if (linearIntegration) {
          await fetchLinearData()
        }
      } else {
        console.error('Failed to fetch integrations:', response.status)
      }
    } catch (error) {
      console.error('Error fetching integration:', error)
      setError('Failed to fetch integration status')
    }
  }

  const fetchLinearData = async () => {
    try {
      const headers = await getAuthHeaders()
      if (!headers) return

      // Fetch recent issues
      const issuesResponse = await fetch('/api/integrations/linear/issues?limit=10', { headers })
      if (issuesResponse.ok) {
        const issuesData = await issuesResponse.json()
        setIssues(issuesData.issues || [])
      }

      // Fetch teams
      const teamsResponse = await fetch('/api/integrations/linear/teams', { headers })
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json()
        setTeams(teamsData.teams || [])
      }
    } catch (error) {
      console.error('Error fetching Linear data:', error)
    }
  }

  const connectLinear = async () => {
    try {
      setConnecting(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      if (!headers) {
        setError('Please sign in to connect Linear')
        return
      }
      
      const response = await fetch('/api/integrations/auth', {
        method: 'POST',
        headers,
        body: JSON.stringify({ service: 'linear' })
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.auth_url
      } else {
        const error = await response.json()
        if (error.error.includes('Demo mode')) {
          setError(`Demo Mode: To connect Linear, you need to:\n\n1. Create a Linear OAuth application at https://linear.app/settings/api\n2. Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET in your .env file\n3. Configure the redirect URI: ${window.location.origin}/api/integrations/linear/callback\n\nRequired scopes: read, write, issues:create, comments:create`)
        } else {
          setError(`Error: ${error.error}`)
        }
      }
    } catch (error) {
      console.error('Error connecting Linear:', error)
      setError('Failed to connect to Linear')
    } finally {
      setConnecting(false)
    }
  }

  const disconnectLinear = async () => {
    if (!integration) return
    
    try {
      const headers = await getAuthHeaders()
      if (!headers) return
      
      const response = await fetch(`/api/integrations/auth?id=${integration.id}`, {
        method: 'DELETE',
        headers
      })

      if (response.ok) {
        setIntegration(null)
        setIssues([])
        setTeams([])
      } else {
        const error = await response.json()
        setError(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error disconnecting Linear:', error)
      setError('Failed to disconnect Linear')
    }
  }

  const syncLinear = async () => {
    if (!integration) return
    
    try {
      setSyncing(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      if (!headers) return
      
      const response = await fetch('/api/integrations/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ integration_id: integration.id })
      })

      if (response.ok) {
        await fetchLinearData()
        await fetchIntegration() // Refresh last sync time
      } else {
        const error = await response.json()
        setError(`Sync failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Error syncing Linear:', error)
      setError('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
          <p className="text-gray-600 mb-4">Please sign in to manage your Linear integration.</p>
          <Button onClick={() => window.location.href = '/auth'}>
            Sign In
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Linear Integration</h1>
        <p className="text-gray-600">
          Connect Linear to sync issues, comments, and project updates
        </p>
      </div>

      {error && (
        <Card>
          <div className="border-l-4 border-red-500 bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <pre className="whitespace-pre-wrap">{error}</pre>
                </div>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setError(null)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Connection Status */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📋</span>
            <div>
              <h3 className="text-lg font-semibold">Linear Connection</h3>
              <p className="text-sm text-gray-600">
                {integration ? 'Connected to Linear workspace' : 'Not connected to Linear'}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            integration ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {integration ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        {integration ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {integration.team_name && (
                  <div>
                    <strong>Workspace:</strong> {integration.team_name}
                  </div>
                )}
                {integration.user_email && (
                  <div>
                    <strong>Account:</strong> {integration.user_email}
                  </div>
                )}
                {integration.last_sync_at && (
                  <div>
                    <strong>Last Sync:</strong> {new Date(integration.last_sync_at).toLocaleString()}
                  </div>
                )}
                {integration.scopes && (
                  <div>
                    <strong>Permissions:</strong> {integration.scopes.join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={syncLinear}
                disabled={syncing}
                className="flex-1"
              >
                {syncing ? 'Syncing...' : '🔄 Sync Now'}
              </Button>
              <Button
                variant="outline"
                onClick={disconnectLinear}
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">OAuth 2.0 Features</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Read access to issues, projects, and teams</li>
                <li>• Write access to create and update issues</li>
                <li>• Create comments and track progress</li>
                <li>• Real-time webhook notifications</li>
              </ul>
            </div>
            
            <Button
              onClick={connectLinear}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? 'Connecting...' : '🔗 Connect Linear'}
            </Button>
          </div>
        )}
      </Card>

      {integration && teams.length > 0 && (
        <Card title="Teams">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                    {team.key}
                  </span>
                </div>
                <h4 className="font-medium">{team.name}</h4>
                {team.description && (
                  <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {integration && issues.length > 0 && (
        <Card title={`Recent Issues (${issues.length})`}>
          <div className="space-y-4">
            {issues.map((issue) => (
              <div key={issue.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {issue.identifier}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      issue.state.type === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : issue.state.type === 'started'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {issue.state.name}
                    </span>
                  </div>
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Open →
                  </a>
                </div>
                
                <h4 className="font-medium mb-2">{issue.title}</h4>
                
                {issue.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {issue.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>Team: {issue.team.name}</span>
                    {issue.assignee && (
                      <span>Assigned: {issue.assignee.name}</span>
                    )}
                    {issue.priority > 0 && (
                      <span>Priority: {issue.priority}</span>
                    )}
                  </div>
                  <span>Updated: {new Date(issue.updatedAt).toLocaleDateString()}</span>
                </div>
                
                {issue.labels.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {issue.labels.map((label) => (
                      <span
                        key={label.id}
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: `${label.color}20`,
                          color: label.color
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {integration && issues.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
            <p className="text-gray-600 mb-4">
              No issues have been synced yet. Try syncing your Linear workspace.
            </p>
            <Button onClick={syncLinear} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Linear Issues'}
            </Button>
          </div>
        </Card>
      )}

      {integration && (
        <Card title="Linear OAuth 2.0 Information">
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">✅ Integration Active</h4>
              <p className="text-sm text-green-800">
                Your Linear integration is configured with OAuth 2.0 authentication and includes
                read/write permissions for comprehensive issue management.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h5 className="font-medium mb-2">📖 Read Permissions</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• View all issues and projects</li>
                  <li>• Access team information</li>
                  <li>• Read comments and updates</li>
                </ul>
              </div>
              
              <div className="border rounded-lg p-4">
                <h5 className="font-medium mb-2">✏️ Write Permissions</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Create new issues</li>
                  <li>• Add comments to issues</li>
                  <li>• Update issue status</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
} 