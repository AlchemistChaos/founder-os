const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearInsights() {
  console.log('🧹 Clearing existing AI insights to test complete workflow...');
  
  const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';
  
  const { error } = await supabase
    .from('ai_insights')
    .delete()
    .eq('meeting_id', aliMeetingId);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Existing AI insights cleared');
    console.log('🚀 Ready to test complete workflow');
  }
}

clearInsights(); 