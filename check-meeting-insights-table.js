const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMeetingInsights() {
  try {
    console.log('🔍 Checking meeting_insights table structure...\n');

    // 1. Get sample records to see structure
    console.log('1. Getting sample records...');
    const { data: samples, error: sampleError } = await supabase
      .from('meeting_insights')
      .select('*')
      .limit(3);

    if (sampleError) {
      console.log('❌ Sample error:', sampleError);
    } else {
      console.log(`✅ Found ${samples.length} existing records`);
      if (samples.length > 0) {
        console.log('📋 Sample record structure:');
        console.log('   Columns:', Object.keys(samples[0]));
        console.log('   Sample data:', samples[0]);
      } else {
        console.log('📋 No existing records found');
      }
    }

    // 2. Test a simple insert to see what works
    console.log('\n2. Testing simple insert...');
    const testInsight = {
      meeting_id: 'cf2f64db-4648-43ee-afb2-5acf32767888',
      insight_text: 'Test insight from Ali transcript',
      context: 'Ali Sheikh discussed data-driven YouTube strategy...',
      category: 'high-priority'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('meeting_insights')
      .insert(testInsight)
      .select();

    if (insertError) {
      console.log('❌ Insert error:');
      console.log('   Code:', insertError.code);
      console.log('   Message:', insertError.message);
      console.log('   Details:', insertError.details);
      console.log('   Hint:', insertError.hint);
      
      // If it's a missing column error, let's see what columns are actually expected
      if (insertError.message && insertError.message.includes('column')) {
        console.log('\n🔍 Investigating required columns...');
      }
    } else {
      console.log('✅ Simple insert successful:', insertData);
    }

    // 3. Check if there are any insights for our Ali meeting
    console.log('\n3. Checking existing insights for Ali meeting...');
    const { data: aliInsights, error: aliError } = await supabase
      .from('meeting_insights')
      .select('*')
      .eq('meeting_id', 'cf2f64db-4648-43ee-afb2-5acf32767888');

    if (aliError) {
      console.log('❌ Ali insights error:', aliError);
    } else {
      console.log(`✅ Found ${aliInsights.length} existing insights for Ali meeting`);
      aliInsights.forEach((insight, i) => {
        console.log(`   ${i+1}. ${insight.insight_text?.substring(0, 60)}...`);
      });
    }

    // 4. Check all insights to understand the table better
    console.log('\n4. Checking all insights for pattern analysis...');
    const { data: allInsights, error: allError } = await supabase
      .from('meeting_insights')
      .select('*')
      .limit(5);

    if (allError) {
      console.log('❌ All insights error:', allError);
    } else {
      console.log(`✅ Found ${allInsights.length} total insights in database`);
      allInsights.forEach((insight, i) => {
        console.log(`\n   Insight ${i+1}:`);
        Object.keys(insight).forEach(key => {
          const value = insight[key];
          if (value !== null && value !== undefined) {
            const displayValue = typeof value === 'string' && value.length > 100 
              ? value.substring(0, 100) + '...' 
              : value;
            console.log(`     ${key}: ${displayValue}`);
          }
        });
      });
    }

  } catch (error) {
    console.error('❌ Check error:', error);
  }
}

checkMeetingInsights(); 