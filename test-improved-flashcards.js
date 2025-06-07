require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'

async function testImprovedFlashcards() {
  console.log('🧪 Testing improved flashcard generation...')
  
  try {
    // Clear existing flashcards to test new generation
    console.log('🗑️ Clearing existing flashcards...')
    const { error: deleteError } = await supabase
      .from('flashcards')
      .delete()
      .eq('user_id', userId)
    
    if (deleteError) {
      console.log('❌ Error deleting flashcards:', deleteError)
      return
    }

    // Reset flashcard flags on AI insights
    console.log('🔄 Resetting AI insights flashcard flags...')
    const { error: resetError } = await supabase
      .from('ai_insights')
      .update({ 
        is_flashcard: false, 
        flashcard_id: null,
        flashcard_created_at: null 
      })
      .eq('user_id', userId)
    
    if (resetError) {
      console.log('❌ Error resetting insights:', resetError)
      return
    }

    // Call the improved flashcard generation API
    console.log('🚀 Generating flashcards with improved prompts...')
    const response = await fetch('http://localhost:3000/api/generate-flashcards', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ days: 30 })
    })

    if (!response.ok) {
      console.log('❌ API Error:', response.status, await response.text())
      return
    }

    const result = await response.json()
    console.log('✅ API Response:', result)

    // Check the generated flashcards
    console.log('\n📋 Checking generated flashcards...')
    const { data: newFlashcards, error: fetchError } = await supabase
      .from('flashcards')
      .select('id, question, answer, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (fetchError) {
      console.log('❌ Error fetching flashcards:', fetchError)
      return
    }

    if (!newFlashcards || newFlashcards.length === 0) {
      console.log('⚠️ No flashcards were generated')
      return
    }

    console.log(`\n🎉 Generated ${newFlashcards.length} flashcards with improved questions:`)
    newFlashcards.forEach((card, i) => {
      console.log(`\n${i + 1}. QUESTION: ${card.question}`)
      console.log(`   ANSWER: ${card.answer.substring(0, 100)}...`)
    })

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testImprovedFlashcards().catch(console.error) 