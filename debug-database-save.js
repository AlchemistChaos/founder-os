const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ALI_MEETING_ID = 'cf2f64db-4648-43ee-afb2-5acf32767888';

async function debugDatabaseSave() {
  try {
    console.log('🔍 Debugging database save issue...\n');

    // 1. Check ai_insights table structure
    console.log('1. Checking ai_insights table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('ai_insights')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.log('❌ Table access error:', tableError);
    } else {
      console.log('✅ Table accessible, sample columns:', Object.keys(tableInfo[0] || {}));
    }

    // 2. Get meeting info
    console.log('\n2. Getting meeting info...');
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', ALI_MEETING_ID)
      .single();

    if (meetingError) {
      console.log('❌ Meeting error:', meetingError);
      return;
    }

    console.log('✅ Meeting found:');
    console.log('   ID:', meeting.id);
    console.log('   User ID:', meeting.user_id);
    console.log('   Title:', meeting.title);

    // 3. Check if user exists
    console.log('\n3. Checking if user exists...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', meeting.user_id)
      .single();

    if (userError) {
      console.log('❌ User not found:', userError);
    } else {
      console.log('✅ User found:', user.email);
    }

    // 4. Test insert with minimal data
    console.log('\n4. Testing minimal insert...');
    const testInsight = {
      user_id: meeting.user_id,
      meeting_id: ALI_MEETING_ID,
      insight_text: 'Test insight from transcript',
      context: 'Test context from Ali conversation',
      category: 'high-priority',
      relevance: 'Test implementation guide',
      reaction: false,
      interest_level: 'high',
      priority: 'high'
    };

    console.log('Attempting to insert:', testInsight);
    
    const { data: insertData, error: insertError } = await supabase
      .from('ai_insights')
      .insert(testInsight)
      .select();

    if (insertError) {
      console.log('❌ Insert error details:');
      console.log('   Code:', insertError.code);
      console.log('   Message:', insertError.message);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);
    } else {
      console.log('✅ Test insert successful:', insertData);
    }

    // 5. Test with all goal fields
    console.log('\n5. Testing full insight with all fields...');
    const fullInsight = {
      user_id: meeting.user_id,
      meeting_id: ALI_MEETING_ID,
      insight_text: 'Full test insight from transcript',
      context: 'Full test context from Ali conversation',
      category: 'high-priority',
      relevance: 'Full test implementation guide',
      reaction: false,
      interest_level: 'high',
      priority: 'high',
      priority_reason: 'Test priority reason',
      goal_creator_brand: 8,
      goal_pulse_startup: 7,
      goal_data_driven: 9,
      goal_learning_secrets: 7,
      goal_overall_score: 31
    };

    const { data: fullData, error: fullError } = await supabase
      .from('ai_insights')
      .insert(fullInsight)
      .select();

    if (fullError) {
      console.log('❌ Full insert error:');
      console.log('   Code:', fullError.code);
      console.log('   Message:', fullError.message);
      console.log('   Details:', fullError.details);
      console.log('   Hint:', fullError.hint);
    } else {
      console.log('✅ Full insert successful:', fullData);
    }

    // 6. Check existing insights count
    console.log('\n6. Checking existing insights...');
    const { data: existingInsights, error: countError } = await supabase
      .from('ai_insights')
      .select('id, insight_text, meeting_id')
      .eq('meeting_id', ALI_MEETING_ID);

    if (countError) {
      console.log('❌ Count error:', countError);
    } else {
      console.log(`✅ Found ${existingInsights.length} existing insights for this meeting`);
      existingInsights.forEach((insight, i) => {
        console.log(`   ${i+1}. ${insight.insight_text?.substring(0, 50)}...`);
      });
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugDatabaseSave(); 