// Simple in-memory cache to improve API performance
interface CacheEntry<T> {
  data: T
  timestamp: number
  expiry: number
}

class Cache {
  private store = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttlMs: number = 300000): void { // 5 minutes default
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs
    })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    
    if (!entry) {
      return null
    }

    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }

    return entry.data as T
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.store.delete(key)
      }
    }
  }

  size(): number {
    return this.store.size
  }
}

// Global cache instance
export const apiCache = new Cache()

// Auto cleanup every 10 minutes
setInterval(() => {
  apiCache.cleanup()
}, 10 * 60 * 1000)

// Cache keys
export const CACHE_KEYS = {
  LINEAR_MILESTONES: 'linear:milestones',
  LINEAR_ISSUES: 'linear:issues',
  FLASHCARDS: 'flashcards:due',
  MEETINGS: 'meetings:recent',
  AI_INSIGHTS: 'ai:insights'
} as const

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  LINEAR_DATA: 5 * 60 * 1000,     // 5 minutes for Linear data
  FLASHCARDS: 2 * 60 * 1000,      // 2 minutes for flashcards
  MEETINGS: 10 * 60 * 1000,       // 10 minutes for meetings
  AI_INSIGHTS: 15 * 60 * 1000     // 15 minutes for AI insights
} as const 