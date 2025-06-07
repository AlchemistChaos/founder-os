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

// Working Fireflies GraphQL query (simplified from ultimate sync)
const COMPREHENSIVE_QUERY = `
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

async function extractComprehensiveParticipantData(sentences, participants) {
  if (!sentences || sentences.length === 0) {
    return {
      speakerStats: {},
      totalSentences: 0,
      dominantSpeaker: 'Unknown',
      speakingTimeDistribution: {},
      sentimentByParticipant: {},
      questionsByParticipant: {},
      actionItemsByParticipant: {}
    }
  }

  const speakerStats = {}
  const questionsByParticipant = {}
  const actionItemsByParticipant = {}
  const sentimentByParticipant = {}

  // Initialize speaker stats
  const allSpeakers = [...new Set(sentences.map(s => s.speaker_name))]
  allSpeakers.forEach(speaker => {
    speakerStats[speaker] = {
      sentences: 0,
      words: 0,
      totalTime: 0,
      questions: 0,
      actionItems: 0,
      interruptionCount: 0,
      averageWordsPerSentence: 0
    }
    questionsByParticipant[speaker] = []
    actionItemsByParticipant[speaker] = []
    sentimentByParticipant[speaker] = { positive: 0, negative: 0, neutral: 0, overall: 'neutral' }
  })

  // Analyze each sentence
  sentences.forEach((sentence, index) => {
    const speaker = sentence.speaker_name
    const text = sentence.text
    const duration = sentence.end_time - sentence.start_time
    const wordCount = text.split(' ').length

    // Update basic stats
    speakerStats[speaker].sentences++
    speakerStats[speaker].words += wordCount
    speakerStats[speaker].totalTime += duration

    // Question detection
    if (text.includes('?')) {
      speakerStats[speaker].questions++
      questionsByParticipant[speaker].push({
        question: text,
        timestamp: sentence.start_time
      })
    }

    // Action item detection (simple heuristics)
    const actionWords = ['will', 'should', 'need to', 'have to', 'going to', 'plan to']
    if (actionWords.some(word => text.toLowerCase().includes(word))) {
      speakerStats[speaker].actionItems++
      actionItemsByParticipant[speaker].push({
        item: text,
        timestamp: sentence.start_time
      })
    }

    // Sentiment analysis (basic)
    const positiveWords = ['great', 'good', 'excellent', 'amazing', 'love', 'perfect', 'awesome']
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'problem', 'issue', 'concern']
    
    if (positiveWords.some(word => text.toLowerCase().includes(word))) {
      sentimentByParticipant[speaker].positive++
    } else if (negativeWords.some(word => text.toLowerCase().includes(word))) {
      sentimentByParticipant[speaker].negative++
    } else {
      sentimentByParticipant[speaker].neutral++
    }
  })

  // Calculate derived metrics
  const totalTime = Object.values(speakerStats).reduce((sum, stats) => sum + stats.totalTime, 0)
  const speakingTimeDistribution = {}
  
  Object.keys(speakerStats).forEach(speaker => {
    const stats = speakerStats[speaker]
    stats.averageWordsPerSentence = stats.sentences > 0 ? Math.round(stats.words / stats.sentences) : 0
    speakingTimeDistribution[speaker] = totalTime > 0 ? Math.round((stats.totalTime / totalTime) * 100) : 0
    
    // Calculate overall sentiment
    const total = sentimentByParticipant[speaker].positive + sentimentByParticipant[speaker].negative + sentimentByParticipant[speaker].neutral
    if (total > 0) {
      sentimentByParticipant[speaker].positive = Math.round((sentimentByParticipant[speaker].positive / total) * 100)
      sentimentByParticipant[speaker].negative = Math.round((sentimentByParticipant[speaker].negative / total) * 100)
      sentimentByParticipant[speaker].neutral = Math.round((sentimentByParticipant[speaker].neutral / total) * 100)
      
      if (sentimentByParticipant[speaker].positive > sentimentByParticipant[speaker].negative) {
        sentimentByParticipant[speaker].overall = 'positive'
      } else if (sentimentByParticipant[speaker].negative > sentimentByParticipant[speaker].positive) {
        sentimentByParticipant[speaker].overall = 'negative'
      } else {
        sentimentByParticipant[speaker].overall = 'neutral'
      }
    }
  })

  const dominantSpeaker = Object.keys(speakingTimeDistribution).reduce((a, b) => 
    speakingTimeDistribution[a] > speakingTimeDistribution[b] ? a : b
  )

  return {
    speakerStats,
    totalSentences: sentences.length,
    dominantSpeaker,
    speakingTimeDistribution,
    sentimentByParticipant,
    questionsByParticipant,
    actionItemsByParticipant
  }
}

async function syncAllFirefliesMeetings() {
  console.log('🔄 SYNCING ALL FIREFLIES MEETINGS')
  console.log('==================================')
  
  const limit = 10
  let skip = 0
  let hasMore = true
  let totalMeetings = 0
  let newMeetings = 0

  while (hasMore) {
    console.log(`\n📥 Fetching meetings ${skip + 1}-${skip + limit}...`)
    
    try {
      const result = await makeFirefliesAPICall(COMPREHENSIVE_QUERY, { limit, skip })
      const meetings = result.transcripts || []
      
      console.log(`📊 Retrieved ${meetings.length} meetings`)
      
      if (meetings.length === 0) {
        hasMore = false
        break
      }
      
      for (const [index, meeting] of meetings.entries()) {
        const globalIndex = skip + index + 1
        console.log(`\n📅 Processing meeting ${globalIndex}: "${meeting.title}"`)
        
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
        
        // Process comprehensive meeting data
        const meetingDate = new Date(parseInt(meeting.date)).toISOString()
        const durationSeconds = meeting.duration || 0
        const durationMinutes = Math.round(durationSeconds / 60)
        
        // Extract participant analysis
        const participantAnalysis = await extractComprehensiveParticipantData(meeting.sentences, meeting.participants)
        
                 // Insert meeting
         const { data: insertedMeeting, error: meetingError } = await supabase
           .from('meetings')
           .insert({
             user_id: USER_ID,
             fireflies_id: meeting.id,
             title: meeting.title,
             meeting_date: meetingDate,
             duration_seconds: durationSeconds,
             duration_minutes: durationMinutes,
             transcript_url: meeting.transcript_url,
             audio_url: meeting.audio_url,
             overview: meeting.summary?.overview,
             keywords: Array.isArray(meeting.summary?.keywords) ? meeting.summary.keywords : [],
             action_items: Array.isArray(meeting.summary?.action_items) ? meeting.summary.action_items : [],
             questions: Object.values(participantAnalysis.questionsByParticipant).flat().map(q => q.question),
             sentiment: participantAnalysis.dominantSpeaker ? 
               participantAnalysis.sentimentByParticipant[participantAnalysis.dominantSpeaker]?.overall : 'neutral',
             tags: [
               'fireflies',
               'meeting',
               ...(Array.isArray(meeting.summary?.keywords) ? meeting.summary.keywords : []).map(k => k.toLowerCase().replace(/\s+/g, '-'))
             ]
           })
           .select('id')
           .single()

        if (meetingError) {
          console.error('   ❌ Error inserting meeting:', meetingError)
          continue
        }

        const meetingId = insertedMeeting.id
        newMeetings++
        
        // Insert transcript sentences
        if (meeting.sentences && meeting.sentences.length > 0) {
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

          // Insert in batches
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
          
          console.log(`   📝 Inserted ${transcriptData.length} transcript segments`)
        }
        
        // Insert participants
        const participantData = Object.keys(participantAnalysis.speakerStats).map(speaker => ({
          meeting_id: meetingId,
          name: speaker,
          speaking_time_seconds: Math.round(participantAnalysis.speakerStats[speaker].totalTime),
          speaking_percentage: participantAnalysis.speakingTimeDistribution[speaker] || 0,
          word_count: participantAnalysis.speakerStats[speaker].words
        }))

        if (participantData.length > 0) {
          const { error: participantError } = await supabase
            .from('meeting_participants')
            .insert(participantData)

          if (participantError) {
            console.error('   ⚠️  Error inserting participants:', participantError)
          } else {
            console.log(`   👥 Inserted ${participantData.length} participants`)
          }
        }
        
        console.log(`   ✅ Successfully processed meeting "${meeting.title}"`)
      }
      
      totalMeetings += meetings.length
      skip += limit
      
      // Check if we have more meetings
      if (meetings.length < limit) {
        hasMore = false
      }
      
    } catch (error) {
      console.error(`❌ Error in batch starting at ${skip}:`, error)
      hasMore = false
    }
  }
  
  console.log(`\n🎉 SYNC COMPLETE!`)
  console.log(`📊 Total meetings processed: ${totalMeetings}`)
  console.log(`✨ New meetings added: ${newMeetings}`)
  
  return { totalMeetings, newMeetings }
}

async function testInsightsOnLatestMeetings() {
  console.log('\n🧠 TESTING GOAL-ALIGNED INSIGHTS ON LATEST 10 MEETINGS')
  console.log('======================================================')
  
  // Get latest 10 meetings
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, overview')
    .eq('user_id', USER_ID)
    .order('meeting_date', { ascending: false })
    .limit(10)
  
  if (error) {
    console.error('Error fetching meetings:', error)
    return
  }
  
  if (!meetings || meetings.length === 0) {
    console.log('❌ No meetings found to test!')
    return
  }
  
  console.log(`📅 Found ${meetings.length} recent meetings to test`)
  
  for (const [index, meeting] of meetings.entries()) {
    console.log(`\n🧪 TESTING MEETING ${index + 1}: "${meeting.title}"`)
    console.log('='.repeat(80))
    console.log(`📅 Date: ${new Date(meeting.meeting_date).toLocaleDateString()}`)
    console.log(`📝 Overview: ${meeting.overview?.substring(0, 200)}...`)
    
    try {
      // Call the insights API
      const response = await fetch(`http://localhost:3000/api/meetings/${meeting.id}/insights`, {
        headers: {
          'Cookie': 'next-auth.session-token=your-session-token' // You'd need a real session
        }
      })
      
      if (!response.ok) {
        console.log(`❌ API call failed: ${response.status}`)
        continue
      }
      
      const insightsData = await response.json()
      
      if (insightsData.success) {
        console.log('\n🎯 GOAL-ALIGNED INSIGHTS:')
        console.log(`📊 Total insights: ${insightsData.insights.length}`)
        console.log(`🔥 High priority: ${insightsData.goal_analysis?.high_priority_count || 0}`)
        console.log(`⚡ Reaction-based: ${insightsData.goal_analysis?.reaction_count || 0}`)
        
        console.log('\n📈 GOAL RELEVANCE AVERAGES:')
        console.log(`🎬 Creator Brand: ${insightsData.goal_analysis?.avg_creator_relevance || 0}/10`)
        console.log(`💓 Pulse Startup: ${insightsData.goal_analysis?.avg_pulse_relevance || 0}/10`)
        console.log(`📊 Data-Driven: ${insightsData.goal_analysis?.avg_data_relevance || 0}/10`)
        console.log(`🧠 Learning Secrets: ${insightsData.goal_analysis?.avg_learning_relevance || 0}/10`)
        
        console.log('\n🏆 TOP INSIGHTS:')
        insightsData.insights.slice(0, 3).forEach((insight, i) => {
          console.log(`\n${i + 1}. ${insight.insight}`)
          console.log(`   📊 Goal Score: ${insight.goal_alignment?.overall_score || 0}/40`)
          console.log(`   🎯 Priority: ${insight.priority} | Reaction: ${insight.reaction ? '🔥' : '❌'}`)
          console.log(`   💡 Why: ${insight.priority_reason}`)
          console.log(`   🎨 Creator: ${insight.goal_alignment?.creator_brand || 0} | 💓 Pulse: ${insight.goal_alignment?.pulse_startup || 0} | 📊 Data: ${insight.goal_alignment?.data_driven || 0} | 🧠 Learning: ${insight.goal_alignment?.learning_secrets || 0}`)
        })
        
        console.log('\n📝 SUMMARY:')
        console.log(insightsData.summary)
        
      } else {
        console.log(`❌ Insights generation failed: ${insightsData.error}`)
      }
      
    } catch (error) {
      console.error(`❌ Error testing insights for meeting ${meeting.id}:`, error.message)
    }
  }
}

async function runFullTest() {
  console.log('🚀 STARTING FULL GOAL-ALIGNED INSIGHTS TEST')
  console.log('===========================================')
  
  try {
    // Step 1: Clean existing data
    console.log('\n1️⃣ CLEANING EXISTING DATA...')
    await cleanUserData()
    
    // Step 2: Sync all Fireflies meetings
    console.log('\n2️⃣ SYNCING ALL FIREFLIES MEETINGS...')
    await syncAllFirefliesMeetings()
    
    // Step 3: Test insights on latest meetings
    console.log('\n3️⃣ TESTING GOAL-ALIGNED INSIGHTS...')
    await testInsightsOnLatestMeetings()
    
    console.log('\n🎉 FULL TEST COMPLETE!')
    console.log('The goal-aligned insight system is ready!')
    
  } catch (error) {
    console.error('❌ Full test failed:', error)
  }
}

// Run the full test
runFullTest() 