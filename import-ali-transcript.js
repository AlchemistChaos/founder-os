const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const FIREFLIES_API_KEY = process.env.FIREFLIES_API_KEY;

async function importAliTranscript() {
  console.log('🔥 Importing Ali meeting transcript from Fireflies...\n');

  try {
    // Ali meeting details
    const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';
    const aliFirefliesId = '01JX339738K54YB43E0F183H0F';

    console.log('📋 Meeting Details:');
    console.log(`   Supabase ID: ${aliMeetingId}`);
    console.log(`   Fireflies ID: ${aliFirefliesId}`);

    // Check if meeting exists in database
    console.log('\n1️⃣ Checking meeting in database...');
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', aliMeetingId)
      .single();

    if (meetingError || !meeting) {
      console.log('❌ Ali meeting not found in database:', meetingError?.message);
      return;
    }

    console.log('✅ Found Ali meeting in database:');
    console.log(`   Title: ${meeting.title}`);
    console.log(`   Fireflies ID: ${meeting.fireflies_id}`);

    // Check if transcript already exists
    console.log('\n2️⃣ Checking existing transcript...');
    const { data: existingTranscript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', aliMeetingId)
      .limit(1);

    if (transcriptError) {
      console.log('❌ Error checking transcript:', transcriptError.message);
      return;
    }

    if (existingTranscript && existingTranscript.length > 0) {
      console.log('⚠️ Transcript already exists. Skipping import.');
      console.log(`   Found ${existingTranscript.length} existing segments`);
      return;
    }

    console.log('✅ No existing transcript found. Proceeding with import...');

    // Get transcript from Fireflies API
    console.log('\n3️⃣ Fetching transcript from Fireflies API...');
    
    if (!FIREFLIES_API_KEY) {
      console.log('❌ Missing FIREFLIES_API_KEY environment variable');
      return;
    }

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
      variables: {
        transcriptId: aliFirefliesId
      }
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
      console.log('❌ Fireflies API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Response:', errorText);
      return;
    }

    const data = await response.json();

    if (data.errors) {
      console.log('❌ GraphQL errors:', data.errors);
      return;
    }

    const transcript = data.data?.transcript;
    if (!transcript || !transcript.sentences) {
      console.log('❌ No transcript data found for Ali meeting');
      return;
    }

    console.log('✅ Fireflies API success!');
    console.log(`   Title: ${transcript.title}`);
    console.log(`   Sentences: ${transcript.sentences.length}`);

    // Check meeting_transcripts table schema first
    console.log('\n4️⃣ Checking meeting_transcripts table schema...');
    
    // Try to get the schema by attempting a simple select
    const { data: schemaTest, error: schemaError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .limit(1);

    if (schemaError && schemaError.code === '42P01') {
      console.log('❌ meeting_transcripts table does not exist');
      console.log('💡 Creating meeting_transcripts table...');
      
      // Create the table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.meeting_transcripts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          sentence_index INTEGER NOT NULL,
          start_time NUMERIC,
          end_time NUMERIC,
          text TEXT NOT NULL,
          speaker_name TEXT,
          speaker_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_meeting_id ON public.meeting_transcripts(meeting_id);
        CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_start_time ON public.meeting_transcripts(start_time);
        
        ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view transcripts for their meetings" ON public.meeting_transcripts
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM meetings 
              WHERE meetings.id = meeting_transcripts.meeting_id 
              AND meetings.user_id = auth.uid()
            )
          );
      `;

      const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      if (createError) {
        console.log('❌ Could not create meeting_transcripts table:', createError.message);
        return;
      }
      console.log('✅ meeting_transcripts table created successfully');
    } else {
      console.log('✅ meeting_transcripts table exists');
    }

    // Prepare transcript data for insert
    console.log('\n5️⃣ Preparing transcript data...');
    
    const transcriptData = transcript.sentences.map(sentence => ({
      meeting_id: aliMeetingId,
      speaker_name: sentence.speaker_name || 'Unknown',
      text_content: sentence.text,
      start_time_seconds: Math.round(sentence.start_time || 0),
      end_time_seconds: Math.round(sentence.end_time || 0)
    }));

    console.log(`📊 Prepared ${transcriptData.length} transcript segments`);

    // Insert transcript data in batches
    console.log('\n6️⃣ Inserting transcript data...');
    
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < transcriptData.length; i += batchSize) {
      const batch = transcriptData.slice(i, i + batchSize);
      
      const { error: batchError } = await supabase
        .from('meeting_transcripts')
        .insert(batch);

      if (batchError) {
        console.log(`❌ Error inserting batch ${i}-${i + batch.length}:`, batchError.message);
        break;
      }

      insertedCount += batch.length;
      console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedCount}/${transcriptData.length} segments`);
    }

    if (insertedCount === transcriptData.length) {
      console.log('✅ All transcript data inserted successfully!');
    } else {
      console.log(`⚠️ Partial success: ${insertedCount}/${transcriptData.length} segments inserted`);
    }

    // Verify the import
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
      console.log(`✅ Verification successful: ${verifyData.length} segments retrieved`);
      if (verifyData.length > 0) {
        console.log('Sample transcript segment:');
        console.log(`   Speaker: ${verifyData[0].speaker_name}`);
        console.log(`   Text: ${verifyData[0].text_content.substring(0, 100)}...`);
        console.log(`   Time: ${verifyData[0].start_time_seconds}s - ${verifyData[0].end_time_seconds}s`);
      }
    }

    console.log('\n🎉 Ali transcript import complete!');
    console.log(`✅ Imported ${insertedCount} transcript segments`);
    console.log('🚀 Ready to run: node process-ali-with-20-threshold.js');

  } catch (error) {
    console.error('❌ Import error:', error);
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

if (!FIREFLIES_API_KEY) {
  console.error('❌ Missing FIREFLIES_API_KEY environment variable');
  process.exit(1);
}

importAliTranscript(); 