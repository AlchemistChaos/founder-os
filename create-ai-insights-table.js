const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createAiInsightsTable() {
  try {
    console.log('🏗️ Creating ai_insights table for 3-agent system...\n');

    // Create the ai_insights table with the exact schema from the codebase
    const createTableSQL = `
      -- AI Insights Table for 3-Agent Generated Insights
      CREATE TABLE IF NOT EXISTS public.ai_insights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        
        -- Core insight content
        insight_text TEXT NOT NULL,
        context TEXT, -- Additional context about the insight
        category TEXT NOT NULL DEFAULT 'learning', -- high-priority, medium-priority, learning
        relevance TEXT, -- Why this insight is relevant / how to implement
        
        -- AI analysis metadata
        reaction BOOLEAN DEFAULT FALSE, -- True if this insight generated a user reaction
        interest_level TEXT DEFAULT 'medium', -- high, medium, low
        priority TEXT NOT NULL DEFAULT 'medium', -- high, medium, low
        priority_reason TEXT, -- AI explanation of why this priority was assigned
        
        -- Goal alignment scores (0-10 each)
        goal_creator_brand INTEGER DEFAULT 0,
        goal_pulse_startup INTEGER DEFAULT 0, 
        goal_data_driven INTEGER DEFAULT 0,
        goal_learning_secrets INTEGER DEFAULT 0,
        goal_overall_score INTEGER DEFAULT 0,
        
        -- Flashcard tracking
        is_flashcard BOOLEAN DEFAULT FALSE, -- Has this insight been converted to a flashcard?
        flashcard_id UUID, -- Link to created flashcard
        flashcard_created_at TIMESTAMP WITH TIME ZONE, -- When flashcard was created
        
        -- Timestamps and metadata
        insight_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When AI generated this
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_meeting_id ON public.ai_insights(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_is_flashcard ON public.ai_insights(is_flashcard);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON public.ai_insights(priority);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_goal_scores ON public.ai_insights(goal_overall_score);

      -- Add RLS policies (Row Level Security)
      ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
      
      -- Drop existing policies to avoid conflicts
      DROP POLICY IF EXISTS "Users can view their own insights" ON public.ai_insights;
      DROP POLICY IF EXISTS "Users can insert their own insights" ON public.ai_insights;
      DROP POLICY IF EXISTS "Users can update their own insights" ON public.ai_insights;
      
      -- Policy to allow users to see their own insights (join through meetings table)
      CREATE POLICY "Users can view their own insights" ON public.ai_insights
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM meetings 
            WHERE meetings.id = ai_insights.meeting_id 
            AND meetings.user_id = auth.uid()
          )
        );
      
      -- Policy to allow users to insert their own insights
      CREATE POLICY "Users can insert their own insights" ON public.ai_insights
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM meetings 
            WHERE meetings.id = ai_insights.meeting_id 
            AND meetings.user_id = auth.uid()
          )
        );
      
      -- Policy to allow users to update their own insights
      CREATE POLICY "Users can update their own insights" ON public.ai_insights
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM meetings 
            WHERE meetings.id = ai_insights.meeting_id 
            AND meetings.user_id = auth.uid()
          )
        );

      -- Trigger for updated_at
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON public.ai_insights;
      CREATE TRIGGER update_ai_insights_updated_at 
        BEFORE UPDATE ON public.ai_insights
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log('📝 Executing SQL to create ai_insights table...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });

    if (error) {
      console.log('⚠️ RPC not available, trying alternative approach...');
      console.log('Error:', error);
      
      // Alternative: Try creating table without RPC
      console.log('\n🔧 Attempting direct table creation...');
      const { error: createError } = await supabase
        .from('ai_insights')
        .select('id')
        .limit(1);

      if (createError && createError.code === '42P01') {
        console.log('❌ ai_insights table still does not exist');
        console.log('🔧 Please run this SQL manually in your Supabase SQL Editor:');
        console.log('\n' + createTableSQL);
        return;
      }
    }

    // Test the table
    console.log('\n✅ Testing ai_insights table...');
    const { data: testData, error: testError } = await supabase
      .from('ai_insights')
      .select('*')
      .limit(1);

    if (testError) {
      console.log('❌ Table test failed:', testError);
      console.log('\n📋 SQL to run manually in Supabase:');
      console.log(createTableSQL);
    } else {
      console.log('✅ ai_insights table is ready!');
      console.log('📊 Table structure confirmed');
      
      // Show table info
      const { data: tableTest } = await supabase
        .from('ai_insights')
        .insert({
          user_id: '04d47b62-bba7-4526-a0f6-42ba34999de1', // Test user ID
          meeting_id: 'cf2f64db-4648-43ee-afb2-5acf32767888', // Ali meeting
          insight_text: 'Test insight from AI agents',
          category: 'high-priority',
          relevance: 'Test implementation guide',
          goal_creator_brand: 8,
          goal_pulse_startup: 7,
          goal_data_driven: 9,
          goal_learning_secrets: 8,
          goal_overall_score: 32
        })
        .select('id');
        
      if (tableTest) {
        console.log('✅ Test insert successful!');
        console.log('🎯 ai_insights table is fully operational');
        
        // Clean up test record
        await supabase
          .from('ai_insights')
          .delete()
          .eq('insight_text', 'Test insight from AI agents');
      }
    }

  } catch (error) {
    console.error('❌ Error creating ai_insights table:', error);
    console.log('\n📋 Please run this SQL manually in your Supabase SQL Editor:');
    console.log('\n-- AI Insights Table for 3-Agent Generated Insights');
    console.log(`CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  insight_text TEXT NOT NULL,
  context TEXT,
  category TEXT NOT NULL DEFAULT 'learning',
  relevance TEXT,
  reaction BOOLEAN DEFAULT FALSE,
  interest_level TEXT DEFAULT 'medium',
  priority TEXT NOT NULL DEFAULT 'medium',
  priority_reason TEXT,
  goal_creator_brand INTEGER DEFAULT 0,
  goal_pulse_startup INTEGER DEFAULT 0,
  goal_data_driven INTEGER DEFAULT 0,
  goal_learning_secrets INTEGER DEFAULT 0,
  goal_overall_score INTEGER DEFAULT 0,
  is_flashcard BOOLEAN DEFAULT FALSE,
  flashcard_id UUID,
  flashcard_created_at TIMESTAMP WITH TIME ZONE,
  insight_generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
  }
}

createAiInsightsTable(); 