const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTranscriptSchema() {
  console.log('🔍 Checking meeting_transcripts table schema...\n');

  try {
    // Check if table exists and get sample data
    console.log('1️⃣ Checking table existence and sample data...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.log('❌ Error accessing meeting_transcripts:', sampleError.message);
      console.log('   Code:', sampleError.code);
      return;
    }

    if (!sampleData || sampleData.length === 0) {
      console.log('⚠️ meeting_transcripts table exists but is empty');
      console.log('💡 This explains why Ali meeting has no transcript');
      return;
    }

    console.log(`✅ Found ${sampleData.length} sample records`);
    console.log('\n2️⃣ Actual table schema (column names):');
    
    const columns = Object.keys(sampleData[0]);
    columns.forEach((col, i) => {
      console.log(`   ${i+1}. ${col}`);
    });

    console.log('\n3️⃣ Sample data structure:');
    console.log(JSON.stringify(sampleData[0], null, 2));

    // Check specifically for Ali meeting
    console.log('\n4️⃣ Checking Ali meeting transcript...');
    const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';
    
    const { data: aliTranscript, error: aliError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', aliMeetingId);

    if (aliError) {
      console.log('❌ Error checking Ali transcript:', aliError.message);
    } else {
      console.log(`📊 Ali meeting has ${aliTranscript.length} transcript segments`);
      if (aliTranscript.length > 0) {
        console.log('✅ Sample Ali transcript:');
        console.log(JSON.stringify(aliTranscript[0], null, 2));
      }
    }

    // Check all meetings with transcripts
    console.log('\n5️⃣ Meetings with transcript data...');
    const { data: meetingsWithTranscripts, error: meetingsError } = await supabase
      .from('meeting_transcripts')
      .select('meeting_id')
      .limit(10);

    if (meetingsError) {
      console.log('❌ Error getting meetings:', meetingsError.message);
    } else {
      const uniqueMeetings = [...new Set(meetingsWithTranscripts.map(t => t.meeting_id))];
      console.log(`📋 Found transcripts for ${uniqueMeetings.length} meetings:`);
      uniqueMeetings.slice(0, 5).forEach((id, i) => {
        console.log(`   ${i+1}. ${id}`);
      });
    }

    // Suggest column mapping
    console.log('\n6️⃣ Column mapping suggestions:');
    const expectedColumns = [
      'sentence_start_time',
      'sentence_text', 
      'speaker_name',
      'meeting_id'
    ];

    expectedColumns.forEach(expected => {
      const found = columns.find(col => 
        col.toLowerCase().includes(expected.toLowerCase().replace('sentence_', '')) ||
        col.toLowerCase().includes(expected.toLowerCase())
      );
      
      if (found) {
        console.log(`   ✅ ${expected} → ${found}`);
      } else {
        console.log(`   ❌ ${expected} → NOT FOUND`);
      }
    });

  } catch (error) {
    console.error('❌ Error checking schema:', error);
  }
}

checkTranscriptSchema(); 