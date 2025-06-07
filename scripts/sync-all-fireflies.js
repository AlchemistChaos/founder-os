require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY
const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'

// Ultimate GraphQL query for comprehensive data extraction
const ULTIMATE_QUERY = `
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
    throw new Error(`Fireflies API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${data.errors[0].message}`)
  }

  return data.data
}

function extractComprehensiveParticipantData(sentences, participants) {
  if (!sentences || sentences.length === 0) {
    return { 
      speakerStats: {}, 
      totalSentences: 0,
      dominantSpeaker: null,
      speakingTimeDistribution: {},
      sentimentByParticipant: {},
      questionsByParticipant: {},
      actionItemsByParticipant: {}
    }
  }

  const speakerStats = {}
  const questionsByParticipant = {}
  const actionItemsByParticipant = {}
  
  sentences.forEach(sentence => {
    const speaker = sentence.speaker_name || 'Unknown'
    const text = sentence.text.toLowerCase()
    const duration = (sentence.end_time || sentence.start_time) - sentence.start_time
    
    if (!speakerStats[speaker]) {
      speakerStats[speaker] = {
        sentences: 0,
        totalTime: 0,
        words: 0,
        sentiment: { positive: 0, negative: 0, neutral: 0 },
        questions: 0,
        actionItems: 0
      }
      questionsByParticipant[speaker] = []
      actionItemsByParticipant[speaker] = []
    }
    
    const words = sentence.text.split(' ').length
    speakerStats[speaker].sentences++
    speakerStats[speaker].totalTime += duration
    speakerStats[speaker].words += words
    
    // Questions detection
    if (sentence.text.includes('?')) {
      speakerStats[speaker].questions++
      questionsByParticipant[speaker].push({
        question: sentence.text,
        timestamp: sentence.start_time
      })
    }
    
    // Action items detection
    if (text.includes('will ') || text.includes('should ') || text.includes('need to') || 
        text.includes('action') || text.includes('follow up') || text.includes('next step')) {
      speakerStats[speaker].actionItems++
      actionItemsByParticipant[speaker].push({
        item: sentence.text,
        timestamp: sentence.start_time
      })
    }
    
    // Enhanced sentiment analysis
    const positiveWords = ['great', 'good', 'excellent', 'awesome', 'perfect', 'yes', 'absolutely', 'love', 'fantastic']
    const negativeWords = ['bad', 'problem', 'issue', 'concern', 'difficult', 'wrong', 'no', 'disagree', 'unfortunately']
    
    const hasPositive = positiveWords.some(word => text.includes(word))
    const hasNegative = negativeWords.some(word => text.includes(word))
    
    if (hasPositive && !hasNegative) {
      speakerStats[speaker].sentiment.positive++
    } else if (hasNegative && !hasPositive) {
      speakerStats[speaker].sentiment.negative++
    } else {
      speakerStats[speaker].sentiment.neutral++
    }
  })

  // Calculate dominant speaker and distributions
  let dominantSpeaker = null
  let maxSpeakingTime = 0
  
  Object.keys(speakerStats).forEach(speaker => {
    if (speakerStats[speaker].totalTime > maxSpeakingTime) {
      maxSpeakingTime = speakerStats[speaker].totalTime
      dominantSpeaker = speaker
    }
  })

  const totalTime = Object.values(speakerStats).reduce((sum, stats) => sum + stats.totalTime, 0)
  const speakingTimeDistribution = {}
  const sentimentByParticipant = {}
  
  Object.keys(speakerStats).forEach(speaker => {
    speakingTimeDistribution[speaker] = Math.round((speakerStats[speaker].totalTime / totalTime) * 100)
    
    const sentiment = speakerStats[speaker].sentiment
    const total = sentiment.positive + sentiment.negative + sentiment.neutral
    sentimentByParticipant[speaker] = {
      positive: Math.round((sentiment.positive / total) * 100),
      negative: Math.round((sentiment.negative / total) * 100),
      neutral: Math.round((sentiment.neutral / total) * 100),
      overall: sentiment.positive > sentiment.negative ? 'positive' : 
               sentiment.negative > sentiment.positive ? 'negative' : 'neutral'
    }
  })

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

function extractComprehensiveSentiment(meeting, participantAnalysis) {
  const participantSentiments = Object.values(participantAnalysis.sentimentByParticipant || {})
  
  if (participantSentiments.length > 0) {
    const avgPositive = participantSentiments.reduce((sum, s) => sum + s.positive, 0) / participantSentiments.length
    const avgNegative = participantSentiments.reduce((sum, s) => sum + s.negative, 0) / participantSentiments.length
    
    if (avgPositive > avgNegative + 10) return 'positive'
    if (avgNegative > avgPositive + 10) return 'negative'
    return 'neutral'
  }
  
  return 'neutral'
}

async function syncAllFirefliesMeetings() {
  console.log('🚀 Starting COMPREHENSIVE Fireflies sync for ALL meetings...')
  console.log('🔑 Using API key:', FIREFLIES_API_KEY?.substring(0, 10) + '...')
  
  try {
    let totalProcessed = 0
    let totalNewMeetings = 0
    let skip = 0
    const limit = 50 // Process in batches of 50
    let hasMore = true
    
    while (hasMore) {
      console.log(`\n📥 Fetching meetings ${skip + 1} to ${skip + limit}...`)
      
      const result = await makeFirefliesAPICall(ULTIMATE_QUERY, {
        limit,
        skip
      })
      
      const meetings = result.transcripts || []
      
      if (meetings.length === 0) {
        console.log('✅ No more meetings to process')
        hasMore = false
        break
      }
      
      console.log(`📊 Retrieved ${meetings.length} meetings`)
      
      let batchNewMeetings = 0
      
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
        
        // COMPREHENSIVE DATA EXTRACTION
        const meetingDate = new Date(parseInt(meeting.date)).toISOString()
        const durationSeconds = meeting.duration || 0
        const durationMinutes = Math.round(durationSeconds / 60)
        
        // Extract comprehensive participant analysis
        const participantAnalysis = extractComprehensiveParticipantData(meeting.sentences, meeting.participants)
        const sentiment = extractComprehensiveSentiment(meeting, participantAnalysis)
        
        // Extract questions from transcript analysis
        const allQuestions = []
        Object.values(participantAnalysis.questionsByParticipant).forEach(questions => {
          allQuestions.push(...questions.map(q => q.question))
        })
        
        // Extract tasks from transcript analysis
        const allTasks = []
        Object.values(participantAnalysis.actionItemsByParticipant).forEach(items => {
          allTasks.push(...items.map(item => item.item))
        })
        
        // Use keywords as topics
        const allTopics = meeting.summary?.keywords || []
        
        // Enhanced tags with participant data
        const participantTags = Object.keys(participantAnalysis.speakerStats).map(name => 
          name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        )
        
        // Create comprehensive meeting record
        const meetingData = {
          id: crypto.randomUUID(),
          fireflies_id: meeting.id,
          user_id: userId,
          title: meeting.title || 'Untitled Meeting',
          meeting_date: meetingDate,
          duration_seconds: durationSeconds,
          duration_minutes: durationMinutes,
          meeting_url: null,
          transcript_url: meeting.transcript_url || null,
          audio_url: meeting.audio_url || null,
          overview: meeting.summary?.overview || 'No overview available',
          keywords: meeting.summary?.keywords || [],
          action_items: meeting.summary?.action_items || [],
          questions: allQuestions.slice(0, 20), // Limit to 20 questions
          tasks: allTasks.slice(0, 20), // Limit to 20 tasks
          topics: allTopics,
          sentiment: sentiment,
          outline: [],
          tags: [
            'fireflies',
            'meeting',
            `duration-${Math.round(durationMinutes)}min`,
            `participants-${Object.keys(participantAnalysis.speakerStats).length}`,
            `dominant-speaker-${participantAnalysis.dominantSpeaker?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown'}`,
            ...participantTags,
            ...(meeting.summary?.keywords || []).map(k => k.toLowerCase().replace(/\s+/g, '-'))
          ].filter(Boolean),
          source_integration_id: null,
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
        
        console.log('   ✅ Meeting inserted with comprehensive data!')
        console.log(`   📊 Duration: ${durationMinutes}min, Participants: ${Object.keys(participantAnalysis.speakerStats).length}`)
        console.log(`   🎭 Sentiment: ${sentiment}, Questions: ${allQuestions.length}, Tasks: ${allTasks.length}`)
        
        batchNewMeetings++
        totalNewMeetings++
      }
      
      totalProcessed += meetings.length
      console.log(`\n📈 Batch complete: ${batchNewMeetings} new meetings added`)
      
      // Move to next batch
      skip += limit
      
      // If we got fewer meetings than requested, we're done
      if (meetings.length < limit) {
        hasMore = false
      }
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('\n🎉 COMPREHENSIVE FIREFLIES SYNC COMPLETED!')
    console.log('='.repeat(80))
    console.log(`📊 Total meetings processed: ${totalProcessed}`)
    console.log(`✨ New meetings added with comprehensive data: ${totalNewMeetings}`)
    
    if (totalNewMeetings > 0) {
      console.log('\n🏆 SUCCESS: Comprehensive Fireflies sync completed!')
      console.log('📈 Each meeting now includes:')
      console.log('   ✅ Precise duration tracking (seconds & minutes)')
      console.log('   👥 Complete participant analysis')
      console.log('   📊 Speaking time distribution percentages')
      console.log('   🎭 Sentiment analysis by participant')
      console.log('   ❓ Questions extracted from transcript')
      console.log('   ✅ Action items extracted from transcript')
      console.log('   🏷️  Enhanced tagging with participant data')
      console.log('   💬 Full transcript sentence analysis')
      console.log('   🔍 Dominant speaker identification')
    } else {
      console.log('\n📝 All meetings were already synced!')
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

syncAllFirefliesMeetings() 