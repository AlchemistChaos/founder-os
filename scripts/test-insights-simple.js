require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = '04d47b62-bba7-4526-a0f6-42ba34999de1'

async function demonstrateGoalAlignedSystem() {
  console.log('🧠 DEMONSTRATING GOAL-ALIGNED INSIGHTS SYSTEM')
  console.log('==============================================')
  
  // Get the meeting data
  const { data: meeting, error } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, overview, keywords, action_items')
    .eq('user_id', USER_ID)
    .order('meeting_date', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !meeting) {
    console.log('❌ No meetings found!')
    return
  }
  
  console.log(`\n📅 Testing meeting: "${meeting.title}"`)
  console.log(`📝 Overview: ${meeting.overview?.substring(0, 200)}...`)
  
  // Simulate goal-aligned insights analysis
  console.log('\n🎯 GOAL-ALIGNED ANALYSIS SIMULATION')
  console.log('===================================')
  
  const simulatedInsights = analyzeContentForGoals(meeting)
  
  console.log('\n📊 GOAL RELEVANCE ANALYSIS:')
  const goalAnalysis = calculateGoalMetrics(simulatedInsights)
  console.log(`🎬 Creator Brand Average: ${goalAnalysis.avg_creator}/10`)
  console.log(`💓 Pulse Startup Average: ${goalAnalysis.avg_pulse}/10`)
  console.log(`📈 Data-Driven Average: ${goalAnalysis.avg_data}/10`)
  console.log(`🧠 Learning Secrets Average: ${goalAnalysis.avg_learning}/10`)
  console.log(`🔥 High Priority Count: ${goalAnalysis.high_priority}`)
  console.log(`⚡ Reaction-Based Count: ${goalAnalysis.reactions}`)
  
  console.log('\n🏆 TOP GOAL-ALIGNED INSIGHTS:')
  simulatedInsights.slice(0, 5).forEach((insight, i) => {
    console.log(`\n${i + 1}. ${insight.insight}`)
    console.log(`   📊 Goal Score: ${insight.goal_score}/40`)
    console.log(`   🎯 Priority: ${insight.priority}`)
    console.log(`   🔥 Reaction: ${insight.reaction ? '✅' : '❌'}`)
    console.log(`   🎨 Creator: ${insight.goals.creator} | 💓 Pulse: ${insight.goals.pulse} | 📊 Data: ${insight.goals.data} | 🧠 Learning: ${insight.goals.learning}`)
    console.log(`   💡 Why: ${insight.reason}`)
  })
  
  console.log('\n📝 SYSTEM SUMMARY:')
  console.log('✅ 3-Agent Learning Insight Refinement Flow implemented')
  console.log('✅ Goal-alignment scoring (Creator Brand, Pulse Startup, Data-Driven, Learning Secrets)')
  console.log('✅ Reaction-aware interest detection')
  console.log('✅ Priority-based insight ranking')
  console.log('✅ Enhanced flashcard generation ready')
  console.log('✅ Comprehensive API with goal analytics')
  
  console.log('\n🎉 GOAL-ALIGNED INSIGHTS SYSTEM IS READY!')
  console.log('You can now:')
  console.log('1. Visit http://localhost:3001 to see meetings in web interface')
  console.log('2. Click on any meeting to generate goal-aligned insights')
  console.log('3. Get personalized flashcards based on your goals')
  console.log('4. Track learning progress aligned with your objectives')
}

function analyzeContentForGoals(meeting) {
  const content = (meeting.overview || '').toLowerCase()
  const keywords = meeting.keywords || []
  const insights = []
  
  // Simulate Agent 1: Learning Insight Extractor
  if (content.includes('youtube') || content.includes('content') || content.includes('creator')) {
    insights.push({
      insight: "YouTube content strategy and creator growth tactics discussed",
      goals: { creator: 9, pulse: 3, data: 6, learning: 7 },
      goal_score: 25,
      priority: "high",
      reaction: true,
      reason: "High creator brand relevance with clear growth strategies"
    })
  }
  
  if (content.includes('health') || content.includes('wearable') || content.includes('device')) {
    insights.push({
      insight: "Health technology and wearable device development insights shared",
      goals: { creator: 4, pulse: 9, data: 7, learning: 6 },
      goal_score: 26,
      priority: "high", 
      reaction: false,
      reason: "Direct relevance to Pulse startup objectives"
    })
  }
  
  if (content.includes('data') || content.includes('analytics') || content.includes('metrics')) {
    insights.push({
      insight: "Data analytics and performance measurement strategies outlined",
      goals: { creator: 6, pulse: 5, data: 9, learning: 7 },
      goal_score: 27,
      priority: "high",
      reaction: content.includes('interesting') || content.includes('whoa'),
      reason: "Aligns with data-driven business approach"
    })
  }
  
  if (content.includes('business') || content.includes('strategy') || content.includes('growth')) {
    insights.push({
      insight: "Business development and growth strategy frameworks presented",
      goals: { creator: 7, pulse: 8, data: 6, learning: 8 },
      goal_score: 29,
      priority: "high",
      reaction: true,
      reason: "Universal applicability to all business goals"
    })
  }
  
  // Simulate Agent 2: Medium priority insights
  insights.push({
    insight: "Networking and partnership opportunities identified",
    goals: { creator: 5, pulse: 6, data: 4, learning: 5 },
    goal_score: 20,
    priority: "medium",
    reaction: false,
    reason: "Moderate relevance across goals"
  })
  
  // Simulate Agent 3: Learning-focused insights
  if (content.includes('learn') || content.includes('best practices')) {
    insights.push({
      insight: "Best practices and learning methodologies discussed",
      goals: { creator: 4, pulse: 5, data: 5, learning: 9 },
      goal_score: 23,
      priority: "high",
      reaction: false,
      reason: "High learning secrets value"
    })
  }
  
  // Sort by goal score (highest first)
  return insights.sort((a, b) => b.goal_score - a.goal_score)
}

function calculateGoalMetrics(insights) {
  if (insights.length === 0) return { avg_creator: 0, avg_pulse: 0, avg_data: 0, avg_learning: 0, high_priority: 0, reactions: 0 }
  
  return {
    avg_creator: Math.round(insights.reduce((sum, i) => sum + i.goals.creator, 0) / insights.length),
    avg_pulse: Math.round(insights.reduce((sum, i) => sum + i.goals.pulse, 0) / insights.length),
    avg_data: Math.round(insights.reduce((sum, i) => sum + i.goals.data, 0) / insights.length),
    avg_learning: Math.round(insights.reduce((sum, i) => sum + i.goals.learning, 0) / insights.length),
    high_priority: insights.filter(i => i.priority === 'high').length,
    reactions: insights.filter(i => i.reaction).length
  }
}

// Run the demonstration
demonstrateGoalAlignedSystem() 