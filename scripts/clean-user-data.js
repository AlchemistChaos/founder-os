require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = '04d47b62-bba7-4526-a0f6-42ba34999de1' // Your user ID

async function cleanUserData() {
  console.log('🗑️  CLEANING USER DATA FOR TESTING')
  console.log('=====================================')
  console.log(`User ID: ${USER_ID}`)
  
  try {
    // First, let's see what data exists
    console.log('\n📊 CHECKING EXISTING DATA...')
    
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, meeting_date')
      .eq('user_id', USER_ID)
      .order('meeting_date', { ascending: false })
    
    const { data: flashcards } = await supabase
      .from('flashcards')
      .select('id, question')
      .eq('user_id', USER_ID)
    
    const { data: entries } = await supabase
      .from('entries')
      .select('id, type, content')
      .eq('user_id', USER_ID)
    
    console.log(`📅 Meetings: ${meetings?.length || 0}`)
    console.log(`🃏 Flashcards: ${flashcards?.length || 0}`)
    console.log(`📝 Entries: ${entries?.length || 0}`)
    
    if ((meetings?.length || 0) === 0) {
      console.log('\n✅ No data found to delete!')
      return
    }
    
    console.log('\n🚨 WARNING: This will delete ALL your data!')
    console.log('This includes:')
    console.log('- All meetings and transcripts')
    console.log('- All flashcards')
    console.log('- All entries')
    console.log('- All meeting insights')
    console.log('- All meeting participants')
    
    // In a real scenario, you'd want user confirmation here
    // For now, proceeding with deletion for testing
    
    console.log('\n🗑️  DELETING DATA...')
    
    // Delete in correct order to respect foreign key constraints
    
    // 1. Delete flashcards first
    if (flashcards?.length > 0) {
      const { error: flashcardsError } = await supabase
        .from('flashcards')
        .delete()
        .eq('user_id', USER_ID)
      
      if (flashcardsError) {
        console.error('Error deleting flashcards:', flashcardsError)
      } else {
        console.log(`✅ Deleted ${flashcards.length} flashcards`)
      }
    }
    
    // 2. Delete entries
    if (entries?.length > 0) {
      const { error: entriesError } = await supabase
        .from('entries')
        .delete()
        .eq('user_id', USER_ID)
      
      if (entriesError) {
        console.error('Error deleting entries:', entriesError)
      } else {
        console.log(`✅ Deleted ${entries.length} entries`)
      }
    }
    
    // 3. Delete meeting-related data
    if (meetings?.length > 0) {
      const meetingIds = meetings.map(m => m.id)
      
      // Delete meeting insights
      const { error: insightsError } = await supabase
        .from('meeting_insights')
        .delete()
        .in('meeting_id', meetingIds)
      
      if (insightsError) {
        console.error('Error deleting meeting insights:', insightsError)
      } else {
        console.log('✅ Deleted meeting insights')
      }
      
      // Delete meeting transcripts
      const { error: transcriptsError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .in('meeting_id', meetingIds)
      
      if (transcriptsError) {
        console.error('Error deleting meeting transcripts:', transcriptsError)
      } else {
        console.log('✅ Deleted meeting transcripts')
      }
      
      // Delete meeting participants
      const { error: participantsError } = await supabase
        .from('meeting_participants')
        .delete()
        .in('meeting_id', meetingIds)
      
      if (participantsError) {
        console.error('Error deleting meeting participants:', participantsError)
      } else {
        console.log('✅ Deleted meeting participants')
      }
      
      // Finally, delete meetings
      const { error: meetingsError } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', USER_ID)
      
      if (meetingsError) {
        console.error('Error deleting meetings:', meetingsError)
      } else {
        console.log(`✅ Deleted ${meetings.length} meetings`)
      }
    }
    
    console.log('\n🎉 DATA CLEANUP COMPLETE!')
    console.log('Ready for fresh sync and testing.')
    
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}

// Only run if called directly
if (require.main === module) {
  cleanUserData()
}

module.exports = { cleanUserData } 