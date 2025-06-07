require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const USER_ID = '04d47b62-bba7-4526-a0f6-42ba34999de1'

async function checkImportedData() {
  console.log('🔍 CHECKING IMPORTED DATA')
  console.log('========================')
  
  // Check meetings
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, title, meeting_date, overview')
    .eq('user_id', USER_ID)
    .order('meeting_date', { ascending: false })
  
  console.log(`📅 Meetings imported: ${meetings?.length || 0}`)
  meetings?.forEach((meeting, i) => {
    console.log(`${i+1}. ${meeting.title} (${meeting.id})`)
  })
  
  if (meetings && meetings.length > 0) {
    const meeting = meetings[0]
    
    // Check transcripts for first meeting
    const { data: transcripts } = await supabase
      .from('meeting_transcripts')
      .select('id, speaker_name, text_content')
      .eq('meeting_id', meeting.id)
      .limit(10)
    
    console.log(`\n📝 Transcript segments for "${meeting.title}": ${transcripts?.length || 0}`)
    transcripts?.slice(0, 3).forEach((t, i) => {
      console.log(`${i+1}. ${t.speaker_name}: ${t.text_content.substring(0, 80)}...`)
    })
    
    // Check participants
    const { data: participants } = await supabase
      .from('meeting_participants')
      .select('name, speaking_time_seconds')
      .eq('meeting_id', meeting.id)
    
    console.log(`\n👥 Participants: ${participants?.length || 0}`)
    participants?.forEach((p, i) => {
      console.log(`${i+1}. ${p.name} (${p.speaking_time_seconds}s)`)
    })
  }
}

checkImportedData() 