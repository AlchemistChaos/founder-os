const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

async function setupDatabase() {
  // Check if we have the required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing environment variables!')
    console.log('Please set up your .env.local file with:')
    console.log('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url')
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key')
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
    console.log('')
    console.log('Get these from: https://supabase.com/dashboard/project/gryxxsgvxkqcopfdbadx/settings/api')
    return
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('🚀 Starting database setup...')
    
    // Read and execute the main setup script
    console.log('📄 Running setup-supabase-db.sql...')
    const setupScript = fs.readFileSync(path.join(__dirname, 'setup-supabase-db.sql'), 'utf8')
    
    // Split the script into individual statements
    const statements = setupScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          console.log('⚠️  Error executing statement:', error.message)
          // Continue with other statements
        }
      }
    }
    
    console.log('✅ setup-supabase-db.sql completed')
    
    // Read and execute the Fireflies enhancement script
    console.log('📄 Running enhanced-fireflies-schema.sql...')
    const firelfiesScript = fs.readFileSync(path.join(__dirname, 'enhanced-fireflies-schema.sql'), 'utf8')
    
    const firelfiesStatements = firelfiesScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (const statement of firelfiesStatements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        if (error) {
          console.log('⚠️  Error executing statement:', error.message)
          // Continue with other statements
        }
      }
    }
    
    console.log('✅ enhanced-fireflies-schema.sql completed')
    console.log('🎉 Database setup complete!')
    
    // Test the setup by checking if tables exist
    console.log('🔍 Verifying table creation...')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesError) {
      console.log('⚠️  Could not verify tables:', tablesError.message)
    } else {
      console.log('📋 Created tables:', tables.map(t => t.table_name).join(', '))
    }
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message)
  }
}

// Alternative method using direct SQL execution
async function setupDatabaseDirect() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing environment variables!')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('🚀 Starting direct database setup...')
    
    // Read the SQL files
    const setupScript = fs.readFileSync('setup-supabase-db.sql', 'utf8')
    const firelfiesScript = fs.readFileSync('enhanced-fireflies-schema.sql', 'utf8')
    
    // Execute the scripts using raw SQL
    console.log('📄 Executing setup-supabase-db.sql...')
    const { error: setupError } = await supabase.rpc('exec_sql', { 
      sql: setupScript 
    })
    
    if (setupError) {
      console.log('❌ Error in setup script:', setupError.message)
    } else {
      console.log('✅ Setup script completed')
    }
    
    console.log('📄 Executing enhanced-fireflies-schema.sql...')
    const { error: firelfiesError } = await supabase.rpc('exec_sql', { 
      sql: firelfiesScript 
    })
    
    if (firelfiesError) {
      console.log('❌ Error in Fireflies script:', firelfiesError.message)
    } else {
      console.log('✅ Fireflies script completed')
    }
    
    console.log('🎉 Database setup complete!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Run the setup
if (require.main === module) {
  setupDatabaseDirect()
}

module.exports = { setupDatabase, setupDatabaseDirect } 