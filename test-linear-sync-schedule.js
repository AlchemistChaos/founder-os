// Test script for Linear scheduled sync functionality
const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function testScheduleInfo() {
  console.log('🕒 Testing sync schedule info...')
  
  try {
    const response = await fetch(`${apiUrl}/api/integrations/linear/schedule`)
    const data = await response.json()
    
    console.log('Schedule Info:', {
      current_time: data.current_time,
      next_sync: data.next_sync,
      sync_times: data.sync_times,
      timezone: data.timezone
    })
    
    const nextSync = new Date(data.next_sync)
    const now = new Date()
    const minutesUntilSync = Math.round((nextSync.getTime() - now.getTime()) / 1000 / 60)
    
    console.log(`⏰ Next sync in ${minutesUntilSync} minutes at ${nextSync.toLocaleString()}`)
    
    return true
  } catch (error) {
    console.error('❌ Schedule info test failed:', error.message)
    return false
  }
}

async function testScheduledSync() {
  console.log('\n📊 Testing scheduled sync endpoint...')
  
  try {
    const response = await fetch(`${apiUrl}/api/integrations/linear/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log('Scheduled Sync Results:', {
      success: data.success,
      message: data.message,
      total_synced: data.total_synced,
      results_count: data.results?.length || 0,
      timestamp: data.timestamp
    })
    
    if (data.results && data.results.length > 0) {
      console.log('\nPer-user Results:')
      data.results.forEach(result => {
        console.log(`  User ${result.user_id}: ${result.success ? '✅' : '❌'} ${result.synced || 0} items`)
        if (result.error) {
          console.log(`    Error: ${result.error}`)
        }
      })
    }
    
    return data.success
  } catch (error) {
    console.error('❌ Scheduled sync test failed:', error.message)
    return false
  }
}

async function testManualSync() {
  console.log('\n🔄 Testing manual sync endpoint...')
  
  try {
    const response = await fetch(`${apiUrl}/api/integrations/linear/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        user_id: '00000000-0000-0000-0000-000000000000' // Use valid UUID format for testing
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    console.log('Manual Sync Results:', {
      success: data.success,
      synced: data.synced,
      issues_found: data.issues?.length || 0,
      timestamp: new Date().toISOString()
    })
    
    if (data.issues && data.issues.length > 0) {
      console.log('\nSample Issues:')
      data.issues.slice(0, 3).forEach(issue => {
        console.log(`  ${issue.identifier}: ${issue.title}`)
        console.log(`    State: ${issue.state?.name}, Priority: ${issue.priority}`)
      })
    }
    
    return data.success
  } catch (error) {
    console.error('❌ Manual sync test failed:', error.message)
    return false
  }
}

async function runAllTests() {
  console.log('🧪 Testing Linear Sync Scheduler Functionality')
  console.log('=' * 50)
  
  const scheduleTest = await testScheduleInfo()
  const scheduledSyncTest = await testScheduledSync()
  const manualSyncTest = await testManualSync()
  
  console.log('\n📋 Test Summary:')
  console.log(`  Schedule Info: ${scheduleTest ? '✅' : '❌'}`)
  console.log(`  Scheduled Sync: ${scheduledSyncTest ? '✅' : '❌'}`)
  console.log(`  Manual Sync: ${manualSyncTest ? '✅' : '❌'}`)
  
  const allPassed = scheduleTest && scheduledSyncTest && manualSyncTest
  console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'All tests passed!' : 'Some tests failed'}`)
  
  if (allPassed) {
    console.log('\n✨ Your Linear sync is ready!')
    console.log('   • Automatic syncing at 8:30am and 9:30pm daily')
    console.log('   • Manual sync button available in UI')
    console.log('   • Visit /integrations to see the sync scheduler')
  }
  
  return allPassed
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error)
}

module.exports = { testScheduleInfo, testScheduledSync, testManualSync, runAllTests } 