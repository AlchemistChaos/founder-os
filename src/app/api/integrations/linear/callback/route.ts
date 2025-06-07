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

    if (service !== 'linear') {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=invalid_service`
      )
    }

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens('linear', code)

    // For Linear, we'll get team info during the first sync
    const teamInfo = {
      id: 'default',
      name: 'Linear'
    }

    // Save integration
    const integrationId = await saveIntegration(user_id, 'linear', tokenData, teamInfo)

    // Schedule initial sync
    await createSyncJob(integrationId, 'full_sync')

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?success=linear_connected`
    )

  } catch (error) {
    console.error('Linear OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/integrations?error=connection_failed&service=linear`
    )
  }
}