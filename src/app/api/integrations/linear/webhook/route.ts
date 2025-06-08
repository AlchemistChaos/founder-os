import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { LinearEvent } from '@/lib/integrations/types'
import { createSyncJob } from '@/lib/integrations/jobs'
import { createHmac } from 'crypto'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Linear webhook sender IP addresses for additional security
const LINEAR_IPS = [
  '35.231.147.226',
  '35.243.134.228', 
  '34.140.253.14',
  '34.38.87.206'
]

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Verify webhook signature
    const linearSignature = request.headers.get('linear-signature')
    
    if (!linearSignature) {
      console.warn('Missing Linear-Signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    // Verify signature with webhook secret
    if (process.env.LINEAR_WEBHOOK_SECRET) {
      const isValid = verifyLinearSignature(rawBody, linearSignature, process.env.LINEAR_WEBHOOK_SECRET)
      if (!isValid) {
        console.warn('Invalid Linear webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Optional: Verify sender IP (additional security)
    const forwardedFor = request.headers.get('x-forwarded-for')
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : request.ip
    
    if (process.env.NODE_ENV === 'production' && clientIP && !LINEAR_IPS.includes(clientIP)) {
      console.warn(`Webhook from unauthorized IP: ${clientIP}`)
      // Note: This is optional and might be too strict depending on your infrastructure
    }

    // Verify webhook timestamp to prevent replay attacks
    const webhookTimestamp = body.webhookTimestamp
    if (webhookTimestamp) {
      const currentTime = Date.now()
      const timeDiff = Math.abs(currentTime - webhookTimestamp)
      
      // Reject webhooks older than 1 minute
      if (timeDiff > 60 * 1000) {
        console.warn(`Webhook timestamp too old: ${timeDiff}ms`)
        return NextResponse.json({ error: 'Webhook too old' }, { status: 401 })
      }
    }

    const event: LinearEvent = body

    // Log webhook details
    const eventId = request.headers.get('linear-delivery')
    const eventType = request.headers.get('linear-event')
    
    console.log(`Linear webhook received:`, {
      eventId,
      eventType,
      action: event.action,
      type: event.type,
      webhookId: body.webhookId
    })

    // Process different event types
    const result = await processLinearWebhook(event, eventId)
    
    return NextResponse.json({ 
      ok: true, 
      processed: result.processed,
      message: result.message 
    })

  } catch (error) {
    console.error('Linear webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Verify Linear webhook signature
function verifyLinearSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
    
    return signature === expectedSignature
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

// Process Linear webhook events
async function processLinearWebhook(event: LinearEvent, deliveryId: string | null): Promise<{processed: boolean, message: string}> {
  try {
    const { action, type, data, createdAt } = event

    // Handle different event types
    switch (type) {
      case 'Issue':
        return await processIssueEvent(event, deliveryId)
      case 'Comment':
        return await processCommentEvent(event, deliveryId)
      case 'Project':
        return await processProjectEvent(event, deliveryId)
      case 'Cycle':
        return await processCycleEvent(event, deliveryId)
      default:
        console.log(`Unhandled event type: ${type}`)
        return { processed: false, message: `Event type ${type} not handled` }
    }
  } catch (error) {
    console.error('Error processing Linear webhook:', error)
    return { processed: false, message: 'Processing failed' }
  }
}

// Process Issue events (create, update, remove)
async function processIssueEvent(event: LinearEvent, deliveryId: string | null): Promise<{processed: boolean, message: string}> {
  const { action, data } = event
  
  try {
    // Store webhook event in database for processing
    const { error } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        service: 'linear',
        event_type: 'issue',
        action,
        external_id: data.id,
        data: data,
        url: event.url,
        webhook_id: event.webhookId,
        delivery_id: deliveryId,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error storing webhook event:', error)
      return { processed: false, message: 'Failed to store event' }
    }

    // Process based on action
    switch (action) {
      case 'create':
        console.log(`New issue created: ${data.identifier} - ${data.title}`)
        break
      case 'update':
        console.log(`Issue updated: ${data.identifier} - ${data.title}`)
        break
      case 'remove':
        console.log(`Issue removed: ${data.identifier}`)
        break
    }

    return { processed: true, message: `Issue ${action} processed` }
  } catch (error) {
    console.error('Error processing issue event:', error)
    return { processed: false, message: 'Issue processing failed' }
  }
}

// Process Comment events
async function processCommentEvent(event: LinearEvent, deliveryId: string | null): Promise<{processed: boolean, message: string}> {
  const { action, data } = event
  
  try {
    // Store comment event
    const { error } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        service: 'linear',
        event_type: 'comment',
        action,
        external_id: data.id,
        data: data,
        url: event.url,
        webhook_id: event.webhookId,
        delivery_id: deliveryId,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error storing comment event:', error)
      return { processed: false, message: 'Failed to store comment event' }
    }

    console.log(`Comment ${action}: ${data.body?.substring(0, 100)}...`)
    return { processed: true, message: `Comment ${action} processed` }
  } catch (error) {
    console.error('Error processing comment event:', error)
    return { processed: false, message: 'Comment processing failed' }
  }
}

// Process Project events
async function processProjectEvent(event: LinearEvent, deliveryId: string | null): Promise<{processed: boolean, message: string}> {
  const { action, data } = event
  
  try {
    // Store project event
    const { error } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        service: 'linear',
        event_type: 'project',
        action,
        external_id: data.id,
        data: data,
        url: event.url,
        webhook_id: event.webhookId,
        delivery_id: deliveryId,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error storing project event:', error)
      return { processed: false, message: 'Failed to store project event' }
    }

    console.log(`Project ${action}: ${data.name}`)
    return { processed: true, message: `Project ${action} processed` }
  } catch (error) {
    console.error('Error processing project event:', error)
    return { processed: false, message: 'Project processing failed' }
  }
}

// Process Cycle events
async function processCycleEvent(event: LinearEvent, deliveryId: string | null): Promise<{processed: boolean, message: string}> {
  const { action, data } = event
  
  try {
    // Store cycle event
    const { error } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        service: 'linear',
        event_type: 'cycle',
        action,
        external_id: data.id,
        data: data,
        url: event.url,
        webhook_id: event.webhookId,
        delivery_id: deliveryId,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error storing cycle event:', error)
      return { processed: false, message: 'Failed to store cycle event' }
    }

    console.log(`Cycle ${action}: ${data.name}`)
    return { processed: true, message: `Cycle ${action} processed` }
  } catch (error) {
    console.error('Error processing cycle event:', error)
    return { processed: false, message: 'Cycle processing failed' }
  }
}