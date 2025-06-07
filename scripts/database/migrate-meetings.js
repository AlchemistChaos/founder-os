const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function migrateMeetings() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  console.log('🔄 Migrating meetings to correct user...')

  try {
    // Find the test user who has the meetings
    const { data: users } = await supabase.auth.admin.listUsers()
    const testUser = users?.users.find(u => u.email === 'test@example.com')
    
    if (!testUser) {
      console.log('❌ Test user not found')
      return
    }

    console.log(`📋 Found test user: ${testUser.id}`)

    // Get meetings from test user
    const { data: meetings } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', testUser.id)

    console.log(`Found ${meetings?.length || 0} meetings to migrate`)

    if (!meetings || meetings.length === 0) {
      console.log('No meetings to migrate')
      return
    }

    // Create the mock user that the API expects
    const mockUserId = '550e8400-e29b-41d4-a716-446655440000'
    
    console.log('👤 Creating mock user for API...')
    const { error: userError } = await supabase.auth.admin.createUser({
      email: 'mock@example.com',
      password: 'mock123456',
      user_id: mockUserId,
      email_confirm: true
    })

    if (userError && !userError.message.includes('already been registered')) {
      console.log('❌ Error creating mock user:', userError.message)
      return
    }
    console.log('✅ Mock user ready')
    
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ user_id: mockUserId })
      .eq('user_id', testUser.id)

    if (updateError) {
      console.log('❌ Error updating meetings:', updateError.message)
      return
    }

    console.log('✅ Meetings updated')

    // Also update participants
    const { error: participantsError } = await supabase
      .from('meeting_participants')
      .update({ user_id: mockUserId })
      .in('meeting_id', meetings.map(m => m.id))

    if (participantsError) {
      console.log('⚠️  Error updating participants:', participantsError.message)
    } else {
      console.log('✅ Participants updated')
    }

    // Update entries if any exist
    const { error: entriesError } = await supabase
      .from('entries')
      .update({ user_id: mockUserId })
      .eq('user_id', testUser.id)
      .eq('type', 'meeting')

    if (entriesError) {
      console.log('⚠️  Error updating entries:', entriesError.message)
    } else {
      console.log('✅ Entries updated')
    }

    // Update integration
    const { error: integrationError } = await supabase
      .from('integrations')
      .update({ user_id: mockUserId })
      .eq('user_id', testUser.id)

    if (integrationError) {
      console.log('⚠️  Error updating integration:', integrationError.message)
    } else {
      console.log('✅ Integration updated')
    }

    console.log('🎉 Migration complete!')
    
    // Verify
    const { data: migratedMeetings } = await supabase
      .from('meetings')
      .select('id, title, meeting_date')
      .eq('user_id', mockUserId)
      .order('meeting_date', { ascending: false })
      .limit(5)

    console.log('\n📊 Verification:')
    console.log(`Meetings now under user ${mockUserId}:`, migratedMeetings?.length || 0)
    
    if (migratedMeetings && migratedMeetings.length > 0) {
      console.log('Sample meetings:')
      migratedMeetings.forEach(m => {
        console.log(`- ${m.title} (${new Date(m.meeting_date).toLocaleDateString()})`)
      })
    }

  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

migrateMeetings() 