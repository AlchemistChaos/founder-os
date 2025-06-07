const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    console.log('🔍 Checking what tables exist in the database...\n');

    // Method 1: Try to get table information from information_schema
    console.log('1. Checking via information_schema...');
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables');

    if (tablesError) {
      console.log('❌ RPC error:', tablesError);
    } else {
      console.log('✅ Tables found via RPC:', tables);
    }

    // Method 2: Try direct SQL query
    console.log('\n2. Trying raw SQL query...');
    const { data: sqlTables, error: sqlError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (sqlError) {
      console.log('❌ SQL query error:', sqlError);
    } else {
      console.log('✅ Tables via SQL:', sqlTables?.map(t => t.table_name));
    }

    // Method 3: Check specific insight-related table names
    console.log('\n3. Testing specific table names...');
    
    const tableNames = [
      'insights',
      'ai_insights',
      'meeting_insights',
      'user_insights',
      'learning_insights',
      'flashcards',
      'meetings',
      'users',
      'profiles'
    ];

    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          if (error.code === '42P01') {
            console.log(`   ❌ ${tableName} - doesn't exist`);
          } else {
            console.log(`   ⚠️ ${tableName} - error: ${error.message}`);
          }
        } else {
          console.log(`   ✅ ${tableName} - exists! Sample columns:`, Object.keys(data[0] || {}));
        }
      } catch (err) {
        console.log(`   ❌ ${tableName} - error: ${err.message}`);
      }
    }

    // Method 4: Check what exists by testing common patterns
    console.log('\n4. Looking for any insights-related tables...');
    const insightPatterns = [
      'insights',
      'meeting_insights', 
      'ai_insights',
      'learning_insights',
      'user_insights',
      'flashcards',
      'notes'
    ];

    for (const pattern of insightPatterns) {
      try {
        const { data, error } = await supabase
          .from(pattern)
          .select()
          .limit(1);

        if (!error) {
          console.log(`   🎯 Found: ${pattern}`);
          if (data && data[0]) {
            console.log(`      Columns: ${Object.keys(data[0]).join(', ')}`);
          }
        }
      } catch (err) {
        // Silent - table doesn't exist
      }
    }

  } catch (error) {
    console.error('❌ General error:', error);
  }
}

checkTables(); 