require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY
const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'

// Ultimate GraphQL query - testing all possible fields incrementally
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
  console.log('🔥 Making ultimate Fireflies API call...')
  
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
        averageWordsPerSentence: 0,
        sentiment: { positive: 0, negative: 0, neutral: 0 },
        questions: 0,
        actionItems: 0,
        interruptionCount: 0,
        longPauses: 0
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
    
    // Action items detection (look for future tense, "will", "should", "need to")
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
    
    // Detect interruptions (very short sentences followed by different speaker)
    const prevSentenceIndex = sentences.indexOf(sentence) - 1
    if (prevSentenceIndex >= 0) {
      const prevSentence = sentences[prevSentenceIndex]
      if (prevSentence.speaker_name !== speaker && duration < 2) {
        speakerStats[speaker].interruptionCount++
      }
    }
  })

  // Calculate averages and dominant speaker
  let dominantSpeaker = null
  let maxSpeakingTime = 0
  
  Object.keys(speakerStats).forEach(speaker => {
    const stats = speakerStats[speaker]
    stats.averageWordsPerSentence = Math.round(stats.words / stats.sentences)
    
    if (stats.totalTime > maxSpeakingTime) {
      maxSpeakingTime = stats.totalTime
      dominantSpeaker = speaker
    }
  })

  const totalTime = Object.values(speakerStats).reduce((sum, stats) => sum + stats.totalTime, 0)
  const speakingTimeDistribution = {}
  
  Object.keys(speakerStats).forEach(speaker => {
    speakingTimeDistribution[speaker] = Math.round((speakerStats[speaker].totalTime / totalTime) * 100)
  })

  const sentimentByParticipant = {}
  Object.keys(speakerStats).forEach(speaker => {
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
  // Use participant sentiment analysis for overall meeting sentiment
  const participantSentiments = Object.values(participantAnalysis.sentimentByParticipant || {})
  
  if (participantSentiments.length > 0) {
    const avgPositive = participantSentiments.reduce((sum, s) => sum + s.positive, 0) / participantSentiments.length
    const avgNegative = participantSentiments.reduce((sum, s) => sum + s.negative, 0) / participantSentiments.length
    
    if (avgPositive > avgNegative + 10) return 'positive'
    if (avgNegative > avgPositive + 10) return 'negative'
    return 'neutral'
  }
  
  // Fallback to content analysis
  const allText = [
    meeting.title || '',
    meeting.summary?.overview || '',
    ...(meeting.summary?.action_items || [])
  ].join(' ').toLowerCase()
  
  if (allText.includes('great') || allText.includes('success') || allText.includes('excellent')) {
    return 'positive'
  } else if (allText.includes('problem') || allText.includes('issue') || allText.includes('concern')) {
    return 'negative'
  }
  return 'neutral'
}

async function ultimateFirefliesSync() {
  console.log('🚀 Starting ULTIMATE Fireflies sync (testing 10 meetings with maximum data extraction)...')
  console.log('🔑 Using API key:', FIREFLIES_API_KEY?.substring(0, 10) + '...')
  
  try {
    // Test with 10 meetings first
    const limit = 10
    const skip = 0
    
    console.log(`📥 Fetching ${limit} meetings for ultimate analysis...`)
    
    const result = await makeFirefliesAPICall(ULTIMATE_QUERY, {
      limit,
      skip
    })
    
    const meetings = result.transcripts || []
    
    console.log(`📊 Retrieved ${meetings.length} meetings with ultimate data extraction`)
    
    if (meetings.length > 0) {
      const firstMeeting = meetings[0]
      console.log('\n🔬 ULTIMATE ANALYSIS OF FIRST MEETING:')
      console.log('='.repeat(80))
      
      console.log('\n📋 BASIC INFO:')
      console.log(`- ID: ${firstMeeting.id}`)
      console.log(`- Title: ${firstMeeting.title}`)
      console.log(`- Date: ${new Date(parseInt(firstMeeting.date)).toISOString()}`)
      console.log(`- Duration: ${Math.round(firstMeeting.duration / 60)} minutes (${firstMeeting.duration} seconds)`)
      
      console.log('\n📝 CONTENT SUMMARY:')
      console.log(`- Overview: ${firstMeeting.summary?.overview?.substring(0, 200)}...`)
      console.log(`- Keywords (${firstMeeting.summary?.keywords?.length || 0}):`, firstMeeting.summary?.keywords)
      console.log(`- Action Items: ${Array.isArray(firstMeeting.summary?.action_items) ? firstMeeting.summary.action_items.length : 'N/A'}`)
      
      // COMPREHENSIVE PARTICIPANT ANALYSIS
      const participantAnalysis = extractComprehensiveParticipantData(firstMeeting.sentences, firstMeeting.participants)
      
      console.log('\n👥 COMPREHENSIVE PARTICIPANT ANALYSIS:')
      console.log(`- Total participants: ${Object.keys(participantAnalysis.speakerStats).length}`)
      console.log(`- Dominant speaker: ${participantAnalysis.dominantSpeaker}`)
      console.log(`- Total transcript sentences: ${participantAnalysis.totalSentences}`)
      
      console.log('\n📊 SPEAKING TIME DISTRIBUTION:')
      Object.entries(participantAnalysis.speakingTimeDistribution).forEach(([speaker, percentage]) => {
        console.log(`  • ${speaker}: ${percentage}%`)
      })
      
      console.log('\n🎭 SENTIMENT BY PARTICIPANT:')
      Object.entries(participantAnalysis.sentimentByParticipant).forEach(([speaker, sentiment]) => {
        console.log(`  • ${speaker}: ${sentiment.overall} (${sentiment.positive}% pos, ${sentiment.negative}% neg, ${sentiment.neutral}% neutral)`)
      })
      
      console.log('\n❓ QUESTIONS BY PARTICIPANT:')
      Object.entries(participantAnalysis.questionsByParticipant).forEach(([speaker, questions]) => {
        console.log(`  • ${speaker}: ${questions.length} questions`)
        questions.slice(0, 2).forEach(q => {
          console.log(`    - "${q.question.substring(0, 80)}..." at ${Math.round(q.timestamp)}s`)
        })
      })
      
      console.log('\n✅ ACTION ITEMS BY PARTICIPANT:')
      Object.entries(participantAnalysis.actionItemsByParticipant).forEach(([speaker, items]) => {
        console.log(`  • ${speaker}: ${items.length} action items`)
        items.slice(0, 2).forEach(item => {
          console.log(`    - "${item.item.substring(0, 80)}..." at ${Math.round(item.timestamp)}s`)
        })
      })
      
      console.log('\n📈 DETAILED SPEAKER STATS:')
      Object.entries(participantAnalysis.speakerStats).forEach(([speaker, stats]) => {
        console.log(`  • ${speaker}:`)
        console.log(`    - Speaking time: ${Math.round(stats.totalTime)}s`)
        console.log(`    - Sentences: ${stats.sentences}`)
        console.log(`    - Words: ${stats.words}`)
        console.log(`    - Avg words/sentence: ${stats.averageWordsPerSentence}`)
        console.log(`    - Questions asked: ${stats.questions}`)
        console.log(`    - Action items mentioned: ${stats.actionItems}`)
        console.log(`    - Interruptions: ${stats.interruptionCount}`)
      })
    }
    
    console.log('\n💾 ULTIMATE DATABASE INSERTION TEST...')
    
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
      
      // Create ultimate meeting record with ALL possible data
      const meetingData = {
        id: crypto.randomUUID(),
        fireflies_id: meeting.id,
        user_id: userId,
        title: meeting.title || 'Untitled Meeting',
        meeting_date: meetingDate,
        duration_seconds: durationSeconds,
        duration_minutes: durationMinutes,
        meeting_url: null, // Not available in basic API
        transcript_url: meeting.transcript_url || null,
        audio_url: meeting.audio_url || null,
        overview: meeting.summary?.overview || 'No overview available',
        keywords: meeting.summary?.keywords || [],
        action_items: meeting.summary?.action_items || [],
        questions: allQuestions.slice(0, 20), // Limit to 20 questions
        tasks: allTasks.slice(0, 20), // Limit to 20 tasks
        topics: allTopics,
        sentiment: sentiment,
        outline: [], // Not available in basic API
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
      
      console.log('   ✅ Meeting inserted with ULTIMATE data!')
      console.log(`   📊 Duration: ${durationMinutes}min`)
      console.log(`   👥 Participants: ${Object.keys(participantAnalysis.speakerStats).length}`)
      console.log(`   🎭 Sentiment: ${sentiment}`)
      console.log(`   ❓ Questions extracted: ${allQuestions.length}`)
      console.log(`   ✅ Tasks extracted: ${allTasks.length}`)
      console.log(`   🏷️  Topics: ${allTopics.length}`)
      console.log(`   💬 Transcript sentences: ${participantAnalysis.totalSentences}`)
      
      newMeetings++
    }
    
    console.log('\n🎉 ULTIMATE FIREFLIES SYNC COMPLETED!')
    console.log('='.repeat(80))
    console.log(`📊 Total meetings processed: ${meetings.length}`)
    console.log(`✨ New meetings added with comprehensive data: ${newMeetings}`)
    
    if (newMeetings > 0) {
      console.log('\n🏆 SUCCESS: Ultimate Fireflies sync is extracting maximum data!')
      console.log('📈 Data extracted includes:')
      console.log('   - Comprehensive participant analysis')
      console.log('   - Speaking time distribution')
      console.log('   - Sentiment analysis by participant')
      console.log('   - Questions and action items extraction')
      console.log('   - Speaker interaction patterns')
      console.log('   - Enhanced tagging and metadata')
      console.log('\n🔄 Ready to sync ALL meetings with this comprehensive approach!')
    }
    
  } catch (error) {
    console.error('❌ Ultimate sync failed:', error.message)
    console.error('Full error:', error)
  }
}

// Add crypto polyfill for UUID generation
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto
}

ultimateFirefliesSync() 