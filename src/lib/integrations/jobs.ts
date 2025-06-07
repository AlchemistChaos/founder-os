import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { SyncJob, IntegrationType, IntegrationData } from './types'
import { summarizeContent, generateTags } from '@/lib/openai'

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function createSyncJob(
  integrationId: string,
  jobType: 'full_sync' | 'incremental_sync' | 'webhook_event',
  payload: Record<string, any> = {}
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('sync_jobs')
    .insert({
      integration_id: integrationId,
      job_type: jobType,
      payload,
      status: 'pending'
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating sync job:', error)
    throw new Error('Failed to create sync job')
  }

  return data.id
}

export async function updateJobStatus(
  jobId: string,
  status: SyncJob['status'],
  errorMessage?: string
): Promise<void> {
  const updates: any = {
    status,
    updated_at: new Date().toISOString()
  }

  if (status === 'processing' && !errorMessage) {
    updates.started_at = new Date().toISOString()
  } else if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
  } else if (status === 'failed' && errorMessage) {
    updates.error_message = errorMessage
  }

  const { error } = await supabaseAdmin
    .from('sync_jobs')
    .update(updates)
    .eq('id', jobId)

  if (error) {
    console.error('Error updating job status:', error)
    throw new Error('Failed to update job status')
  }
}

export async function incrementJobRetry(jobId: string): Promise<boolean> {
  // Get current job
  const { data: job, error: fetchError } = await supabaseAdmin
    .from('sync_jobs')
    .select('retry_count, max_retries')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    console.error('Error fetching job for retry:', fetchError)
    return false
  }

  const newRetryCount = job.retry_count + 1
  const shouldRetry = newRetryCount <= job.max_retries

  const { error } = await supabaseAdmin
    .from('sync_jobs')
    .update({
      retry_count: newRetryCount,
      status: shouldRetry ? 'retrying' : 'failed',
      scheduled_at: shouldRetry ? new Date(Date.now() + Math.pow(2, newRetryCount) * 60000).toISOString() : undefined
    })
    .eq('id', jobId)

  if (error) {
    console.error('Error incrementing job retry:', error)
    return false
  }

  return shouldRetry
}

export async function getPendingJobs(limit: number = 10): Promise<SyncJob[]> {
  const { data, error } = await supabaseAdmin
    .from('sync_jobs')
    .select('*')
    .in('status', ['pending', 'retrying'])
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching pending jobs:', error)
    return []
  }

  return data || []
}

export async function processIntegrationData(
  data: IntegrationData,
  userId: string
): Promise<void> {
  try {
    // Summarize content using OpenAI
    let summary = data.content
    if (data.content.length > 500) {
      try {
        summary = await summarizeContent({
          content: data.content,
          type: data.type === 'slack' ? 'slack' : 
                data.type === 'doc' ? 'document' : 
                data.type === 'meeting' ? 'meeting' : 'general',
          maxLength: 200
        })
      } catch (error) {
        console.error('Error summarizing content:', error)
        // Use truncated content as fallback
        summary = data.content.slice(0, 500) + '...'
      }
    }

    // Generate tags
    let tags = data.tags || []
    try {
      const generatedTags = await generateTags({
        content: data.content,
        existingTags: tags
      })
      tags = [...new Set([...tags, ...generatedTags])]
    } catch (error) {
      console.error('Error generating tags:', error)
      // Use provided tags or defaults
      if (tags.length === 0) {
        tags = [data.type, 'imported']
      }
    }

    // Save to entries table
    const { error } = await supabaseAdmin
      .from('entries')
      .insert({
        user_id: userId,
        type: data.type,
        content: summary,
        metadata: {
          original_content: data.content,
          ...data.metadata,
          integration_id: data.id,
          author: data.author,
          channel: data.channel
        },
        tags,
        source_url: data.source_url,
        source_name: data.source_name,
        timestamp: new Date(data.timestamp).toISOString(),
        is_flashcard: false
      })

    if (error) {
      console.error('Error saving integration data to entries:', error)
      throw new Error('Failed to save integration data')
    }

    console.log(`Successfully processed integration data: ${data.id}`)
  } catch (error) {
    console.error('Error processing integration data:', error)
    throw error
  }
}

export async function schedulePeriodicSync(
  integrationId: string,
  intervalMinutes: number = 15
): Promise<void> {
  const scheduledAt = new Date(Date.now() + intervalMinutes * 60000).toISOString()
  
  await createSyncJob(integrationId, 'incremental_sync', {
    scheduled_at: scheduledAt,
    recurring: true,
    interval_minutes: intervalMinutes
  })
}

// Job processor function that should be called by a cron job or background worker
export async function processJobs(): Promise<void> {
  const jobs = await getPendingJobs(5) // Process 5 jobs at a time
  
  for (const job of jobs) {
    try {
      await updateJobStatus(job.id, 'processing')
      
      // Get integration details
      const { data: integration, error: integrationError } = await supabaseAdmin
        .from('integrations')
        .select('*')
        .eq('id', job.integration_id)
        .single()

      if (integrationError || !integration) {
        throw new Error(`Integration not found: ${job.integration_id}`)
      }

      // Process based on service type
      switch (integration.service) {
        case 'slack':
          await processSlackJob(job, integration)
          break
        case 'linear':
          await processLinearJob(job, integration)
          break
        case 'google':
          await processGoogleJob(job, integration)
          break
        case 'fireflies':
          await processFirefliesJob(job, integration)
          break
        default:
          throw new Error(`Unknown service: ${integration.service}`)
      }

      await updateJobStatus(job.id, 'completed')
      
      // If this was a recurring sync, schedule the next one
      if (job.payload.recurring) {
        const intervalMinutes = job.payload.interval_minutes || 15
        await schedulePeriodicSync(job.integration_id, intervalMinutes)
      }

    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error)
      
      const shouldRetry = await incrementJobRetry(job.id)
      if (!shouldRetry) {
        await updateJobStatus(job.id, 'failed', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }
}

// Service-specific job processing functions
async function processSlackJob(job: SyncJob, integration: any): Promise<void> {
  if (job.job_type === 'webhook_event') {
    const { handleSlackEvent } = await import('./slack')
    await handleSlackEvent(job.payload.event_data, integration)
  } else {
    const { processSlackSync } = await import('./slack')
    await processSlackSync(job, integration)
  }
}

async function processLinearJob(job: SyncJob, integration: any): Promise<void> {
  if (job.job_type === 'webhook_event') {
    const { handleLinearWebhook } = await import('./linear')
    await handleLinearWebhook(job.payload.event_data, integration)
  } else {
    const { processLinearSync } = await import('./linear')
    await processLinearSync(job, integration)
  }
}

async function processGoogleJob(job: SyncJob, integration: any): Promise<void> {
  if (job.job_type === 'webhook_event') {
    const { handleGoogleDriveWebhook } = await import('./google')
    await handleGoogleDriveWebhook(job.payload.event_data, integration)
  } else {
    const { processGoogleSync } = await import('./google')
    await processGoogleSync(job, integration)
  }
}

async function processFirefliesJob(job: SyncJob, integration: any): Promise<void> {
  if (job.job_type === 'webhook_event') {
    const { handleFirefliesWebhook } = await import('./fireflies')
    await handleFirefliesWebhook(job.payload.event_data, integration)
  } else {
    const { processFirefliesSync } = await import('./fireflies')
    await processFirefliesSync(job, integration)
  }
}