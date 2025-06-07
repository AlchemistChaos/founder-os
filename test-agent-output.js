require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { extractLearningInsights } = require('./src/lib/openai')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testAgentOutput() {
  console.log('🧪 Testing what Agent 1 actually generates...')
  
  // Get transcript sample
  const { data: transcriptData, error: transcriptError } = await supabase
    .from('meeting_transcripts')
    .select('sentence')
    .eq('meeting_id', 'cf2f64db-4648-43ee-afb2-5acf32767888')
    .order('sentence_index')
    .limit(100)
  
  if (transcriptError) {
    console.error('Error getting transcript:', transcriptError)
    return
  }
  
  const sampleContent = transcriptData.map(t => t.sentence).join(' ')
  console.log('📝 Sample content length:', sampleContent.length)
  
  try {
    const insights = await extractLearningInsights(sampleContent)
    
    console.log('\n🔍 AGENT 1 OUTPUT:')
    console.log('='.repeat(50))
    
    insights.forEach((insight, i) => {
      console.log(`\n${i+1}. ${insight.text}`)
      console.log(`Context: ${insight.context?.substring(0, 100)}...`)
      console.log(`How to Implement: ${insight.how_to_implement?.substring(0, 200)}...`)
      console.log(`Structure looks like steps: ${insight.how_to_implement?.includes('1.') && insight.how_to_implement?.includes('2.') ? 'YES ✅' : 'NO ❌'}`)
    })
    
  } catch (error) {
    console.error('Error testing agent:', error)
  }
}

testAgentOutput() 