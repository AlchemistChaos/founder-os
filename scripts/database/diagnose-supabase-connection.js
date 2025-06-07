const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function diagnoseSupabaseConnection() {
  console.log('🔍 Diagnosing Supabase Connection...\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Environment Variables:');
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SERVICE_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing environment variables. Please check .env.local file');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test 2: Basic Connection
  console.log('\n2️⃣ Basic Connection Test:');
  try {
    const { data, error } = await supabase.from('meetings').select('id').limit(1);
    if (error) {
      console.log('❌ Connection failed:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error details:', error.details);
    } else {
      console.log('✅ Basic connection successful');
      console.log(`   Found ${data?.length || 0} meetings in database`);
    }
  } catch (err) {
    console.log('❌ Connection error:', err.message);
  }

  // Test 3: Service Role Permissions
  console.log('\n3️⃣ Service Role Permissions:');
  try {
    // Test if we can access information_schema
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .limit(5);

    if (error) {
      console.log('❌ Cannot access information_schema:', error.message);
      console.log('   This suggests limited permissions');
    } else {
      console.log('✅ Can access information_schema');
      console.log(`   Found ${data.length} public tables:`, data.map(t => t.table_name).join(', '));
    }
  } catch (err) {
    console.log('❌ Schema access error:', err.message);
  }

  // Test 4: Check Available RPC Functions
  console.log('\n4️⃣ Available RPC Functions:');
  try {
    // Try to list available functions
    const { data, error } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_schema', 'public')
      .limit(10);

    if (error) {
      console.log('❌ Cannot list RPC functions:', error.message);
    } else {
      console.log('✅ Available RPC functions:');
      data.forEach(func => {
        console.log(`   - ${func.routine_name} (${func.routine_type})`);
      });
      
      // Check if exec_sql exists
      const execSqlExists = data.some(func => func.routine_name === 'exec_sql');
      console.log(`   exec_sql function: ${execSqlExists ? '✅ Available' : '❌ Not found'}`);
    }
  } catch (err) {
    console.log('❌ RPC function check error:', err.message);
  }

  // Test 5: Try Different SQL Execution Methods
  console.log('\n5️⃣ SQL Execution Methods:');
  
  // Method 1: Direct RPC exec_sql
  console.log('   Testing rpc("exec_sql")...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: 'SELECT version();' 
    });
    if (error) {
      console.log('   ❌ exec_sql RPC failed:', error.message);
    } else {
      console.log('   ✅ exec_sql RPC works!');
    }
  } catch (err) {
    console.log('   ❌ exec_sql RPC error:', err.message);
  }

  // Method 2: Try creating a simple function
  console.log('   Testing custom RPC creation...');
  try {
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION test_connection()
      RETURNS TEXT AS $$
      BEGIN
        RETURN 'Connection test successful';
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    if (error) {
      console.log('   ❌ Cannot create test function:', error.message);
    } else {
      console.log('   ✅ Can create functions via RPC');
      
      // Test the function
      const { data: testResult, error: testError } = await supabase.rpc('test_connection');
      if (testError) {
        console.log('   ❌ Test function failed:', testError.message);
      } else {
        console.log('   ✅ Test function works:', testResult);
      }
    }
  } catch (err) {
    console.log('   ❌ Function creation error:', err.message);
  }

  // Test 6: Check ai_insights table specifically
  console.log('\n6️⃣ ai_insights Table Check:');
  try {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ ai_insights table does not exist');
        console.log('   📝 Need to create the table');
      } else {
        console.log('   ❌ ai_insights access error:', error.message);
        console.log('   Code:', error.code);
      }
    } else {
      console.log('   ✅ ai_insights table exists and accessible');
      console.log(`   Contains ${data?.length || 0} records`);
    }
  } catch (err) {
    console.log('   ❌ ai_insights check error:', err.message);
  }

  // Test 7: Try REST API approach
  console.log('\n7️⃣ REST API Approach:');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      console.log('   ✅ REST API accessible');
      console.log('   Status:', response.status);
    } else {
      console.log('   ❌ REST API failed:', response.status, response.statusText);
    }
  } catch (err) {
    console.log('   ❌ REST API error:', err.message);
  }

  // Test 8: Check PostgreSQL version and extensions
  console.log('\n8️⃣ Database Info:');
  try {
    // Try to get PostgreSQL version
    const { data, error } = await supabase.rpc('version');
    if (error) {
      console.log('   ❌ Cannot get database version:', error.message);
    } else {
      console.log('   ✅ Database version accessible:', data);
    }
  } catch (err) {
    console.log('   ❌ Version check error:', err.message);
  }

  // Test 9: Policy Check
  console.log('\n9️⃣ RLS Policy Check:');
  try {
    const { data, error } = await supabase
      .from('information_schema.table_privileges')
      .select('*')
      .eq('table_name', 'meetings')
      .limit(5);

    if (error) {
      console.log('   ❌ Cannot check table privileges:', error.message);
    } else {
      console.log('   ✅ Table privileges accessible');
      data.forEach(priv => {
        console.log(`   - ${priv.privilege_type} on ${priv.table_name}`);
      });
    }
  } catch (err) {
    console.log('   ❌ Privilege check error:', err.message);
  }

  // Test 10: Suggest Solutions
  console.log('\n🔧 RECOMMENDED SOLUTIONS:');
  console.log('1. Create ai_insights table manually in Supabase SQL Editor');
  console.log('2. Use Supabase Dashboard → SQL Editor for DDL operations');
  console.log('3. Check if service role key has sufficient permissions');
  console.log('4. Ensure RLS policies allow service role access');
  console.log('5. Consider using direct SQL approach via pg client if needed');

  console.log('\n📋 Next Steps:');
  console.log('- Run the SQL from ai-insights-table.sql in Supabase SQL Editor');
  console.log('- Then test with: node simple-ai-insights-setup.js');
  console.log('- Finally process Ali meeting with: node process-ali-with-20-threshold.js');
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

diagnoseSupabaseConnection(); 