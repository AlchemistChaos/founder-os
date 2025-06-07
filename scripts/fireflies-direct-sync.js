require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY
const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'

// Simplified GraphQL query with only basic fields
const TRANSCRIPTS_QUERY = `
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
    const errorText = await response.text()
    console.error('❌ Fireflies API Error Response:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    })
    throw new Error(`Fireflies API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    console.error('❌ GraphQL Errors:', data.errors)
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
  }

  return data.data
}

async function syncAllFirefliesMeetings() {
  console.log('🚀 Starting complete Fireflies sync...')
  console.log('🔑 Using API key:', FIREFLIES_API_KEY?.substring(0, 10) + '...')
  
  try {
    let skip = 0
    const limit = 10
    let totalMeetings = 0
    let newMeetings = 0
    let hasMore = true
    
    while (hasMore) {
      console.log(`📥 Fetching batch: skip=${skip}, limit=${limit}...`)
      
      const result = await makeFirefliesAPICall(TRANSCRIPTS_QUERY, {
        limit,
        skip
      })
      
      const meetings = result.transcripts || []
      
      console.log(`📊 Retrieved ${meetings.length} meetings in this batch`)
      
      if (meetings.length === 0) {
        hasMore = false
        break
      }
      
      for (const meeting of meetings) {
        totalMeetings++
        
        console.log(`\n📅 Processing: "${meeting.title}" (${meeting.date})`)
        
        // Check if meeting already exists
        const { data: existingMeeting } = await supabase
          .from('meetings')
          .select('id')
          .eq('fireflies_id', meeting.id)
          .single()
        
        if (existingMeeting) {
          console.log('   ⏭️  Already exists, skipping...')
          continue
        }
        
        // Convert Fireflies timestamp to ISO string
        const meetingDate = new Date(parseInt(meeting.date)).toISOString()
        
        // Create meeting record
        const meetingData = {
          id: crypto.randomUUID(),
          fireflies_id: meeting.id,
          user_id: userId,
          title: meeting.title || 'Untitled Meeting',
          meeting_date: meetingDate,
          duration: meeting.duration || null,
          overview: meeting.summary?.overview || 'No overview available',
          action_items: meeting.summary?.action_items || [],
          keywords: meeting.summary?.keywords || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { error: meetingError } = await supabase
          .from('meetings')
          .insert(meetingData)
        
        if (meetingError) {
          console.error('   ❌ Error inserting meeting:', meetingError.message)
          continue
        }
        
        console.log('   ✅ Meeting inserted successfully')
        
        // Insert participants (participants is a string array in Fireflies)
        if (meeting.participants && meeting.participants.length > 0) {
          const participantData = meeting.participants.map(participant => ({
            id: crypto.randomUUID(),
            meeting_id: meetingData.id,
            name: participant.includes('@') ? participant.split('@')[0] : participant,
            email: participant.includes('@') ? participant : null,
            created_at: new Date().toISOString()
          }))
          
          const { error: participantsError } = await supabase
            .from('participants')
            .insert(participantData)
          
          if (participantsError) {
            console.error('   ⚠️  Error inserting participants:', participantsError.message)
          } else {
            console.log(`   👥 Inserted ${participantData.length} participants`)
          }
        }
        
        newMeetings++
      }
      
      // Check if we got fewer meetings than the limit (last page)
      if (meetings.length < limit) {
        hasMore = false
      } else {
        skip += limit
      }
      
      console.log(`📈 Progress: ${totalMeetings} meetings processed, ${newMeetings} new meetings added`)
    }
    
    console.log('\n🎉 Sync completed successfully!')
    console.log(`📊 Total meetings processed: ${totalMeetings}`)
    console.log(`✨ New meetings added: ${newMeetings}`)
    
    // Generate flashcards after sync
    if (newMeetings > 0) {
      console.log('\n🃏 Generating flashcards from new meetings...')
      // This would trigger flashcard generation - we can add this later
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message)
    console.error('Full error:', error)
  }
}

// Add crypto polyfill for UUID generation
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto
}

syncAllFirefliesMeetings() 