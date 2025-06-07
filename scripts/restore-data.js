require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function restoreData() {
  console.log('🔄 Restoring user and data...')
  console.log('🔗 Using Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('🔑 Service key starts with:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...')
  
  const userId = '04d47b62-bba7-4526-a0f6-42ba34999de1'
  
  // 1. Create/restore user
  console.log('👤 Creating user...')
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: userId,
      email: 'user@example.com',
      name: 'Demo User',
      created_at: new Date().toISOString()
    })
  
  if (userError) {
    console.log('❌ User error:', userError.message)
  } else {
    console.log('✅ User created successfully')
  }
  
  // 2. Check existing data
  const { data: meetings, count, error: meetingsError } = await supabase
    .from('meetings')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
  
  if (meetingsError) {
    console.log('❌ Meetings error:', meetingsError.message)
  } else {
    console.log(`📊 Found ${count} existing meetings for user`)
  }
  
  if (count === 0) {
    console.log('🔗 Database is empty. You need to run Fireflies sync from the UI.')
    console.log('📝 Go to /integrations page and click "Sync Now" button')
  } else {
    console.log('✅ Data already exists')
  }
  
  // 3. Check flashcards
  const { count: flashcardCount, error: flashcardError } = await supabase
    .from('flashcards')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
  
  if (flashcardError) {
    console.log('❌ Flashcards error:', flashcardError.message)
  } else {
    console.log(`🃏 Found ${flashcardCount} flashcards`)
  }
}

restoreData().catch(console.error) 