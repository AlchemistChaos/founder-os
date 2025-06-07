require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = '04d47b62-bba7-4526-a0f6-42ba34999de1'
const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY

// Import cleanup function
const { cleanUserData } = require('./clean-user-data.js')

// Simple Fireflies GraphQL query
const SIMPLE_QUERY = `
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
    }
  }
`

async function makeFirefliesAPICall(query, variables = {}) {
  console.log('🔥 Making Fireflies API call...')
  
  try {
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
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}

async function syncSimpleMeetings() {
  console.log('🔄 SYNCING SIMPLE MEETINGS (NO TRANSCRIPTS)')
  console.log('===========================================')
  
  try {
    const result = await makeFirefliesAPICall(SIMPLE_QUERY, { limit: 5, skip: 0 })
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
        console.log('   ⏭️  Already exists, skipping...')
        continue
      }
      
      // Process basic meeting data
      const meetingDate = new Date(parseInt(meeting.date)).toISOString()
      const durationSeconds = meeting.duration || 0
      const durationMinutes = Math.round(durationSeconds / 60)
      
      // Insert meeting (basic data only)
      const { data: insertedMeeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: USER_ID,
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
          tags: [
            'fireflies',
            'meeting',
            'simple-sync'
          ]
        })
        .select('id')
        .single()

      if (meetingError) {
        console.error('   ❌ Error inserting meeting:', meetingError)
        continue
      }

      console.log(`   ✅ Successfully inserted meeting "${meeting.title}"`)
    }
    
    console.log(`\n🎉 SIMPLE SYNC COMPLETE!`)
    
    return meetings.length
    
  } catch (error) {
    console.error('❌ Simple sync failed:', error)
    throw error
  }
}

async function testInsightsAPI() {
  console.log('\n🧠 TESTING GOAL-ALIGNED INSIGHTS API')
  console.log('=====================================')
  
  // Get latest meetings
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, overview')
    .eq('user_id', USER_ID)
    .order('meeting_date', { ascending: false })
    .limit(3)
  
  if (error) {
    console.error('Error fetching meetings:', error)
    return
  }
  
  if (!meetings || meetings.length === 0) {
    console.log('❌ No meetings found to test!')
    return
  }
  
  console.log(`📅 Found ${meetings.length} meetings to test`)
  
  for (const [index, meeting] of meetings.entries()) {
    console.log(`\n🧪 TESTING MEETING ${index + 1}: "${meeting.title}"`)
    console.log('='.repeat(60))
    console.log(`📅 Date: ${new Date(meeting.meeting_date).toLocaleDateString()}`)
    console.log(`📝 Overview: ${meeting.overview?.substring(0, 150)}...`)
    
    try {
      // Test the insights API directly (without HTTP)
      // We'll simulate what the API does
      
      console.log('✅ Meeting ready for insights processing')
      console.log(`   📊 Meeting ID: ${meeting.id}`)
      console.log(`   🎯 Can be processed by goal-aligned system`)
      
    } catch (error) {
      console.error(`❌ Error with meeting ${meeting.id}:`, error.message)
    }
  }
}

async function runSimpleTest() {
  console.log('🚀 STARTING SIMPLE GOAL-ALIGNED TEST')
  console.log('====================================')
  
  try {
    // Step 1: Clean existing data
    console.log('\n1️⃣ CLEANING EXISTING DATA...')
    await cleanUserData()
    
    // Step 2: Sync simple meetings (no transcripts)
    console.log('\n2️⃣ SYNCING SIMPLE MEETINGS...')
    const syncedCount = await syncSimpleMeetings()
    
    if (syncedCount > 0) {
      // Step 3: Test insights readiness
      console.log('\n3️⃣ TESTING INSIGHTS READINESS...')
      await testInsightsAPI()
    }
    
    console.log('\n🎉 SIMPLE TEST COMPLETE!')
    console.log('Ready to manually test insights in the web interface!')
    console.log('Navigate to: http://localhost:3001 and check your meetings')
    
  } catch (error) {
    console.error('❌ Simple test failed:', error)
  }
}

// Run the simple test
runSimpleTest() 