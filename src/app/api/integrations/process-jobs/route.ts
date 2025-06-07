import { NextRequest, NextResponse } from 'next/server'
import { processJobs } from '@/lib/integrations/jobs'

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting integration job processing...')
    
    await processJobs()
    
    console.log('Integration job processing completed')

    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing integration jobs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting integration job processing via GET...')
    
    await processJobs()
    
    console.log('Integration job processing completed')

    return NextResponse.json({ 
      success: true,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error processing integration jobs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}