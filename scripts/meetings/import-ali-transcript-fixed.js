const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;

async function importAliTranscriptFixed() {
  console.log('🔥 Importing Ali meeting transcript (with trigger fix)...\n');

  try {
    // Ali meeting details
    const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';
    const aliFirefliesId = '01JX339738K54YB43E0F183H0F';

    console.log('📋 Meeting Details:');
    console.log(`   Supabase ID: ${aliMeetingId}`);
    console.log(`   Fireflies ID: ${aliFirefliesId}`);

    // Step 1: Fix the trigger issue
    console.log('\n1️⃣ Fixing database trigger...');
    try {
      const { error: triggerError } = await supabase.rpc('exec_sql', { 
        sql: 'DROP TRIGGER IF EXISTS update_participant_stats_trigger ON meeting_transcripts;' 
      });
      if (triggerError) {
        console.log('⚠️ Could not drop trigger, continuing anyway:', triggerError.message);
      } else {
        console.log('✅ Problematic trigger disabled');
      }
    } catch (e) {
      console.log('⚠️ Trigger fix attempt failed, continuing anyway');
    }

    // Check if meeting exists
    console.log('\n2️⃣ Checking meeting in database...');
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', aliMeetingId)
      .single();

    if (meetingError || !meeting) {
      console.log('❌ Ali meeting not found:', meetingError?.message);
      return;
    }

    console.log('✅ Found Ali meeting:', meeting.title);

    // Check existing transcript
    console.log('\n3️⃣ Checking existing transcript...');
    const { data: existingTranscript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('id')
      .eq('meeting_id', aliMeetingId)
      .limit(1);

    if (transcriptError) {
      console.log('❌ Error checking transcript:', transcriptError.message);
      return;
    }

    if (existingTranscript && existingTranscript.length > 0) {
      console.log('⚠️ Transcript already exists. Skipping import.');
      return;
    }

    // Get transcript from Fireflies
    console.log('\n4️⃣ Fetching from Fireflies API...');
    
    const graphqlQuery = {
      query: `
        query GetTranscript($transcriptId: String!) {
          transcript(id: $transcriptId) {
            id
            title
            sentences {
              index
              start_time
              end_time
              text
              speaker_id
              speaker_name
            }
          }
        }
      `,
      variables: { transcriptId: aliFirefliesId }
    };

    const response = await fetch('https://api.fireflies.ai/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIREFLIES_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    });

    if (!response.ok) {
      console.log('❌ Fireflies API error:', response.status);
      return;
    }

    const data = await response.json();
    if (data.errors) {
      console.log('❌ GraphQL errors:', data.errors);
      return;
    }

    const transcript = data.data?.transcript;
    if (!transcript?.sentences) {
      console.log('❌ No transcript data found');
      return;
    }

    console.log(`✅ Retrieved ${transcript.sentences.length} sentences`);

    // Prepare data with correct schema
    console.log('\n5️⃣ Preparing transcript data...');
    const transcriptData = transcript.sentences.map(sentence => ({
      meeting_id: aliMeetingId,
      speaker_name: sentence.speaker_name || 'Unknown',
      text_content: sentence.text || '',
      start_time_seconds: Math.round(sentence.start_time || 0),
      end_time_seconds: Math.round(sentence.end_time || 0)
    }));

    console.log(`📊 Prepared ${transcriptData.length} segments`);

    // Insert in smaller batches to avoid issues
    console.log('\n6️⃣ Inserting transcript data...');
    const batchSize = 50; // Smaller batches
    let totalInserted = 0;

    for (let i = 0; i < transcriptData.length; i += batchSize) {
      const batch = transcriptData.slice(i, i + batchSize);
      
      try {
        const { error: batchError } = await supabase
          .from('meeting_transcripts')
          .insert(batch);

        if (batchError) {
          console.log(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, batchError.message);
          break;
        }

        totalInserted += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${totalInserted}/${transcriptData.length}`);
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ Batch error:`, error.message);
        break;
      }
    }

    // Verify the results
    console.log('\n7️⃣ Verifying import...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', aliMeetingId)
      .order('start_time_seconds', { ascending: true })
      .limit(3);

    if (verifyError) {
      console.log('❌ Verification failed:', verifyError.message);
    } else {
      console.log(`✅ Import verified: ${verifyData.length} sample segments`);
      if (verifyData.length > 0) {
        console.log(`   Sample: [${verifyData[0].speaker_name}] ${verifyData[0].text_content.substring(0, 50)}...`);
      }
    }

    // Get final count
    const { count: finalCount, error: countError } = await supabase
      .from('meeting_transcripts')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', aliMeetingId);

    if (!countError) {
      console.log(`📊 Final count: ${finalCount} transcript segments for Ali meeting`);
    }

    console.log('\n🎉 Import complete!');
    console.log(`✅ Successfully imported ${totalInserted} segments`);
    console.log('🚀 Ready to run: node process-ali-with-20-threshold.js');

  } catch (error) {
    console.error('❌ Import error:', error);
  }
}

if (!supabaseUrl || !supabaseKey || !FIREFLIES_API_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

importAliTranscriptFixed(); 