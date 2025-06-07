'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

interface Integration {
  id: string
  service: 'slack' | 'linear' | 'google' | 'fireflies'
  is_active: boolean
  team_name: string | null
  user_email: string | null
  last_sync_at: string | null
  created_at: string
}

const serviceInfo = {
  slack: {
    name: 'Slack',
    icon: '💬',
    description: 'Sync messages, mentions, and channel updates'
  },
  linear: {
    name: 'Linear',
    icon: '📋',
    description: 'Track issue updates, comments, and status changes'
  },
  google: {
    name: 'Google Docs',
    icon: '📄',
    description: 'Monitor document edits and comments'
  },
  fireflies: {
    name: 'Fireflies.ai',
    icon: '🎥',
    description: 'Import meeting transcripts and summaries'
  }
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      // Set a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
      
      const userPromise = supabase.auth.getUser()
      
      const { data: { user } } = await Promise.race([userPromise, timeoutPromise]) as any
      
      if (user) {
        setUser(user)
        console.log('Found Supabase user:', user.email)
      } else {
        throw new Error('No user found')
      }
    } catch (error) {
      console.log('Using mock user for development:', error.message)
      // For development, create a mock user
      const mockUser = {
        id: 'mock-user-id',
        email: 'test@example.com'
      }
      setUser(mockUser)
    }
    
    // Always fetch integrations and set loading to false
    try {
      await fetchIntegrations()
    } catch (error) {
      console.error('Error fetching integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAuthHeaders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    } catch (error) {
      console.log('No Supabase session, using mock auth')
    }
    
    // For development, use a mock token
    return {
      'Authorization': `Bearer mock-token`,
      'Content-Type': 'application/json'
    }
  }

  const fetchIntegrations = async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/integrations/auth', { headers })
      
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data.integrations || [])
      } else {
        console.error('Failed to fetch integrations:', response.status)
        // Set empty array if fetch fails
        setIntegrations([])
      }
    } catch (error) {
      console.error('Error fetching integrations:', error)
      // Set empty array if fetch fails
      setIntegrations([])
    }
  }

  const connectService = async (service: string) => {
    try {
      setConnecting(service)
      
      const headers = await getAuthHeaders()
      const response = await fetch('/api/integrations/auth', {
        method: 'POST',
        headers,
        body: JSON.stringify({ service })
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.auth_url
      } else {
        const error = await response.json()
        if (error.error.includes('Demo mode')) {
          alert(`Demo Mode: To test integrations, you need to:\n\n1. Set up OAuth apps with each service (Slack, Linear, Google, Fireflies)\n2. Add the OAuth credentials to your .env file\n3. Configure webhook URLs in each service\n\nSee the .env.example file for required environment variables.`)
        } else {
          alert(`Error: ${error.error}`)
        }
      }
    } catch (error) {
      console.error('Error connecting service:', error)
      alert('Failed to connect service')
    } finally {
      setConnecting(null)
    }
  }

  const disconnectService = async (integrationId: string) => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/integrations/auth?id=${integrationId}`, {
        method: 'DELETE',
        headers
      })

      if (response.ok) {
        await fetchIntegrations()
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error disconnecting service:', error)
      alert('Failed to disconnect service')
    }
  }

  const triggerSync = async (integrationId: string) => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/integrations/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          integration_id: integrationId,
          sync_type: 'incremental_sync'
        })
      })

      if (response.ok) {
        alert('Sync started successfully!')
        await fetchIntegrations() // Refresh the list
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error triggering sync:', error)
      alert('Failed to start sync')
    }
  }

  const triggerFirefliesSync = async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/test-fireflies', {
        method: 'POST',
        headers
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Fireflies sync complete! Imported ${result.processed_count} meetings.`)
      } else {
        const error = await response.json()
        alert(`Error: ${(error as any).error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error triggering Fireflies sync:', error)
      alert('Failed to start Fireflies sync')
    }
  }

  const generateFlashcards = async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers,
        body: JSON.stringify({ days: 15 })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Generated ${result.created_count} flashcards from your last 15 days of meetings!`)
      } else {
        const error = await response.json()
        alert(`Error: ${(error as any).error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error generating flashcards:', error)
      alert('Failed to generate flashcards')
    }
  }

  const getServiceIntegration = (service: string) => {
    return integrations.find(integration => integration.service === service)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">You need to be logged in to manage integrations.</p>
          <Button onClick={() => window.location.href = '/auth'}>Sign In</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔗 Integrations</h1>
        <p className="text-lg text-gray-600">
          Connect your tools to automatically sync updates into FounderOS
        </p>
      </div>

      {/* Quick Actions */}
      <Card className="mb-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={triggerFirefliesSync}
            >
              🔄 Sync Fireflies Meetings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateFlashcards}
            >
              🧠 Generate Flashcards (Last 15 Days)
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(serviceInfo).map(([service, info]) => {
          const integration = getServiceIntegration(service)
          const isConnected = !!integration
          const isConnecting = connecting === service

          return (
            <Card key={service} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
                    <p className="text-sm text-gray-600">{info.description}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isConnected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {isConnected ? 'Connected' : 'Not Connected'}
                </div>
              </div>

              {isConnected && integration && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm space-y-1">
                    {integration.team_name && (
                      <p><strong>Team:</strong> {integration.team_name}</p>
                    )}
                    {integration.user_email && (
                      <p><strong>Account:</strong> {integration.user_email}</p>
                    )}
                    {integration.last_sync_at && (
                      <p><strong>Last Sync:</strong> {new Date(integration.last_sync_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                {isConnected ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync(integration!.id)}
                    >
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectService(integration!.id)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => connectService(service)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Card title="Integration Status" className="mt-8">
        <div className="space-y-4">
          {integrations.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No integrations connected yet. Connect your first integration above!
            </p>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {serviceInfo[integration.service]?.icon}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {serviceInfo[integration.service]?.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Connected {new Date(integration.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      integration.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {integration.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}