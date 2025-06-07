const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  try {
    console.log('🔍 Checking ALL tables in the database to understand AI agent data flow...\n');

    // List of possible table names to check
    const possibleTables = [
      // Meeting-related tables
      'meetings',
      'meeting_participants', 
      'meeting_transcripts',
      'meeting_insights',
      
      // AI-related tables
      'ai_insights',
      'insights',
      'learning_insights',
      'user_insights',
      
      // Content and flashcard tables
      'flashcards',
      'entries',
      'notes',
      'content',
      
      // User and auth tables
      'users',
      'profiles',
      'auth_users',
      
      // Integration tables
      'integrations',
      'sync_logs',
      
      // Goal tracking
      'goals',
      'user_goals',
      
      // Other possible tables
      'analytics',
      'processing_logs',
      'ai_processing',
      'agent_outputs',
      'conversation_analysis'
    ];

    console.log('📋 Testing all possible table names...\n');
    const existingTables = [];
    
    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          existingTables.push(tableName);
          console.log(`✅ ${tableName} - EXISTS`);
          
          if (data && data[0]) {
            const columns = Object.keys(data[0]);
            console.log(`   📋 Columns (${columns.length}): ${columns.join(', ')}`);
            
            // Show sample data for insight-related tables
            if (tableName.includes('insight') || tableName.includes('ai') || tableName.includes('flashcard')) {
              console.log(`   📊 Sample record:`, JSON.stringify(data[0], null, 2).substring(0, 300) + '...');
            }
          } else {
            console.log(`   📋 Empty table - no records yet`);
          }
          console.log('');
        } else if (error.code !== '42P01') {
          console.log(`⚠️ ${tableName} - Error: ${error.message}`);
        }
      } catch (err) {
        // Silent - table doesn't exist
      }
    }

    console.log(`\n🎯 SUMMARY: Found ${existingTables.length} existing tables:`);
    existingTables.forEach(table => console.log(`   • ${table}`));

    // Now let's check specifically for AI processing patterns
    console.log('\n🤖 Checking AI Processing & Insights Flow...\n');

    // Check meetings table for recent AI processing
    console.log('1. Recent meetings with AI processing...');
    const { data: recentMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, overview, keywords, action_items')
      .order('meeting_date', { ascending: false })
      .limit(5);

    if (meetingsError) {
      console.log('❌ Meetings error:', meetingsError);
    } else {
      console.log(`✅ Found ${recentMeetings.length} recent meetings:`);
      recentMeetings.forEach((meeting, i) => {
        console.log(`   ${i+1}. ${meeting.title} (${meeting.meeting_date})`);
        console.log(`      Keywords: ${meeting.keywords?.length || 0} | Actions: ${meeting.action_items?.length || 0}`);
        console.log(`      Overview: ${meeting.overview?.substring(0, 100)}...`);
      });
    }

    // Check ai_insights table specifically
    console.log('\n2. AI Insights table analysis...');
    if (existingTables.includes('ai_insights')) {
      const { data: aiInsights, error: aiError } = await supabase
        .from('ai_insights')
        .select('*')
        .limit(3);

      if (aiError) {
        console.log('❌ AI insights error:', aiError);
      } else {
        console.log(`✅ Found ${aiInsights.length} AI insights:`);
        aiInsights.forEach((insight, i) => {
          console.log(`\n   Insight ${i+1}:`);
          console.log(`   Text: ${insight.insight_text?.substring(0, 80)}...`);
          console.log(`   Priority: ${insight.priority} | Category: ${insight.category}`);
          console.log(`   Goal Scores: Creator(${insight.goal_creator_brand}) Pulse(${insight.goal_pulse_startup}) Data(${insight.goal_data_driven}) Learning(${insight.goal_learning_secrets})`);
          console.log(`   Meeting ID: ${insight.meeting_id}`);
        });
      }
    } else {
      console.log('❌ ai_insights table does not exist');
    }

    // Check meeting_insights table
    console.log('\n3. Meeting Insights table analysis...');
    if (existingTables.includes('meeting_insights')) {
      const { data: meetingInsights, error: miError } = await supabase
        .from('meeting_insights')
        .select('*')
        .limit(3);

      if (miError) {
        console.log('❌ Meeting insights error:', miError);
      } else {
        console.log(`✅ Found ${meetingInsights.length} meeting insights:`);
        meetingInsights.forEach((insight, i) => {
          console.log(`\n   Meeting Insight ${i+1}:`);
          console.log(`   Type: ${insight.insight_type}`);
          console.log(`   Title: ${insight.title}`);
          console.log(`   Description: ${insight.description?.substring(0, 80)}...`);
          console.log(`   Priority: ${insight.priority} | Confidence: ${insight.confidence_score}`);
        });
      }
    }

    // Check flashcards table
    console.log('\n4. Flashcards table analysis...');
    if (existingTables.includes('flashcards')) {
      const { data: flashcards, error: fcError } = await supabase
        .from('flashcards')
        .select('*')
        .limit(3);

      if (fcError) {
        console.log('❌ Flashcards error:', fcError);
      } else {
        console.log(`✅ Found ${flashcards.length} flashcards:`);
        flashcards.forEach((card, i) => {
          console.log(`\n   Flashcard ${i+1}:`);
          if (card.question) console.log(`   Question: ${card.question?.substring(0, 60)}...`);
          if (card.answer) console.log(`   Answer: ${card.answer?.substring(0, 60)}...`);
          console.log(`   Tags: ${card.tags?.join(', ') || 'none'}`);
        });
      }
    }

    // Check for entries table (might be where AI outputs go)
    console.log('\n5. Entries table analysis...');
    if (existingTables.includes('entries')) {
      const { data: entries, error: entriesError } = await supabase
        .from('entries')
        .select('*')
        .eq('type', 'ai-insight')
        .limit(3);

      if (entriesError) {
        console.log('❌ Entries error:', entriesError);
      } else {
        console.log(`✅ Found ${entries.length} AI insight entries:`);
        entries.forEach((entry, i) => {
          console.log(`\n   Entry ${i+1}:`);
          console.log(`   Type: ${entry.type}`);
          console.log(`   Content: ${entry.content?.substring(0, 80)}...`);
          console.log(`   Tags: ${entry.tags?.join(', ') || 'none'}`);
          console.log(`   Is Flashcard: ${entry.is_flashcard}`);
        });
      }
    }

    console.log('\n🎯 AI AGENT DATA FLOW ANALYSIS COMPLETE!');
    console.log('\n📊 Key Questions:');
    console.log('1. Where do the 3 AI agents store their output?');
    console.log('2. Which table should we use for transcript-based insights?');
    console.log('3. How does the system track goal alignment scores?');

  } catch (error) {
    console.error('❌ Analysis error:', error);
  }
}

checkAllTables(); 