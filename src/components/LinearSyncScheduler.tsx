'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface SyncStatus {
  isScheduled: boolean
  nextSync: string | null
  lastSync: string | null
  isManualSyncing: boolean
}

export default function LinearSyncScheduler({ userId }: { userId: string }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isScheduled: false,
    nextSync: null,
    lastSync: null,
    isManualSyncing: false
  })
  const [syncMessage, setSyncMessage] = useState<string>('')

  // Check sync schedule and set up automatic syncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let intervalId: NodeJS.Timeout

    const checkAndScheduleSync = async () => {
      try {
        const response = await fetch('/api/integrations/linear/schedule')
        const data = await response.json()
        
        const now = new Date()
        const nextSync = new Date(data.next_sync)
        const timeUntilSync = nextSync.getTime() - now.getTime()

        setSyncStatus(prev => ({
          ...prev,
          isScheduled: true,
          nextSync: data.next_sync
        }))

        console.log(`Next Linear sync scheduled for: ${nextSync.toLocaleString()}`)
        console.log(`Time until sync: ${Math.round(timeUntilSync / 1000 / 60)} minutes`)

        // Schedule the sync
        if (timeUntilSync > 0) {
          timeoutId = setTimeout(async () => {
            console.log('Running scheduled Linear sync...')
            await runScheduledSync()
            // After sync, schedule the next one
            checkAndScheduleSync()
          }, timeUntilSync)
        }

      } catch (error) {
        console.error('Error checking sync schedule:', error)
      }
    }

    const runScheduledSync = async () => {
      try {
        setSyncMessage('Running scheduled sync...')
        const response = await fetch('/api/integrations/linear/schedule', {
          method: 'POST'
        })
        
        const data = await response.json()
        
        if (data.success) {
          setSyncMessage(`✅ Scheduled sync completed - ${data.total_synced} items synced`)
          setSyncStatus(prev => ({
            ...prev,
            lastSync: new Date().toISOString()
          }))
        } else {
          setSyncMessage(`❌ Scheduled sync failed: ${data.error}`)
        }
        
        // Clear message after 5 seconds
        setTimeout(() => setSyncMessage(''), 5000)
        
      } catch (error) {
        console.error('Scheduled sync failed:', error)
        setSyncMessage('❌ Scheduled sync failed')
        setTimeout(() => setSyncMessage(''), 5000)
      }
    }

    // Initialize scheduling
    checkAndScheduleSync()

    // Check every hour if we need to reschedule
    intervalId = setInterval(checkAndScheduleSync, 60 * 60 * 1000)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const runManualSync = async () => {
    setSyncStatus(prev => ({ ...prev, isManualSyncing: true }))
    setSyncMessage('Running manual sync...')

    try {
      const response = await fetch('/api/integrations/linear/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      })

      const data = await response.json()

      if (data.success) {
        setSyncMessage(`✅ Manual sync completed - ${data.synced} items synced`)
        setSyncStatus(prev => ({
          ...prev,
          lastSync: new Date().toISOString()
        }))
      } else {
        setSyncMessage(`❌ Manual sync failed: ${data.error}`)
      }

    } catch (error) {
      console.error('Manual sync failed:', error)
      setSyncMessage('❌ Manual sync failed')
    } finally {
      setSyncStatus(prev => ({ ...prev, isManualSyncing: false }))
      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(''), 5000)
    }
  }

  const formatNextSync = (nextSync: string | null) => {
    if (!nextSync) return 'Not scheduled'
    
    const date = new Date(nextSync)
    const now = new Date()
    const diffMinutes = Math.round((date.getTime() - now.getTime()) / (1000 * 60))
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes`
    } else if (diffMinutes < 24 * 60) {
      return `${Math.round(diffMinutes / 60)} hours`
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Linear Sync
        </h3>
        <Button
          onClick={runManualSync}
          disabled={syncStatus.isManualSyncing}
          size="sm"
          variant="outline"
        >
          {syncStatus.isManualSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          {syncStatus.isScheduled ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-500" />
          )}
          <span>
            Auto-sync: {syncStatus.isScheduled ? 'Active' : 'Inactive'} 
            (8:30am & 9:30pm daily)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Next sync: {formatNextSync(syncStatus.nextSync)}</span>
        </div>

        {syncStatus.lastSync && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>
              Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {syncMessage && (
        <div className="mt-3 p-2 bg-muted rounded text-sm">
          {syncMessage}
        </div>
      )}
    </div>
  )
} 