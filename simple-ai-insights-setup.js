const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAiInsightsTable() {
  try {
    console.log('🚀 Setting up ai_insights table...\n');

    // First, check if table already exists
    console.log('🔍 Checking if ai_insights table exists...');
    const { data: existingTable, error: checkError } = await supabase
      .from('ai_insights')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ ai_insights table already exists!');
      console.log('🧪 Running functionality test...');
      await testTableFunctionality();
      return;
    }

    if (checkError.code !== '42P01') {
      console.log('❌ Unexpected error:', checkError);
      return;
    }

    console.log('❌ ai_insights table does not exist');
    console.log('🏗️ Please create it manually in Supabase SQL Editor:\n');

    const createSQL = `-- AI Insights Table (Copy/paste into Supabase SQL Editor)
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Core insight content
  insight_text TEXT NOT NULL,
  context TEXT,
  category TEXT NOT NULL DEFAULT 'learning',
  relevance TEXT,
  
  -- AI analysis metadata
  reaction BOOLEAN DEFAULT FALSE,
  interest_level TEXT DEFAULT 'medium',
  priority TEXT NOT NULL DEFAULT 'medium',
  priority_reason TEXT,
  
  -- Goal alignment scores (0-10 each)
  goal_creator_brand INTEGER DEFAULT 0,
  goal_pulse_startup INTEGER DEFAULT 0,
  goal_data_driven INTEGER DEFAULT 0,
  goal_learning_secrets INTEGER DEFAULT 0,
  goal_overall_score INTEGER DEFAULT 0,
  
  -- Flashcard tracking
  is_flashcard BOOLEAN DEFAULT FALSE,
  flashcard_id UUID,
  flashcard_created_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  insight_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_meeting_id ON public.ai_insights(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_is_flashcard ON public.ai_insights(is_flashcard);
CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON public.ai_insights(priority);
CREATE INDEX IF NOT EXISTS idx_ai_insights_goal_overall_score ON public.ai_insights(goal_overall_score);

-- RLS Policies
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights" ON public.ai_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = ai_insights.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own insights" ON public.ai_insights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = ai_insights.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own insights" ON public.ai_insights
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = ai_insights.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_insights_updated_at 
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`;

    console.log('='.repeat(80));
    console.log(createSQL);
    console.log('='.repeat(80));

    console.log('\n📝 After running the SQL above, run this script again to test!');
    console.log('💡 Go to: Supabase Dashboard → SQL Editor → New Query → Paste & Run\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testTableFunctionality() {
  try {
    const testUserId = '04d47b62-bba7-4526-a0f6-42ba34999de1'; // Ali meeting user
    const testMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888'; // Ali meeting

    console.log('🧪 Testing table functionality...');

    // Test insert
    const { data: insertData, error: insertError } = await supabase
      .from('ai_insights')
      .insert({
        user_id: testUserId,
        meeting_id: testMeetingId,
        insight_text: 'Test: Data-driven YouTube Strategy',
        context: 'Ali Sheikh explained using Google Ads to test thumbnails before video creation.',
        category: 'high-priority',
        relevance: 'Validates content before time investment - directly applicable.',
        priority: 'high',
        priority_reason: 'Proven ROI methodology for creator brand growth.',
        goal_creator_brand: 9,
        goal_pulse_startup: 6,
        goal_data_driven: 10,
        goal_learning_secrets: 8,
        goal_overall_score: 33
      })
      .select('id')
      .single();

    if (insertError) {
      console.log('❌ Insert test failed:', insertError);
      return;
    }

    console.log('✅ Insert test passed:', insertData.id);

    // Test query
    const { data: queryData, error: queryError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('id', insertData.id)
      .single();

    if (queryError) {
      console.log('❌ Query test failed:', queryError);
      return;
    }

    console.log('✅ Query test passed');
    console.log(`   Text: ${queryData.insight_text}`);
    console.log(`   Score: ${queryData.goal_overall_score}/40`);
    console.log(`   Priority: ${queryData.priority}`);

    // Test update  
    const { error: updateError } = await supabase
      .from('ai_insights')
      .update({ is_flashcard: true, flashcard_created_at: new Date().toISOString() })
      .eq('id', insertData.id);

    if (updateError) {
      console.log('❌ Update test failed:', updateError);
      return;
    }

    console.log('✅ Update test passed');

    // Clean up
    const { error: deleteError } = await supabase
      .from('ai_insights')
      .delete()
      .eq('id', insertData.id);

    if (deleteError) {
      console.log('⚠️ Cleanup failed (non-critical):', deleteError);
    } else {
      console.log('🧹 Cleanup successful');
    }

    // Check existing insights
    console.log('\n🔍 Checking existing Ali meeting insights...');
    const { data: existingInsights, error: existingError } = await supabase
      .from('ai_insights')
      .select('id, insight_text, goal_overall_score, priority')
      .eq('meeting_id', testMeetingId)
      .order('goal_overall_score', { ascending: false });

    if (existingError) {
      console.log('❌ Could not check existing insights:', existingError);
    } else {
      console.log(`📊 Found ${existingInsights.length} existing insights for Ali meeting`);
      existingInsights.forEach((insight, i) => {
        console.log(`   ${i+1}. ${insight.insight_text.substring(0, 50)}... (${insight.goal_overall_score}/40)`);
      });
    }

    console.log('\n🎉 ai_insights table is fully operational!');
    console.log('✅ Ready for 3-agent pipeline');
    console.log('🎯 Threshold: 20/40 for auto-flashcards');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

createAiInsightsTable(); 