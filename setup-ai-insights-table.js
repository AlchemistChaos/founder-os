const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAiInsightsTable() {
  try {
    console.log('🏗️ Setting up ai_insights table for 3-agent pipeline...\n');

    // Check if table already exists first
    const { data: existingTable, error: checkError } = await supabase
      .from('ai_insights')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ ai_insights table already exists!');
      console.log('🧪 Testing table functionality...');
    } else if (checkError.code === '42P01') {
      console.log('📝 Creating ai_insights table...');
      
      // Execute the table creation SQL
      const { data, error: createError } = await supabase.rpc('create_ai_insights_table');
      
      if (createError) {
        console.log('❌ Error creating table with RPC, trying direct SQL execution...');
        
        // Try creating table with individual SQL commands
        try {
          // First, create the table
          const tableSQL = `
            CREATE TABLE IF NOT EXISTS ai_insights (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
              meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
              
              -- Core insight content
              insight_text TEXT NOT NULL,
              context TEXT,
              category TEXT NOT NULL,
              relevance TEXT,
              
              -- AI analysis metadata
              reaction BOOLEAN DEFAULT FALSE,
              interest_level TEXT,
              priority TEXT NOT NULL,
              priority_reason TEXT,
              
              -- Goal alignment scores (0-10 each)
              goal_creator_brand INTEGER DEFAULT 0,
              goal_pulse_startup INTEGER DEFAULT 0, 
              goal_data_driven INTEGER DEFAULT 0,
              goal_learning_secrets INTEGER DEFAULT 0,
              goal_overall_score INTEGER DEFAULT 0,
              
              -- Flashcard tracking
              is_flashcard BOOLEAN DEFAULT FALSE,
              flashcard_id UUID REFERENCES flashcards(id) ON DELETE SET NULL,
              flashcard_created_at TIMESTAMP WITH TIME ZONE,
              
              -- Timestamps and metadata
              insight_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `;
          
          const { error: tableError } = await supabase.rpc('exec_sql', { sql: tableSQL });
          if (tableError) throw tableError;
          console.log('✅ Created ai_insights table');

          // Create indexes
          const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);',
            'CREATE INDEX IF NOT EXISTS idx_ai_insights_meeting_id ON ai_insights(meeting_id);',
            'CREATE INDEX IF NOT EXISTS idx_ai_insights_is_flashcard ON ai_insights(is_flashcard);',
            'CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON ai_insights(priority);',
            'CREATE INDEX IF NOT EXISTS idx_ai_insights_goal_overall_score ON ai_insights(goal_overall_score);',
            'CREATE INDEX IF NOT EXISTS idx_ai_insights_generated_at ON ai_insights(insight_generated_at);'
          ];
          
          for (const indexSQL of indexes) {
            const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSQL });
            if (indexError) throw indexError;
          }
          console.log('✅ Created indexes');

          // Enable RLS
          const { error: rlsError } = await supabase.rpc('exec_sql', { 
            sql: 'ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;' 
          });
          if (rlsError) throw rlsError;
          console.log('✅ Enabled Row Level Security');

          console.log('🎉 Successfully created ai_insights table!');
          
        } catch (directError) {
          console.log('❌ Could not create table directly either:', directError);
          console.log('\nℹ️ You may need to run this SQL manually in Supabase Dashboard:');
          console.log('\n' + '='.repeat(50));
          const sqlFile = path.join(__dirname, 'ai-insights-table.sql');
          const sqlContent = fs.readFileSync(sqlFile, 'utf8');
          console.log(sqlContent);
          console.log('='.repeat(50));
          return;
        }
      } else {
        console.log('✅ Successfully created ai_insights table with RPC!');
      }
    } else {
      console.log('❌ Unexpected error checking table:', checkError);
      return;
    }

    // Test table functionality
    const testUserId = '04d47b62-bba7-4526-a0f6-42ba34999de1'; // Ali meeting user
    const testMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888'; // Ali meeting
    
    console.log('🧪 Testing table with sample data...');
    
    // Test insert
    const { data: insertData, error: insertError } = await supabase
      .from('ai_insights')
      .insert({
        user_id: testUserId,
        meeting_id: testMeetingId,
        insight_text: 'Test: Data-driven YouTube Strategy',
        context: 'Ali Sheikh explained how to use Google Ads to test thumbnail variations before creating videos.',
        category: 'high-priority',
        relevance: 'This helps validate video concepts before investing time in production.',
        reaction: false,
        interest_level: 'high',
        priority: 'high',
        priority_reason: 'Directly applicable to creator brand growth with proven ROI methodology.',
        goal_creator_brand: 9,
        goal_pulse_startup: 6,
        goal_data_driven: 10,
        goal_learning_secrets: 8,
        goal_overall_score: 33 // 9+6+10+8
      })
      .select('id')
      .single();

    if (insertError) {
      console.log('❌ Error testing insert:', insertError);
      return;
    }

    console.log('✅ Successfully inserted test insight:', insertData.id);

    // Test query
    const { data: queryData, error: queryError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('id', insertData.id)
      .single();

    if (queryError) {
      console.log('❌ Error testing query:', queryError);
      return;
    }

    console.log('✅ Successfully queried test insight:');
    console.log(`   Text: ${queryData.insight_text}`);
    console.log(`   Goal Score: ${queryData.goal_overall_score}/40`);
    console.log(`   Priority: ${queryData.priority}`);
    console.log(`   Category: ${queryData.category}`);

    // Test update
    const { error: updateError } = await supabase
      .from('ai_insights')
      .update({
        is_flashcard: true,
        flashcard_created_at: new Date().toISOString()
      })
      .eq('id', insertData.id);

    if (updateError) {
      console.log('❌ Error testing update:', updateError);
      return;
    }

    console.log('✅ Successfully updated flashcard status');

    // Clean up test data
    const { error: deleteError } = await supabase
      .from('ai_insights')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.log('⚠️ Warning: Could not clean up test data:', deleteError);
    } else {
      console.log('🧹 Cleaned up test data');
    }

    // Check for existing insights for Ali meeting
    console.log('\n🔍 Checking for existing insights...');
    const { data: existingInsights, error: existingError } = await supabase
      .from('ai_insights')
      .select('id, insight_text, goal_overall_score, priority')
      .eq('meeting_id', testMeetingId)
      .order('goal_overall_score', { ascending: false });

    if (existingError) {
      console.log('❌ Error checking existing insights:', existingError);
    } else {
      console.log(`📊 Found ${existingInsights.length} existing insights for Ali meeting:`);
      existingInsights.forEach((insight, i) => {
        console.log(`   ${i+1}. ${insight.insight_text.substring(0, 60)}... (Score: ${insight.goal_overall_score}, Priority: ${insight.priority})`);
      });
    }

    console.log('\n🎉 ai_insights table setup complete!');
    console.log('✅ Table is ready for 3-agent pipeline');
    console.log('🎯 Flashcard threshold: 20/40 (will be updated in API code)');

  } catch (error) {
    console.error('❌ Error setting up ai_insights table:', error);
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

setupAiInsightsTable(); 