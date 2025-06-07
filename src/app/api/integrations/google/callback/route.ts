import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, saveIntegration } from '@/lib/integrations/auth'
import { createSyncJob } from '@/lib/integrations/jobs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=oauth_error&message=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=missing_params`
      )
    }

    // Verify and decode state
    let stateData
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch (err) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=invalid_state`
      )
    }

    const { user_id, service, timestamp } = stateData

    // Check state timestamp (prevent replay attacks)
    if (Date.now() - timestamp > 10 * 60 * 1000) { // 10 minutes
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=expired_state`
      )
    }

    if (service !== 'google') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=invalid_service`
      )
    }

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens('google', code)

    // Get user info from Google
    let userInfo = { email: 'unknown@google.com' }
    try {
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      })
      
      if (userResponse.ok) {
        userInfo = await userResponse.json()
      }
    } catch (error) {
      console.error('Error fetching Google user info:', error)
    }

    const teamInfo = {
      id: 'google',
      name: 'Google Workspace',
      email: userInfo.email
    }

    // Save integration
    const integrationId = await saveIntegration(user_id, 'google', tokenData, teamInfo)

    // Schedule initial sync
    await createSyncJob(integrationId, 'full_sync')

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?success=google_connected`
    )

  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=connection_failed&service=google`
    )
  }
}