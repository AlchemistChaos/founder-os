-- Complete AI Insights Setup for Supabase
-- Run this entire file in Supabase SQL Editor

-- Step 1: Create exec_sql function for future programmatic operations
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Step 2: Create version function for diagnostics
CREATE OR REPLACE FUNCTION public.version()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT version();
$$;

GRANT EXECUTE ON FUNCTION public.version() TO service_role;

-- Step 3: Create ai_insights table
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

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_meeting_id ON public.ai_insights(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_is_flashcard ON public.ai_insights(is_flashcard);
CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON public.ai_insights(priority);
CREATE INDEX IF NOT EXISTS idx_ai_insights_goal_overall_score ON public.ai_insights(goal_overall_score);
CREATE INDEX IF NOT EXISTS idx_ai_insights_generated_at ON public.ai_insights(insight_generated_at);

-- Step 5: Enable Row Level Security
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can insert their own insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can update their own insights" ON public.ai_insights;

-- Policy for viewing insights (join through meetings table to check ownership)
CREATE POLICY "Users can view their own insights" ON public.ai_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = ai_insights.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

-- Policy for inserting insights
CREATE POLICY "Users can insert their own insights" ON public.ai_insights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = ai_insights.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

-- Policy for updating insights
CREATE POLICY "Users can update their own insights" ON public.ai_insights
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = ai_insights.meeting_id 
      AND meetings.user_id = auth.uid()
    )
  );

-- Step 7: Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS update_ai_insights_updated_at ON public.ai_insights;

CREATE TRIGGER update_ai_insights_updated_at 
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Grant permissions to service role (for API operations)
GRANT ALL ON public.ai_insights TO service_role;
GRANT ALL ON public.ai_insights TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Step 9: Create test function to verify everything works
CREATE OR REPLACE FUNCTION public.test_ai_insights_setup()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_exists boolean;
    policy_count integer;
    index_count integer;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_insights'
    ) INTO table_exists;
    
    -- Count policies
    SELECT COUNT(*) FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_insights' 
    INTO policy_count;
    
    -- Count indexes
    SELECT COUNT(*) FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_insights' 
    INTO index_count;
    
    RETURN format(
        'AI Insights Setup Complete! Table exists: %s, Policies: %s, Indexes: %s', 
        table_exists, policy_count, index_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_ai_insights_setup() TO service_role; 