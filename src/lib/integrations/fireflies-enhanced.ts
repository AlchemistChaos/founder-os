import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { refreshAccessToken, updateIntegrationTokens } from './auth'
import { SyncJob } from './types'

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
  participants: string[]
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

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function makeFirefliesAPICall(
  endpoint: string,
  accessToken: string,
  params: Record<string, any> = {}
): Promise<any> {
  const response = await fetch('https://api.fireflies.ai/graphql', {
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
  limit: number = 10,
  skip: number = 0,
  startDate?: string
): Promise<{ transcripts: FirefliesTranscript[], totalCount: number }> {
  const query = `
    query GetTranscripts($limit: Int, $skip: Int) {
      transcripts(
        limit: $limit
        skip: $skip
      ) {
        id
        title
        date
        duration
        meeting_url
        summary {
          overview
          action_items
          keywords
        }
        participants
        transcript_url
        audio_url
      }
    }
  `

  const variables = { limit, skip }

  const data = await makeFirefliesAPICall(query, accessToken, variables)
  
  return {
    transcripts: data.transcripts || [],
    totalCount: data.transcripts?.length || 0
  }
}

export async function saveMeetingToDatabase(
  transcript: FirefliesTranscript,
  userId: string,
  integrationId: string
): Promise<string> {
  try {
    // Convert Fireflies timestamp (milliseconds) to ISO string
    const meetingDate = new Date(parseInt(transcript.date)).toISOString()

    // Insert main meeting record
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from('meetings')
      .insert({
        user_id: userId,
        fireflies_id: transcript.id,
        title: transcript.title,
        meeting_date: meetingDate,
        duration_seconds: Math.round(transcript.duration),
        meeting_url: transcript.meeting_url,
        transcript_url: transcript.transcript_url,
        audio_url: transcript.audio_url,
        overview: transcript.summary?.overview,
        keywords: transcript.summary?.keywords || [],
        action_items: Array.isArray(transcript.summary?.action_items) 
          ? transcript.summary.action_items 
          : transcript.summary?.action_items 
            ? [transcript.summary.action_items] 
            : [],
        questions: [],
        tasks: [],
        topics: [],
        sentiment: null,
        outline: [],
        tags: [
          'fireflies',
          'meeting',
          ...(transcript.summary?.keywords || []).map(k => k.toLowerCase().replace(/\s+/g, '-')),
          ...(transcript.ai_filters?.topics || []).map(t => t.toLowerCase().replace(/\s+/g, '-'))
        ],
        source_integration_id: integrationId
      })
      .select('id')
      .single()

    if (meetingError) {
      console.error('Error inserting meeting:', meetingError)
      throw meetingError
    }

    const meetingId = meeting.id

    // Insert participants
    if (transcript.participants && transcript.participants.length > 0) {
      const participantData = transcript.participants.map(participant => ({
        meeting_id: meetingId,
        name: participant.includes('@') ? participant.split('@')[0] : participant,
        email: participant.includes('@') ? participant : null,
        fireflies_user_id: null,
        is_external: !participant.includes('@') // Simple heuristic
      }))

      const { error: participantError } = await supabaseAdmin
        .from('meeting_participants')
        .insert(participantData)

      if (participantError) {
        console.error('Error inserting participants:', participantError)
        // Don't throw - participants are not critical
      }
    }

    // Insert transcript segments
    if (transcript.sentences && transcript.sentences.length > 0) {
      const transcriptData = transcript.sentences.map(sentence => ({
        meeting_id: meetingId,
        speaker_name: sentence.speaker_name,
        text_content: sentence.text,
        start_time_seconds: Math.round(sentence.start_time),
        end_time_seconds: Math.round(sentence.end_time),
        contains_action_item: transcript.summary?.action_items?.some(item => 
          sentence.text.toLowerCase().includes(item.toLowerCase().substring(0, 20))
        ) || false,
        contains_question: sentence.text.includes('?'),
        sentiment: sentence.text.includes('!') ? 'positive' : 
                  sentence.text.includes('concern') || sentence.text.includes('issue') ? 'negative' : 'neutral'
      }))

      // Insert in batches to avoid overwhelming the database
      const batchSize = 100
      for (let i = 0; i < transcriptData.length; i += batchSize) {
        const batch = transcriptData.slice(i, i + batchSize)
        const { error: transcriptError } = await supabaseAdmin
          .from('meeting_transcripts')
          .insert(batch)

        if (transcriptError) {
          console.error(`Error inserting transcript batch ${i}:`, transcriptError)
          // Continue with next batch
        }
      }
    }

    // Generate and insert insights
    await generateMeetingInsights(meetingId, transcript)

    // Also insert into entries table for backward compatibility
    const entryContent = buildEntryContent(transcript)
    const { error: entryError } = await supabaseAdmin
      .from('entries')
      .insert({
        user_id: userId,
        type: 'meeting',
        content: entryContent,
        metadata: {
          meeting_id: meetingId,
          fireflies_id: transcript.id,
          duration: transcript.duration,
          participants: transcript.participants,
          summary: transcript.summary,
          ai_filters: transcript.ai_filters
        },
        tags: [
          'fireflies',
          'meeting',
          ...(transcript.summary?.keywords || []).map(k => k.toLowerCase().replace(/\s+/g, '-'))
        ],
        timestamp: meetingDate,
        source_url: transcript.transcript_url || transcript.meeting_url,
        source_name: 'Fireflies.ai'
      })

    if (entryError) {
      console.error('Error inserting entry:', entryError)
      // Don't throw - this is for backward compatibility
    }

    console.log(`Successfully saved meeting: ${transcript.title} (${meetingId})`)
    return meetingId

  } catch (error) {
    console.error('Error saving meeting to database:', error)
    throw error
  }
}

async function generateMeetingInsights(
  meetingId: string,
  transcript: FirefliesTranscript
): Promise<void> {
  try {
    const insights: any[] = []

    // Action items as insights
    if (transcript.summary?.action_items) {
      transcript.summary.action_items.forEach((item, index) => {
        insights.push({
          meeting_id: meetingId,
          insight_type: 'action_item',
          title: `Action Item ${index + 1}`,
          description: item,
          confidence_score: 0.8,
          priority: item.toLowerCase().includes('urgent') || item.toLowerCase().includes('asap') ? 'high' : 'medium'
        })
      })
    }

    // Questions as insights
    if (transcript.ai_filters?.questions) {
      transcript.ai_filters.questions.forEach((question, index) => {
        insights.push({
          meeting_id: meetingId,
          insight_type: 'follow_up',
          title: `Key Question ${index + 1}`,
          description: question,
          confidence_score: 0.7,
          priority: 'medium'
        })
      })
    }

    // Tasks as insights
    if (transcript.ai_filters?.tasks) {
      transcript.ai_filters.tasks.forEach((task, index) => {
        insights.push({
          meeting_id: meetingId,
          insight_type: 'action_item',
          title: `Task ${index + 1}`,
          description: task,
          confidence_score: 0.75,
          priority: 'medium'
        })
      })
    }

    // Insert insights if any were generated
    if (insights.length > 0) {
      const { error } = await supabaseAdmin
        .from('meeting_insights')
        .insert(insights)

      if (error) {
        console.error('Error inserting meeting insights:', error)
      } else {
        console.log(`Generated ${insights.length} insights for meeting ${meetingId}`)
      }
    }

  } catch (error) {
    console.error('Error generating meeting insights:', error)
  }
}

function buildEntryContent(transcript: FirefliesTranscript): string {
  let content = `Meeting: ${transcript.title}\n`
  content += `Duration: ${Math.round(transcript.duration / 60)} minutes\n`
  content += `Participants: ${transcript.participants.join(', ')}\n\n`

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

  if (transcript.summary?.outline && transcript.summary.outline.length > 0) {
    content += `Key Moments:\n`
    transcript.summary.outline.forEach(moment => {
      const minutes = Math.floor(moment.timestamp / 60)
      const seconds = moment.timestamp % 60
      content += `- [${minutes}:${seconds.toString().padStart(2, '0')}] ${moment.title}\n`
    })
  }

  return content
}

export async function syncFirefliesData(
  userId: string,
  integrationId: string,
  accessToken: string,
  lastSyncAt?: string
): Promise<number> {
  try {
    console.log('Starting Fireflies data sync...')
    
    let processedCount = 0
    let skip = 0
    const limit = 10 // Small batches to avoid rate limits
    let hasMore = true

    while (hasMore) {
      try {
        const { transcripts } = await getFirefliesTranscripts(
          accessToken,
          limit,
          skip,
          lastSyncAt
        )

        if (transcripts.length === 0) {
          hasMore = false
          break
        }

        for (const transcript of transcripts) {
          try {
            // Check if we already have this meeting
            const { data: existingMeeting } = await supabaseAdmin
              .from('meetings')
              .select('id')
              .eq('fireflies_id', transcript.id)
              .eq('user_id', userId)
              .single()

            if (!existingMeeting) {
              await saveMeetingToDatabase(transcript, userId, integrationId)
              processedCount++
            } else {
              console.log(`Meeting ${transcript.title} already exists, skipping...`)
            }
          } catch (error) {
            console.error(`Error processing transcript ${transcript.id}:`, error)
            // Continue with next transcript
          }
        }

        skip += limit
        hasMore = transcripts.length === limit

        // Rate limiting - Fireflies has strict limits
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error('Error fetching Fireflies transcripts:', error)
        break
      }
    }

    // Update integration sync status
    await supabaseAdmin
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_cursor: skip.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', integrationId)

    console.log(`Fireflies sync completed. Processed ${processedCount} new meetings.`)
    return processedCount

  } catch (error) {
    console.error('Error in Fireflies sync:', error)
    throw error
  }
}

// Export for use in API routes
export async function processFirefliesSync(job: SyncJob, integration: any): Promise<void> {
  try {
    let accessToken = integration.access_token

    // For Fireflies, we can use the API key directly
    if (!accessToken && process.env.FIREFLIES_API_KEY) {
      accessToken = process.env.FIREFLIES_API_KEY
    }

    if (!accessToken) {
      throw new Error('No Fireflies access token or API key available')
    }

    const lastSyncAt = job.job_type === 'incremental_sync' && integration.last_sync_at
      ? integration.last_sync_at
      : undefined

    await syncFirefliesData(
      integration.user_id,
      integration.id,
      accessToken,
      lastSyncAt
    )

  } catch (error) {
    console.error('Error in Fireflies sync job:', error)
    throw error
  }
}