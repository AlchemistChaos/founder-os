import { refreshAccessToken, updateIntegrationTokens } from './auth'
import { processIntegrationData } from './jobs'
import { IntegrationData, SyncJob } from './types'

interface FirefliesTranscript {
  id: string
  title: string
  date: string
  duration: number
  meeting_url?: string
  summary?: {
    overview?: string
    keywords?: string[]
    action_items?: string[]
    outline?: Array<{
      title: string
      timestamp: number
    }>
  }
  participants: Array<{
    name: string
    email?: string
    user_id?: string
  }>
  ai_filters?: {
    sentiment?: string
    questions?: string[]
    tasks?: string[]
    topics?: string[]
  }
  transcript_url?: string
  audio_url?: string
  sentences?: Array<{
    text: string
    speaker_name: string
    start_time: number
    end_time: number
  }>
}

interface FirefliesResponse {
  transcripts: FirefliesTranscript[]
  total_count: number
  page: number
  per_page: number
}

export async function makeFirefliesAPICall(
  endpoint: string,
  accessToken: string,
  params: Record<string, any> = {}
): Promise<any> {
  const url = new URL(`https://api.fireflies.ai/graphql`)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: endpoint,
      variables: params
    })
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('TOKEN_EXPIRED')
    }
    throw new Error(`Fireflies API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    const hasAuthError = data.errors.some((error: any) => 
      error.message?.includes('authentication') || 
      error.message?.includes('unauthorized')
    )
    
    if (hasAuthError) {
      throw new Error('TOKEN_EXPIRED')
    }
    
    throw new Error(`Fireflies GraphQL error: ${data.errors[0].message}`)
  }

  return data.data
}

export async function getFirefliesTranscripts(
  accessToken: string,
  limit: number = 50,
  skip: number = 0,
  startDate?: string
): Promise<{ transcripts: FirefliesTranscript[], totalCount: number }> {
  const query = `
    query GetTranscripts($limit: Int, $skip: Int, $startDate: DateTime) {
      transcripts(
        limit: $limit
        skip: $skip
        filters: {
          date_range_start: $startDate
        }
      ) {
        id
        title
        date
        duration
        meeting_url
        summary {
          overview
          keywords
          action_items
          outline {
            title
            timestamp
          }
        }
        participants {
          name
          email
          user_id
        }
        ai_filters {
          sentiment
          questions
          tasks
          topics
        }
        transcript_url
        audio_url
        sentences {
          text
          speaker_name
          start_time
          end_time
        }
      }
    }
  `

  const variables: any = { limit, skip }
  if (startDate) variables.startDate = startDate

  const data = await makeFirefliesAPICall(query, accessToken, variables)
  
  return {
    transcripts: data.transcripts || [],
    totalCount: data.transcripts?.length || 0
  }
}

export async function getFirefliesTranscriptDetails(
  accessToken: string,
  transcriptId: string
): Promise<FirefliesTranscript | null> {
  const query = `
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        meeting_url
        summary {
          overview
          keywords
          action_items
          outline {
            title
            timestamp
          }
        }
        participants {
          name
          email
          user_id
        }
        ai_filters {
          sentiment
          questions
          tasks
          topics
        }
        transcript_url
        audio_url
        sentences {
          text
          speaker_name
          start_time
          end_time
        }
      }
    }
  `

  const data = await makeFirefliesAPICall(query, accessToken, { id: transcriptId })
  return data.transcript || null
}

export async function processFirefliesTranscript(
  transcript: FirefliesTranscript
): Promise<IntegrationData> {
  // Build content from meeting summary and key points
  let content = `Meeting: ${transcript.title}\n`
  content += `Duration: ${Math.round(transcript.duration / 60)} minutes\n`
  content += `Participants: ${transcript.participants.map(p => p.name).join(', ')}\n\n`

  if (transcript.summary?.overview) {
    content += `Overview:\n${transcript.summary.overview}\n\n`
  }

  if (transcript.summary?.action_items && transcript.summary.action_items.length > 0) {
    content += `Action Items:\n`
    transcript.summary.action_items.forEach(item => {
      content += `- ${item}\n`
    })
    content += '\n'
  }

  if (transcript.ai_filters?.questions && transcript.ai_filters.questions.length > 0) {
    content += `Key Questions:\n`
    transcript.ai_filters.questions.forEach(question => {
      content += `- ${question}\n`
    })
    content += '\n'
  }

  if (transcript.ai_filters?.tasks && transcript.ai_filters.tasks.length > 0) {
    content += `Tasks:\n`
    transcript.ai_filters.tasks.forEach(task => {
      content += `- ${task}\n`
    })
    content += '\n'
  }

  // Add key moments from outline
  if (transcript.summary?.outline && transcript.summary.outline.length > 0) {
    content += `Key Moments:\n`
    transcript.summary.outline.forEach(moment => {
      const minutes = Math.floor(moment.timestamp / 60)
      const seconds = moment.timestamp % 60
      content += `- [${minutes}:${seconds.toString().padStart(2, '0')}] ${moment.title}\n`
    })
  }

  // Generate tags
  const tags = [
    'fireflies',
    'meeting',
    ...(transcript.summary?.keywords || []).map(keyword => 
      keyword.toLowerCase().replace(/\s+/g, '-')
    ),
    ...(transcript.ai_filters?.topics || []).map(topic => 
      topic.toLowerCase().replace(/\s+/g, '-')
    )
  ]

  // Add sentiment tag if available
  if (transcript.ai_filters?.sentiment) {
    tags.push(`sentiment-${transcript.ai_filters.sentiment.toLowerCase()}`)
  }

  // Add duration-based tags
  const durationMinutes = Math.round(transcript.duration / 60)
  if (durationMinutes < 15) {
    tags.push('short-meeting')
  } else if (durationMinutes > 60) {
    tags.push('long-meeting')
  }

  return {
    id: `fireflies_${transcript.id}`,
    type: 'meeting',
    content,
    source_url: transcript.transcript_url || transcript.meeting_url,
    source_name: 'Fireflies.ai',
    metadata: {
      transcript_id: transcript.id,
      duration: transcript.duration,
      duration_minutes: durationMinutes,
      participants: transcript.participants,
      summary: transcript.summary,
      ai_filters: transcript.ai_filters,
      audio_url: transcript.audio_url,
      meeting_url: transcript.meeting_url,
      sentence_count: transcript.sentences?.length || 0
    },
    timestamp: transcript.date,
    author: transcript.participants[0]?.name || 'Meeting Host',
    tags
  }
}

export async function processFirefliesSync(job: SyncJob, integration: any): Promise<void> {
  try {
    let accessToken = integration.access_token

    // Check if token needs refresh
    if (integration.token_expires_at && integration.refresh_token) {
      const expiresAt = new Date(integration.token_expires_at)
      const now = new Date()
      
      if (expiresAt <= now) {
        try {
          const tokenData = await refreshAccessToken('fireflies', integration.refresh_token)
          await updateIntegrationTokens(integration.id, tokenData)
          accessToken = tokenData.access_token
        } catch (error) {
          console.error('Error refreshing Fireflies token:', error)
          throw new Error('Failed to refresh Fireflies token')
        }
      }
    }

    // For incremental sync, use last sync timestamp
    const startDate = job.job_type === 'incremental_sync' && integration.last_sync_at
      ? integration.last_sync_at
      : undefined

    const syncStartTime = new Date().toISOString()
    let processedCount = 0
    let skip = 0
    const limit = 20 // Fireflies API has rate limits
    let hasMore = true

    while (hasMore) {
      try {
        const { transcripts, totalCount } = await getFirefliesTranscripts(
          accessToken,
          limit,
          skip,
          startDate
        )

        if (transcripts.length === 0) {
          hasMore = false
          break
        }

        for (const transcript of transcripts) {
          try {
            // Get full transcript details if not already included
            let fullTranscript = transcript
            if (!transcript.sentences || transcript.sentences.length === 0) {
              const details = await getFirefliesTranscriptDetails(accessToken, transcript.id)
              if (details) {
                fullTranscript = details
              }
            }

            const integrationData = await processFirefliesTranscript(fullTranscript)
            await processIntegrationData(integrationData, integration.user_id)
            processedCount++
          } catch (error) {
            console.error(`Error processing Fireflies transcript ${transcript.id}:`, error)
            // Continue processing other transcripts
          }
        }

        skip += limit
        hasMore = transcripts.length === limit

        // Rate limiting: Fireflies has strict rate limits
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error('Error fetching Fireflies transcripts:', error)
        break
      }
    }

    // Update integration sync status
    const { createClient } = await import('@supabase/supabase-js')
    const { Database } = await import('@/lib/database.types')
    
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabaseAdmin
      .from('integrations')
      .update({
        last_sync_at: syncStartTime,
        sync_cursor: skip.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', integration.id)

    console.log(`Fireflies sync completed. Processed ${processedCount} transcripts.`)

  } catch (error) {
    console.error('Error in Fireflies sync:', error)
    throw error
  }
}

export async function handleFirefliesWebhook(
  payload: any,
  integration: any
): Promise<void> {
  try {
    // Fireflies webhook payload typically contains transcript_id
    const transcriptId = payload.transcript_id || payload.id
    
    if (!transcriptId) {
      console.error('No transcript ID in Fireflies webhook payload')
      return
    }

    // Get full transcript details
    const transcript = await getFirefliesTranscriptDetails(
      integration.access_token,
      transcriptId
    )

    if (!transcript) {
      console.error(`Transcript not found: ${transcriptId}`)
      return
    }

    const integrationData = await processFirefliesTranscript(transcript)
    
    // Add webhook-specific metadata
    integrationData.metadata.webhook_payload = payload
    integrationData.tags.push('webhook')

    await processIntegrationData(integrationData, integration.user_id)
    
    console.log(`Processed Fireflies webhook event for transcript: ${transcript.title}`)
  } catch (error) {
    console.error('Error processing Fireflies webhook event:', error)
    throw error
  }
}