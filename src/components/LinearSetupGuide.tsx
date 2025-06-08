'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function LinearSetupGuide() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📋 Linear OAuth 2.0 Setup Guide</h1>
        <p className="text-gray-600">
          Follow these steps to configure Linear integration with OAuth 2.0 authentication
        </p>
      </div>

      <Card title="Step 1: Create Linear OAuth Application">
        <div className="space-y-4">
          <p className="text-gray-600">
            First, you need to create an OAuth application in your Linear workspace.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Instructions:</h4>
            <ol className="text-sm text-blue-800 space-y-2">
              <li>1. Go to Linear Settings → API</li>
              <li>2. Click "Create new OAuth application"</li>
              <li>3. Fill in the application details</li>
              <li>4. Set the required scopes: read, write, issues:create, comments:create</li>
              <li>5. Choose actor type: user</li>
              <li>6. Click "Create application"</li>
            </ol>
          </div>
        </div>
      </Card>

      <Card title="Step 2: Configure Environment Variables">
        <div className="space-y-4">
          <p className="text-gray-600">
            Add the OAuth credentials to your environment configuration.
          </p>
          
          <div className="bg-gray-900 rounded-lg p-4 text-green-400 font-mono text-sm">
            <pre>{`# Linear OAuth 2.0 Configuration
LINEAR_CLIENT_ID=your_client_id_here
LINEAR_CLIENT_SECRET=your_client_secret_here`}</pre>
          </div>
        </div>
      </Card>

      <Card title="Step 3: OAuth 2.0 Features">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h5 className="font-medium mb-2">🔐 Security Features</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• CSRF protection with state parameter</li>
                <li>• Secure token storage in database</li>
                <li>• Automatic token refresh handling</li>
                <li>• Webhook signature verification</li>
              </ul>
            </div>
            
            <div className="border rounded-lg p-4">
              <h5 className="font-medium mb-2">⚡ Advanced Capabilities</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time webhook notifications</li>
                <li>• Bidirectional data synchronization</li>
                <li>• Granular permission scopes</li>
                <li>• Error handling and retry logic</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <div className="text-center">
        <Button onClick={() => window.location.href = '/integrations'}>
          Go to Integrations →
        </Button>
      </div>
    </div>
  )
} 