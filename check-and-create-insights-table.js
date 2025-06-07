const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndCreateInsightsTable() {
  try {
    console.log('🔍 Checking database tables...\n');

    // 1. Check what tables exist
    console.log('1. Checking existing tables...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');

    if (tablesError) {
      console.log('❌ Error getting tables:', tablesError);
      
      // Alternative method to check tables
      console.log('Trying alternative approach...');
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id')
        .limit(1);
      
      if (!meetingsError) {
        console.log('✅ meetings table exists');
      }

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (!usersError) {
        console.log('✅ users table exists');
      } else {
        console.log('❌ users table missing:', usersError);
      }

      const { data: insights, error: insightsError } = await supabase
        .from('ai_insights')
        .select('id')
        .limit(1);
      
      if (!insightsError) {
        console.log('✅ ai_insights table exists');
      } else {
        console.log('❌ ai_insights table missing:', insightsError.message);
      }
    } else {
      console.log('✅ Available tables:', tables);
    }

    // 2. Create ai_insights table
    console.log('\n2. Creating ai_insights table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.ai_insights (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        meeting_id UUID NOT NULL,
        insight_text TEXT NOT NULL,
        context TEXT,
        category TEXT DEFAULT 'learning',
        relevance TEXT,
        reaction BOOLEAN DEFAULT false,
        interest_level TEXT DEFAULT 'medium',
        priority TEXT DEFAULT 'medium',
        priority_reason TEXT,
        goal_creator_brand INTEGER DEFAULT 0,
        goal_pulse_startup INTEGER DEFAULT 0,
        goal_data_driven INTEGER DEFAULT 0,
        goal_learning_secrets INTEGER DEFAULT 0,
        goal_overall_score INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Add indexes
      CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_meeting_id ON public.ai_insights(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_ai_insights_priority ON public.ai_insights(priority);

      -- Add RLS policies (Row Level Security)
      ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
      
      -- Policy to allow users to see their own insights
      CREATE POLICY IF NOT EXISTS "Users can view their own insights" ON public.ai_insights
        FOR SELECT USING (auth.uid()::text = user_id::text);
      
      -- Policy to allow users to insert their own insights
      CREATE POLICY IF NOT EXISTS "Users can insert their own insights" ON public.ai_insights
        FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
      
      -- Policy to allow users to update their own insights
      CREATE POLICY IF NOT EXISTS "Users can update their own insights" ON public.ai_insights
        FOR UPDATE USING (auth.uid()::text = user_id::text);
    `;

    // Execute the SQL using rpc call
    const { data: createResult, error: createError } = await supabase
      .rpc('exec_sql', { sql: createTableSQL });

    if (createError) {
      console.log('❌ Error creating table via RPC:', createError);
      
      // Try alternative approach with direct SQL
      console.log('Trying direct SQL execution...');
      const { error: directError } = await supabase
        .from('ai_insights')
        .select('id')
        .limit(0);
      
      if (directError && directError.code === '42P01') {
        console.log('Table still doesn\'t exist. Let me create it step by step...');
        
        // Use a simpler CREATE statement without RLS
        const simpleCreateSQL = `
          CREATE TABLE public.ai_insights (
            id SERIAL PRIMARY KEY,
            user_id UUID NOT NULL,
            meeting_id UUID NOT NULL,
            insight_text TEXT NOT NULL,
            context TEXT,
            category TEXT DEFAULT 'learning',
            relevance TEXT,
            reaction BOOLEAN DEFAULT false,
            interest_level TEXT DEFAULT 'medium',
            priority TEXT DEFAULT 'medium',
            priority_reason TEXT,
            goal_creator_brand INTEGER DEFAULT 0,
            goal_pulse_startup INTEGER DEFAULT 0,
            goal_data_driven INTEGER DEFAULT 0,
            goal_learning_secrets INTEGER DEFAULT 0,
            goal_overall_score INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        console.log('Creating with simple SQL...');
        console.log(simpleCreateSQL);
        
      }
    } else {
      console.log('✅ Table creation result:', createResult);
    }

    // 3. Test the table again
    console.log('\n3. Testing ai_insights table access...');
    const { data: testData, error: testError } = await supabase
      .from('ai_insights')
      .select('*')
      .limit(1);

    if (testError) {
      console.log('❌ Table still not accessible:', testError);
    } else {
      console.log('✅ ai_insights table is now accessible');
      console.log('   Sample structure:', Object.keys(testData[0] || {}));
    }

    // 4. Get a real user ID that exists
    console.log('\n4. Finding existing user...');
    const { data: existingUsers, error: userError } = await supabase
      .from('meetings')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(5);

    if (userError) {
      console.log('❌ Error finding users:', userError);
    } else {
      console.log('✅ Found user IDs from meetings:', existingUsers.map(u => u.user_id));
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkAndCreateInsightsTable(); 