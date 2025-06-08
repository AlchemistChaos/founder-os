'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { renderFormattedText } from '@/lib/utils'

interface Flashcard {
  id: string
  question: string
  answer: string
  ease_factor: number
  interval: number
  repetition_count: number
  last_reviewed_at: string | null
  due_at: string | null
  created_at: string
  source_meeting_id?: string
  source_meeting_title?: string
}

interface EditFlashcardModalProps {
  isOpen: boolean
  onClose: () => void
  flashcard: Flashcard | null
  onSave: (updatedCard: Flashcard) => void
}

function EditFlashcardModal({ isOpen, onClose, flashcard, onSave }: EditFlashcardModalProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (flashcard) {
      setQuestion(flashcard.question)
      setAnswer(flashcard.answer)
    }
  }, [flashcard])

  const handleSave = async () => {
    if (!flashcard) return

    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No authentication session')
      }

      const response = await fetch('/api/flashcards/edit', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: flashcard.id,
          question: question.trim(),
          answer: answer.trim()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update flashcard')
      }

      const updatedCard = { ...flashcard, question: question.trim(), answer: answer.trim() }
      onSave(updatedCard)
      onClose()
    } catch (error) {
      console.error('Error updating flashcard:', error)
      alert('Failed to update flashcard. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                ✏️ Edit Flashcard
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Update the question and answer for this flashcard
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
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Question
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-neutral-800 dark:text-white resize-none"
              rows={3}
              placeholder="Enter the question..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Answer
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-neutral-800 dark:text-white resize-none"
              rows={4}
              placeholder="Enter the answer..."
            />
          </div>

          {flashcard && (
            <div className="bg-gray-50 dark:bg-neutral-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Flashcard Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Created:</span>
                  <div className="text-gray-900 dark:text-white">
                    {new Date(flashcard.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Last Reviewed:</span>
                  <div className="text-gray-900 dark:text-white">
                    {flashcard.last_reviewed_at 
                      ? new Date(flashcard.last_reviewed_at).toLocaleDateString()
                      : 'Never'
                    }
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Review Count:</span>
                  <div className="text-gray-900 dark:text-white">
                    {flashcard.repetition_count}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Next Due:</span>
                  <div className="text-gray-900 dark:text-white">
                    {flashcard.due_at 
                      ? new Date(flashcard.due_at).toLocaleDateString()
                      : 'Not scheduled'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-neutral-700 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1"
            disabled={isLoading || !question.trim() || !answer.trim()}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AllFlashcards() {
  const { user, loading: authLoading } = useAuth()
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCards, setTotalCards] = useState(0)
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const cardsPerPage = 9

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      setError('No authentication session found')
      return null
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  const fetchFlashcards = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      if (!headers) return

      const response = await fetch(`/api/flashcards/all?page=${page}&limit=${cardsPerPage}`, { headers })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setFlashcards(data.flashcards)
        setTotalCards(data.total)
        setTotalPages(Math.ceil(data.total / cardsPerPage))
        setCurrentPage(page)
      } else {
        setError(data.error || 'Failed to fetch flashcards')
      }
    } catch (error) {
      console.error('Error fetching flashcards:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch flashcards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchFlashcards(1)
    }
  }, [user])

  const handleEditCard = (card: Flashcard) => {
    setEditingCard(card)
    setIsEditModalOpen(true)
  }

  const handleSaveCard = (updatedCard: Flashcard) => {
    setFlashcards(prev => prev.map(card => 
      card.id === updatedCard.id ? updatedCard : card
    ))
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchFlashcards(page)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="skeleton w-80 h-64 rounded-2xl"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card-container max-w-md w-full text-center animate-fade-in-up">
          <h2 className="text-xl font-semibold mb-4">
            🔐 Sign In Required
          </h2>
          <p className="subtext mb-6">
            Please sign in to view and manage your flashcards.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="header-text">
              📚 All Flashcards
            </h1>
            <p className="subtext mt-2">
              View and edit all your flashcards • {totalCards} total cards
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-2xl"></div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-red-500 mb-4">
              ⚠️ Error
            </h2>
            <p className="subtext mb-6">{error}</p>
            <button onClick={() => fetchFlashcards(currentPage)} className="btn-primary">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && flashcards.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📚</div>
            <h2 className="text-xl font-semibold mb-2">
              No Flashcards Found
            </h2>
            <p className="subtext mb-6">
              You haven't created any flashcards yet. Start by generating some from your meeting insights!
            </p>
          </div>
        )}

        {!loading && !error && flashcards.length > 0 && (
          <>
            {/* Flashcards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {flashcards.map((card) => (
                <div
                  key={card.id}
                  className="card-container cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                  onClick={() => handleEditCard(card)}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-xs subtext uppercase tracking-wide">
                      {card.source_meeting_title || 'Meeting'} • {new Date(card.created_at).toLocaleDateString()}
                    </div>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors">
                      ✏️
                    </button>
                  </div>

                  {/* Question */}
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                      Question:
                    </h3>
                    <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed line-clamp-3">
                      {renderFormattedText(card.question)}
                    </div>
                  </div>

                  {/* Answer Preview */}
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">
                      Answer:
                    </h3>
                    <div className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-2">
                      {renderFormattedText(card.answer)}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs subtext pt-4 border-t border-gray-200 dark:border-neutral-700">
                    <span>
                      Reviewed {card.repetition_count} times
                    </span>
                    <span>
                      {card.due_at 
                        ? `Due ${new Date(card.due_at).toLocaleDateString()}`
                        : 'Not scheduled'
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'btn-secondary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      <EditFlashcardModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingCard(null)
        }}
        flashcard={editingCard}
        onSave={handleSaveCard}
      />
    </div>
  )
} 