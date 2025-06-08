'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface FlashcardInfoModalProps {
  isOpen: boolean
  onClose: () => void
  flashcardId?: string
  meetingId?: string // Keep for backward compatibility
  meetingTitle?: string
}

interface AIInsight {
  id: string
  insight_text: string
  context: string
  how_to_implement: string
  relevance: string // This is where how_to_implement is actually stored
  category: string
  priority: string
  priority_reason: string
  goal_scores: {
    creator_brand: number
    pulse_startup: number
    data_driven: number
    learning_secrets: number
    overall: number
  }
}

export function FlashcardInfoModal({ isOpen, onClose, flashcardId, meetingId, meetingTitle }: FlashcardInfoModalProps) {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRelatedInsights = useCallback(async () => {
    if (!flashcardId && !meetingId) {
      return
    }

    try {
      setLoading(true)
      
      // First try to get specific insight for flashcard
      if (flashcardId) {
        const response = await fetch(`/api/ai-insights?flashcard_id=${flashcardId}`, {
          headers: await getAuthHeaders()
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.insights && data.insights.length > 0) {
            setInsights(data.insights)
            return
          }
        }
      }
      
      // Fallback to meeting insights
      if (meetingId) {
        const response = await fetch(`/api/ai-insights?meeting_id=${meetingId}`, {
          headers: await getAuthHeaders()
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (data.insights && data.insights.length > 0) {
            setInsights(data.insights)
          } else {
            // Final fallback - try getting all insights as a test
            const allResponse = await fetch('/api/ai-insights', {
              headers: await getAuthHeaders()
            })
            
            if (allResponse.ok) {
              const allData = await allResponse.json()
              setInsights(allData.insights || [])
            }
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [flashcardId, meetingId])

  useEffect(() => {
    if (isOpen && (flashcardId || meetingId)) {
      fetchRelatedInsights()
    }
  }, [isOpen, flashcardId, meetingId, fetchRelatedInsights])

  if (!isOpen) return null

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      case 'low': return 'text-green-400 bg-green-500/10 border-green-500/20'
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'strategy': return '🎯'
      case 'marketing': return '📈'
      case 'product': return '🚀'
      case 'customer': return '👥'
      case 'technical': return '⚡'
      case 'business': return '💼'
      default: return '💡'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                💡 Related Insights & Implementation
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                From: {meetingTitle || 'Meeting'} 
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="skeleton w-full h-32 rounded-lg"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                onClick={fetchRelatedInsights}
                className="btn-secondary"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && insights.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Additional Insights Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                This flashcard does not have additional AI insights available yet.
              </p>
            </div>
          )}

          {!loading && !error && insights.length > 0 && (
            <div className="space-y-6">
              {insights.map((insight) => (
                <div key={insight.id} className="border border-gray-200 dark:border-neutral-700 rounded-2xl p-6">
                  {/* Insight Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getCategoryIcon(insight.category)}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            {insight.category || 'General'}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(insight.priority)}`}>
                            {insight.priority || 'medium'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Overall Score: {insight.goal_scores?.overall || 0}/10
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Insight Text */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      💡 Insight
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {insight.insight_text}
                    </p>
                  </div>

                  {/* Implementation */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      🛠️ How to Implement
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {insight.how_to_implement}
                    </p>
                  </div>

                  {/* Context */}
                  {insight.context && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        📝 Context
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                        {insight.context}
                      </p>
                    </div>
                  )}

                  {/* Priority Reason */}
                  {insight.priority_reason && (
                    <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        🎯 Why This Matters
                      </h4>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {insight.priority_reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="btn-primary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
} 