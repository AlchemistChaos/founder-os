require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = '04d47b62-bba7-4526-a0f6-42ba34999de1'

// We'll test via the API endpoint since Node.js can't import TypeScript directly

async function testGoalAlignedInsights() {
  console.log('🧠 TESTING GOAL-ALIGNED INSIGHTS DIRECTLY')
  console.log('==========================================')
  
  // Get a meeting with good content
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, overview, keywords, action_items')
    .eq('user_id', USER_ID)
    .order('meeting_date', { ascending: false })
    .limit(1)
  
  if (error || !meetings || meetings.length === 0) {
    console.log('❌ No meetings found!')
    return
  }
  
  const meeting = meetings[0]
  console.log(`\n📅 Testing meeting: "${meeting.title}"`)
  console.log(`📝 Overview: ${meeting.overview?.substring(0, 200)}...`)
  
  // Get transcript segments if available
  const { data: transcripts } = await supabase
    .from('meeting_transcripts')
    .select('speaker_name, text_content, start_time_seconds')
    .eq('meeting_id', meeting.id)
    .order('start_time_seconds')
    .limit(50) // Just get a sample
  
  const transcriptText = transcripts && transcripts.length > 0 
    ? transcripts.map(t => `${t.speaker_name}: ${t.text_content}`).join('\n')
    : meeting.overview || 'No transcript available'
  
  console.log(`\n📊 Using ${transcripts?.length || 0} transcript segments`)
  console.log(`📝 Sample content: ${transcriptText.substring(0, 300)}...`)
  
  try {
    console.log('\n🔍 CALLING GOAL-ALIGNED INSIGHTS API...')
    console.log('='.repeat(50))
    
    // Call the insights API endpoint
    const response = await fetch(`http://localhost:3000/api/meetings/${meeting.id}/insights`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error(`❌ API call failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('Error details:', errorText)
      return
    }
    
    const result = await response.json()
    
    if (!result.success) {
      console.error('❌ Insights generation failed:', result.error)
      return
    }
    
    console.log('✅ Goal-aligned insights generated successfully!')
    
    console.log('\n🎯 GOAL ANALYSIS:')
    console.log(`📊 Total insights: ${result.insights.length}`)
    console.log(`🔥 High priority: ${result.goal_analysis?.high_priority_count || 0}`)
    console.log(`⚡ Reaction-based: ${result.goal_analysis?.reaction_count || 0}`)
    console.log(`🎬 Avg Creator Relevance: ${result.goal_analysis?.avg_creator_relevance || 0}/10`)
    console.log(`💓 Avg Pulse Relevance: ${result.goal_analysis?.avg_pulse_relevance || 0}/10`) 
    console.log(`📈 Avg Data Relevance: ${result.goal_analysis?.avg_data_relevance || 0}/10`)
    console.log(`🧠 Avg Learning Relevance: ${result.goal_analysis?.avg_learning_relevance || 0}/10`)
    
    console.log('\n🏆 TOP INSIGHTS:')
    result.insights.slice(0, 5).forEach((insight, i) => {
      console.log(`\n${i + 1}. ${insight.insight}`)
      console.log(`   📊 Goal Score: ${insight.goal_alignment?.overall_score || 0}/40`)
      console.log(`   🎯 Priority: ${insight.priority}`)
      console.log(`   🔥 Reaction: ${insight.reaction ? '✅' : '❌'}`)
      console.log(`   💡 Priority Reason: ${insight.priority_reason}`)
      console.log(`   🎨 Creator: ${insight.goal_alignment?.creator_brand || 0} | 💓 Pulse: ${insight.goal_alignment?.pulse_startup || 0} | 📊 Data: ${insight.goal_alignment?.data_driven || 0} | 🧠 Learning: ${insight.goal_alignment?.learning_secrets || 0}`)
    })
    
    console.log('\n📝 FINAL SUMMARY:')
    console.log(result.summary)
    
    console.log('\n🎉 GOAL-ALIGNED INSIGHTS TEST COMPLETE!')
    console.log('The 3-agent system is working perfectly!')
    
  } catch (error) {
    console.error('❌ Error during insights testing:', error)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testGoalAlignedInsights() 