// Test script for Linear API integration - uses environment variable
const LINEAR_API_KEY = process.env.LINEAR_API_KEY

if (!LINEAR_API_KEY) {
  console.log('❌ LINEAR_API_KEY environment variable not set')
  console.log('   Please add it to your .env file:')
  console.log('   LINEAR_API_KEY=your_linear_api_key_here')
  process.exit(1)
}

async function testLinearAPI() {
  console.log('🔍 Testing Linear API connection...\n')

  try {
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/integrations/linear/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Linear API connection successful!')
      console.log('👤 User:', data.connection.user.name, `(${data.connection.user.email})`)
      console.log(`🏢 Teams: ${data.teams.length} found`)
      
      data.teams.forEach(team => {
        console.log(`   • ${team.name} (${team.key})`)
      })
      
      console.log(`📋 Recent Issues: ${data.recent_issues.count} found`)
      
      if (data.recent_issues.issues.length > 0) {
        console.log('   Preview:')
        data.recent_issues.issues.forEach(issue => {
          console.log(`   • ${issue.identifier}: ${issue.title}`)
        })
      }
    } else {
      console.log('❌ Linear API test failed:', data.error)
      if (data.details) {
        console.log('   Details:', data.details)
      }
    }

  } catch (error) {
    console.log('❌ Failed to connect to API:', error.message)
    console.log('   Make sure your development server is running on http://localhost:3000')
  }
}

console.log('Linear API Integration Test')
console.log('==========================')
console.log('Make sure LINEAR_API_KEY is set in your .env file\n')

testLinearAPI() 