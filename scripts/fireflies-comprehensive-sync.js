require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY
const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'

// Working GraphQL query based on your existing code - let's test what we CAN get
const COMPREHENSIVE_TRANSCRIPTS_QUERY = `
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
  console.log('🔥 Making comprehensive Fireflies API call...')
  
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
      body: errorText.substring(0, 500) + '...'
    })
    throw new Error(`Fireflies API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    console.error('❌ GraphQL Errors:', data.errors.map(e => e.message))
    throw new Error(`GraphQL errors: ${data.errors[0].message}`)
  }

  return data.data
}

function analyzeParticipants(sentences, participants) {
  if (!sentences || sentences.length === 0) {
    return { speakerStats: {}, totalSentences: 0 }
  }

  const speakerStats = {}
  
  sentences.forEach(sentence => {
    const speaker = sentence.speaker_name || 'Unknown'
    if (!speakerStats[speaker]) {
      speakerStats[speaker] = {
        sentences: 0,
        totalTime: 0,
        words: 0,
        sentiment: { positive: 0, negative: 0, neutral: 0 }
      }
    }
    
    speakerStats[speaker].sentences++
    speakerStats[speaker].totalTime += (sentence.end_time || sentence.start_time) - sentence.start_time
    speakerStats[speaker].words += sentence.text.split(' ').length
    
    // Simple sentiment analysis
    const text = sentence.text.toLowerCase()
    if (text.includes('great') || text.includes('good') || text.includes('excellent') || text.includes('!')) {
      speakerStats[speaker].sentiment.positive++
    } else if (text.includes('bad') || text.includes('problem') || text.includes('issue') || text.includes('concern')) {
      speakerStats[speaker].sentiment.negative++
    } else {
      speakerStats[speaker].sentiment.neutral++
    }
  })

  return { speakerStats, totalSentences: sentences.length }
}

function extractSentiment(meeting) {
  // Analyze sentiment from available content
  const allText = [
    meeting.title || '',
    meeting.summary?.overview || '',
    ...(meeting.summary?.action_items || [])
  ].join(' ').toLowerCase()
  
  if (allText.includes('great') || allText.includes('success') || allText.includes('excellent') || allText.includes('good')) {
    return 'positive'
  } else if (allText.includes('problem') || allText.includes('issue') || allText.includes('concern') || allText.includes('bad')) {
    return 'negative'
  }
  return 'neutral'
}

async function syncComprehensiveMeetings() {
  console.log('🚀 Starting COMPREHENSIVE Fireflies sync (testing 10 meetings)...')
  console.log('🔑 Using API key:', FIREFLIES_API_KEY?.substring(0, 10) + '...')
  
  try {
    // Test with just 10 meetings first
    const limit = 10
    const skip = 0
    
    console.log(`📥 Fetching ${limit} meetings for comprehensive analysis...`)
    
    const result = await makeFirefliesAPICall(COMPREHENSIVE_TRANSCRIPTS_QUERY, {
      limit,
      skip
    })
    
    const meetings = result.transcripts || []
    
    console.log(`📊 Retrieved ${meetings.length} meetings with comprehensive data`)
    console.log('\n🔍 ANALYZING FIRST MEETING IN DETAIL:')
    
    if (meetings.length > 0) {
      const firstMeeting = meetings[0]
      console.log('\n📋 MEETING OVERVIEW:')
      console.log('- ID:', firstMeeting.id)
      console.log('- Title:', firstMeeting.title)
      console.log('- Date:', new Date(parseInt(firstMeeting.date)).toISOString())
      console.log('- Duration (seconds):', firstMeeting.duration)
      console.log('- Duration (minutes):', Math.round(firstMeeting.duration / 60))
             console.log('- Transcript URL:', firstMeeting.transcript_url || 'N/A')
       console.log('- Audio URL:', firstMeeting.audio_url || 'N/A')
      
             console.log('\n👥 PARTICIPANTS:')
       console.log('- Participants (array):', firstMeeting.participants)
      
      console.log('\n📝 SUMMARY DATA:')
             console.log('- Overview:', firstMeeting.summary?.overview?.substring(0, 100) + '...')
       console.log('- Keywords:', firstMeeting.summary?.keywords)
       console.log('- Action Items:', firstMeeting.summary?.action_items)
              console.log('- Available fields in summary:', Object.keys(firstMeeting.summary || {}))
       
       console.log('\n📊 ADDITIONAL FIELDS:')
       console.log('- All meeting fields:', Object.keys(firstMeeting))
       console.log('- Can we get more data? Let\'s see what else is available...')
      
      console.log('\n🗣️  TRANSCRIPT ANALYSIS:')
      if (firstMeeting.sentences && firstMeeting.sentences.length > 0) {
        const analysis = analyzeParticipants(firstMeeting.sentences, firstMeeting.participants)
        console.log('- Total sentences:', analysis.totalSentences)
        console.log('- Speaker breakdown:')
        Object.entries(analysis.speakerStats).forEach(([speaker, stats]) => {
          console.log(`  • ${speaker}: ${stats.sentences} sentences, ${stats.words} words, ${Math.round(stats.totalTime)}s speaking`)
        })
      } else {
        console.log('- No sentence-level transcript data available')
      }
    }
    
    console.log('\n💾 TESTING DATABASE INSERTION...')
    
    let newMeetings = 0
    
    for (const [index, meeting] of meetings.entries()) {
      console.log(`\n📅 Processing meeting ${index + 1}/${meetings.length}: "${meeting.title}"`)
      
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
      
      // Convert timestamp and analyze data
      const meetingDate = new Date(parseInt(meeting.date)).toISOString()
      const durationSeconds = meeting.duration || 0
      const durationMinutes = Math.round(durationSeconds / 60)
      const sentiment = extractSentiment(meeting)
      
             // Comprehensive participant processing
       const allParticipants = []
       if (meeting.participants) allParticipants.push(...meeting.participants)
      
             // Use available data for comprehensive fields
       const allKeywords = meeting.summary?.keywords || []
       const allActionItems = meeting.summary?.action_items || []
       const allQuestions = [] // Will be extracted from transcript
       const allTasks = [] // Will be extracted from transcript
       const allTopics = [] // Will be extracted from keywords
      
      // Create comprehensive meeting record
      const meetingData = {
        id: crypto.randomUUID(),
        fireflies_id: meeting.id,
        user_id: userId,
        title: meeting.title || 'Untitled Meeting',
        meeting_date: meetingDate,
        duration_seconds: durationSeconds,
        duration_minutes: durationMinutes,
                 meeting_url: null, // Not available in basic query
        transcript_url: meeting.transcript_url || null,
        audio_url: meeting.audio_url || null,
        overview: meeting.summary?.overview || 'No overview available',
        keywords: [...new Set(allKeywords)], // Remove duplicates
        action_items: [...new Set(allActionItems)],
        questions: [...new Set(allQuestions)],
        tasks: [...new Set(allTasks)],
        topics: [...new Set(allTopics)],
        sentiment: sentiment,
        outline: meeting.summary?.outline || [],
                 tags: [
           'fireflies',
           'meeting',
           ...allKeywords.map(k => k.toLowerCase().replace(/\s+/g, '-'))
         ],
        source_integration_id: null, // You can add this if needed
        last_synced_at: new Date().toISOString(),
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
      console.log(`   📊 Duration: ${durationMinutes}min, Participants: ${allParticipants.length}, Sentiment: ${sentiment}`)
      
      newMeetings++
    }
    
    console.log('\n🎉 Comprehensive sync test completed!')
    console.log(`📊 Total meetings processed: ${meetings.length}`)
    console.log(`✨ New meetings added: ${newMeetings}`)
    
    if (newMeetings > 0) {
      console.log('\n✅ SUCCESS: The comprehensive sync is working!')
      console.log('🔄 Ready to sync all meetings? Update limit to process more!')
    }
    
  } catch (error) {
    console.error('❌ Comprehensive sync failed:', error.message)
    console.error('Full error:', error)
  }
}

// Add crypto polyfill for UUID generation
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto
}

syncComprehensiveMeetings() 