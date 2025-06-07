require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY
const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'

// Query that includes transcript sentences
const FULL_TRANSCRIPT_QUERY = `
query GetTranscripts($limit: Int, $skip: Int) {
  transcripts(
    limit: $limit
    skip: $skip
  ) {
    id
    title
    date
    duration
    summary {
      overview
      action_items
      keywords
    }
    participants
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

async function makeFirefliesAPICall(query, variables = {}) {
  console.log('🔥 Making Fireflies API call...')
  
  const response = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIREFLIES_API_KEY}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    console.error('GraphQL errors:', data.errors)
    throw new Error('GraphQL query failed')
  }

  return data.data
}

async function syncWithFullTranscripts() {
  console.log('🚀 SYNCING WITH FULL TRANSCRIPT SEGMENTS')
  console.log('========================================')
  
  try {
    const result = await makeFirefliesAPICall(FULL_TRANSCRIPT_QUERY, { limit: 3, skip: 0 })
    const meetings = result.transcripts || []
    
    console.log(`📊 Retrieved ${meetings.length} meetings`)
    
    for (const [index, meeting] of meetings.entries()) {
      console.log(`\n📅 Processing meeting ${index + 1}: "${meeting.title}"`)
      
      // Check if meeting already exists
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('fireflies_id', meeting.id)
        .single()
      
      if (existingMeeting) {
        console.log('   ⏭️  Meeting exists, checking for transcripts...')
        
        // Check if transcripts exist
        const { data: existingTranscripts } = await supabase
          .from('meeting_transcripts')
          .select('id')
          .eq('meeting_id', existingMeeting.id)
          .limit(1)
        
        if (existingTranscripts && existingTranscripts.length > 0) {
          console.log('   ⏭️  Transcripts already exist, skipping...')
          continue
        } else {
          console.log('   📝 Adding transcripts to existing meeting...')
          await insertTranscripts(existingMeeting.id, meeting)
          continue
        }
      }
      
      // Insert new meeting
      const meetingDate = new Date(parseInt(meeting.date)).toISOString()
      const durationSeconds = Math.round(meeting.duration || 0)
      
      const { data: insertedMeeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: userId,
          fireflies_id: meeting.id,
          title: meeting.title,
          meeting_date: meetingDate,
          duration_seconds: durationSeconds,
          transcript_url: meeting.transcript_url,
          audio_url: meeting.audio_url,
          overview: meeting.summary?.overview,
          keywords: Array.isArray(meeting.summary?.keywords) ? meeting.summary.keywords : [],
          action_items: Array.isArray(meeting.summary?.action_items) ? meeting.summary.action_items : [],
          questions: [],
          sentiment: 'neutral',
          tags: ['fireflies', 'meeting', 'full-transcript']
        })
        .select('id')
        .single()

      if (meetingError) {
        console.error('   ❌ Error inserting meeting:', meetingError)
        continue
      }

      console.log(`   ✅ Meeting inserted: ${insertedMeeting.id}`)
      
      // Insert transcripts
      await insertTranscripts(insertedMeeting.id, meeting)
      
      // Insert participants
      await insertParticipants(insertedMeeting.id, meeting)
    }
    
    console.log('\n🎉 FULL TRANSCRIPT SYNC COMPLETE!')
    
  } catch (error) {
    console.error('❌ Sync failed:', error)
  }
}

async function insertTranscripts(meetingId, meeting) {
  if (!meeting.sentences || meeting.sentences.length === 0) {
    console.log('   📝 No transcript sentences available')
    return
  }
  
  console.log(`   📝 Inserting ${meeting.sentences.length} transcript segments...`)
  
  const transcriptData = meeting.sentences.map(sentence => ({
    meeting_id: meetingId,
    speaker_name: sentence.speaker_name,
    text_content: sentence.text,
    start_time_seconds: Math.round(sentence.start_time),
    end_time_seconds: Math.round(sentence.end_time),
    contains_action_item: false,
    contains_question: sentence.text.includes('?'),
    sentiment: 'neutral'
  }))

  // Insert in batches to avoid overwhelming the database
  const batchSize = 100
  for (let i = 0; i < transcriptData.length; i += batchSize) {
    const batch = transcriptData.slice(i, i + batchSize)
    const { error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .insert(batch)

    if (transcriptError) {
      console.error(`   ⚠️  Error inserting transcript batch ${i}:`, transcriptError)
    }
  }
  
  console.log(`   ✅ Inserted ${transcriptData.length} transcript segments`)
}

async function insertParticipants(meetingId, meeting) {
  if (!meeting.participants || meeting.participants.length === 0) {
    console.log('   👥 No participants to insert')
    return
  }
  
  console.log(`   👥 Inserting ${meeting.participants.length} participants...`)
  
  const participantData = meeting.participants.map(participant => ({
    meeting_id: meetingId,
    name: participant.includes('@') ? participant.split('@')[0] : participant,
    email: participant.includes('@') ? participant : null,
    speaking_time_seconds: 0,
    speaking_percentage: 0,
    word_count: 0
  }))

  const { error: participantError } = await supabase
    .from('meeting_participants')
    .insert(participantData)

  if (participantError) {
    console.error('   ⚠️  Error inserting participants:', participantError)
  } else {
    console.log(`   ✅ Inserted ${participantData.length} participants`)
  }
}

// Add crypto polyfill for UUID generation
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto
}

syncWithFullTranscripts() 