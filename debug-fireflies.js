const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function testFirefliesAPI() {
  const apiKey = process.env.FIREFLIES_API_KEY
  console.log('API Key:', apiKey ? 'Present' : 'Missing')

  if (!apiKey) {
    console.log('❌ No Fireflies API key found')
    return
  }

  try {
    // Test the API call
    console.log('🔍 Testing Fireflies API...')
    
    const response = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query GetTranscripts($limit: Int) {
            transcripts(limit: $limit) {
              id
              title
              date
              duration
              participants
              summary {
                overview
                action_items
              }
            }
          }
        `,
        variables: { limit: 5 }
      })
    })

    if (!response.ok) {
      console.log('❌ API Error:', response.status, response.statusText)
      const text = await response.text()
      console.log('Response:', text)
      return
    }

    const data = await response.json()
    
    if (data.errors) {
      console.log('❌ GraphQL Errors:', data.errors)
      return
    }

    console.log('✅ API Success!')
    console.log('Found meetings:', data.data.transcripts?.length || 0)
    
    if (data.data.transcripts && data.data.transcripts.length > 0) {
      console.log('\n📋 Sample meeting:')
      const sample = data.data.transcripts[0]
      console.log('- Title:', sample.title)
      console.log('- Date:', new Date(parseInt(sample.date)).toLocaleString())
      console.log('- Duration:', Math.round(sample.duration / 60), 'minutes')
      console.log('- Participants:', sample.participants ? sample.participants.join(', ') : 'None')
    }

    // Test database connection
    console.log('\n🗄️  Testing database connection...')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const userId = '550e8400-e29b-41d4-a716-446655440000'
    
    // Test if we can query the meetings table
    const { data: existingMeetings, error } = await supabase
      .from('meetings')
      .select('id, title, meeting_date')
      .eq('user_id', userId)
      .limit(5)

    if (error) {
      console.log('❌ Database Error:', error.message)
      return
    }

    console.log('✅ Database Connected!')
    console.log('Existing meetings in DB:', existingMeetings.length)
    
    if (existingMeetings.length > 0) {
      console.log('Sample DB meeting:', existingMeetings[0].title)
    }

    // Try to insert a test meeting
    if (data.data.transcripts && data.data.transcripts.length > 0) {
      console.log('\n💾 Testing meeting insert...')
      const testMeeting = data.data.transcripts[0]
      
      const { data: insertResult, error: insertError } = await supabase
        .from('meetings')
        .insert({
          user_id: userId,
          fireflies_id: testMeeting.id + '_test',
          title: 'TEST: ' + testMeeting.title,
          meeting_date: new Date(parseInt(testMeeting.date)).toISOString(),
          duration_seconds: Math.round(testMeeting.duration),
          overview: testMeeting.summary?.overview || 'Test overview',
          action_items: Array.isArray(testMeeting.summary?.action_items) 
            ? testMeeting.summary.action_items 
            : testMeeting.summary?.action_items 
              ? [testMeeting.summary.action_items] 
              : [],
          keywords: [],
          questions: [],
          tasks: [],
          topics: [],
          tags: ['test', 'fireflies'],
          source_integration_id: '550e8400-e29b-41d4-a716-446655440001'
        })
        .select('id')
        .single()

      if (insertError) {
        console.log('❌ Insert Error:', insertError.message)
      } else {
        console.log('✅ Test meeting inserted with ID:', insertResult.id)
        
        // Clean up test record
        await supabase
          .from('meetings')
          .delete()
          .eq('id', insertResult.id)
        console.log('🧹 Test record cleaned up')
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

testFirefliesAPI() 