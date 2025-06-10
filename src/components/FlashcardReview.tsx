'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { FlashcardInfoModal } from './FlashcardInfoModal'
import { parseFormattedText } from '@/lib/utils'

interface Flashcard {
  id: string
  question: string
  answer: string
  difficulty: 'easy' | 'medium' | 'hard'
  source_meeting_id?: string
  source_meeting_title?: string
  created_at: string
}

interface FlashcardReviewProps {
  theme?: 'light' | 'dark' | 'auto'
}

export function FlashcardReview({ theme = 'auto' }: FlashcardReviewProps) {
  const { user, loading: authLoading } = useAuth()
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showingTodayCards, setShowingTodayCards] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)

  // Helper function to render formatted text with bullet points
  const renderFormattedText = (text: string) => {
    const parsedContent = parseFormattedText(text)
    
    return parsedContent.map((item, index) => {
      if (item.type === 'bullet') {
        return (
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-current mt-0.5 flex-shrink-0">•</span>
            <span className="flex-1">{item.content}</span>
          </div>
        )
      }
      
      // Regular text line
      return (
        <div key={index} className={item.content ? "mb-1" : "mb-2"}>
          {item.content || '\u00A0'}
        </div>
      )
    })
  }

  // Determine theme based on time of day or explicit prop
  const getTheme = () => {
    if (theme === 'auto') {
      const hour = new Date().getHours()
      return hour >= 5 && hour < 17 ? 'light' : 'dark'
    }
    return theme
  }

  const themeClass = `theme-${getTheme()}`

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

  const fetchFlashcards = async (resetToday: boolean = false) => {
    setLoading(true)
    setError(null)
    
    try {
      const headers = await getAuthHeaders()
      if (!headers) return

      const url = resetToday ? '/api/flashcards?todayReset=true' : '/api/flashcards'
      
      const response = await fetch(url, { headers })

      if (!response.ok) {
        throw new Error(`Failed to fetch flashcards: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setFlashcards(data.flashcards || [])
      setCurrentIndex(0)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load flashcards')
    } finally {
      setLoading(false)
    }
  }

  const handleResetToday = () => {
    fetchFlashcards(true)
  }

  useEffect(() => {
    if (user) {
      fetchFlashcards()
    }
  }, [user])

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowAnswer(false)
      setIsFlipping(false)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowAnswer(false)
      setIsFlipping(false)
    }
  }

  const handleShowAnswer = () => {
    setIsFlipping(true)
    setTimeout(() => {
      setShowAnswer(!showAnswer)
      setIsFlipping(false)
    }, 150)
  }

  const handleDifficultyRating = async (rating: 'easy' | 'medium' | 'hard') => {
    try {
      const headers = await getAuthHeaders()
      if (!headers) return

      // Send rating to API to update spaced repetition algorithm
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          flashcardId: flashcards[currentIndex]?.id,
          rating
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        setReviewedCount(prev => prev + 1)
        
        // Move to next card after a brief delay
        setTimeout(() => {
          handleNext()
        }, 200)
      }
    } catch (error) {
      // Handle error silently for now
    }
  }

  if (authLoading) {
    return (
      <div className={`${themeClass} min-h-screen flex items-center justify-center`}>
        <div className="skeleton w-80 h-64 rounded-2xl"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`${themeClass} min-h-screen flex items-center justify-center p-4`}>
        <div className="card-container max-w-md w-full text-center animate-fade-in-up">
          <h2 className="text-xl font-semibold mb-4">
            🔐 Sign In Required
          </h2>
          <p className="subtext mb-6">
            Please sign in to access your flashcards and start reviewing key insights from your meetings.
          </p>
          <Link href="/auth">
            <button className="btn-primary w-full touch-target">
              Sign In
            </button>
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`${themeClass} min-h-screen flex items-center justify-center`}>
        <div className="flex flex-col items-center space-y-4">
          <div className="skeleton w-80 h-64 rounded-2xl"></div>
          <div className="skeleton w-64 h-4 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${themeClass} min-h-screen flex items-center justify-center p-4`}>
        <div className="card-container max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-red-500 mb-4">
            ⚠️ Error
          </h2>
          <p className="subtext mb-6">{error}</p>
          <button onClick={fetchFlashcards} className="btn-primary w-full touch-target">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className={`${themeClass} min-h-screen p-4`}>
        {/* Progress Header - Always show */}
        <div className="max-w-4xl mx-auto mb-6 animate-fade-in-up">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <h1 className="header-text">
                📚 {showingTodayCards ? 'Today\'s Cards - Practice Mode' : 'Nightly Review'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm subtext">
                0 cards {showingTodayCards ? 'from today' : 'due'}
              </span>
              {!showingTodayCards && (
                <button
                  onClick={handleResetToday}
                  className="btn-secondary text-sm px-4 py-2"
                  title="Reset and practice today's cards"
                >
                  🔄 Reset Today
                </button>
              )}
            </div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '0%' }}></div>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex items-center justify-center">
          <div className="card-container max-w-md w-full text-center animate-fade-in-up">
            <h2 className="text-xl font-semibold mb-4">
              📚 {showingTodayCards ? 'No Cards from Today' : 'No Cards Due for Review'}
            </h2>
            <p className="subtext mb-6">
              {showingTodayCards 
                ? 'No flashcards were created today yet. Generate some from your meeting insights!'
                : 'Great job! You\'ve reviewed all your due flashcards. Cards will appear here when they\'re scheduled for review based on your performance.'
              }
            </p>
            <div className="space-y-3">
              <Link href="/integrations">
                <button className="btn-secondary w-full touch-target">
                  Connect Meeting Tools
                </button>
              </Link>
              <Link href="/insights">
                <button className="btn-primary w-full touch-target">
                  Generate New Cards
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentCard = flashcards[currentIndex]
  const progressPercentage = (reviewedCount / flashcards.length) * 100

  return (
    <div className={`${themeClass} min-h-screen p-4`}>
      {/* Progress Header */}
      <div className="max-w-4xl mx-auto mb-6 animate-fade-in-up">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <h1 className="header-text">
              📚 {showingTodayCards ? 'Today\'s Cards - Practice Mode' : 'Nightly Review'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm subtext">
              {reviewedCount} of {flashcards.length} reviewed {showingTodayCards ? 'in practice' : 'today'}
            </span>
            {!showingTodayCards && (
              <button
                onClick={handleResetToday}
                className="btn-secondary text-sm px-4 py-2"
                title="Reset and practice today's cards"
              >
                🔄 Reset Today
              </button>
            )}
          </div>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Main Flashcard Area with Side Navigation */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-2">
          {/* Previous Button */}
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className={`btn-secondary touch-target flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'} transition-all duration-200`}
          >
            <span className="text-lg">←</span>
          </button>

          {/* Flashcard Container */}
          <div className="flashcard-container-wrapper">
            <div 
              className={`flashcard-inner cursor-pointer ${showAnswer ? 'flipped' : ''}`}
              onClick={handleShowAnswer}
            >
              {/* Front Side - Question */}
              <div className="flashcard-side flashcard-front flashcard-container flex flex-col h-full">
                {/* Card metadata */}
                <div className="text-xs subtext mb-4 uppercase tracking-wide flex-shrink-0">
                  From: {currentCard.source_meeting_title || 'Meeting'} • {new Date(currentCard.created_at).toLocaleDateString()}
                </div>

                {/* Question - Centered */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="flashcard-question">
                    {renderFormattedText(currentCard.question)}
                  </div>
                </div>

                {/* Hint text */}
                <div className="text-center text-xs subtext mt-4 opacity-60">
                  Tap to reveal answer
                </div>
              </div>

              {/* Back Side - Answer */}
              <div className="flashcard-side flashcard-back flashcard-container flex flex-col h-full relative">
                {/* More Info Icon - Top Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowInfoModal(true)
                  }}
                  className="absolute top-4 right-4 w-6 h-6 rounded-full bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors z-10"
                  title="More Info"
                >
                  ⓘ
                </button>

                {/* Card metadata */}
                <div className="text-xs subtext mb-4 uppercase tracking-wide flex-shrink-0">
                  From: {currentCard.source_meeting_title || 'Meeting'} • {new Date(currentCard.created_at).toLocaleDateString()}
                </div>

                {/* Answer */}
                <div className="flex-1 flex items-center justify-center mb-6">
                  <div className="text-center p-4 rounded-2xl border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30">
                    <div className="text-green-700 dark:text-green-300 font-medium text-sm leading-relaxed text-left">
                      {renderFormattedText(currentCard.answer)}
                    </div>
                  </div>
                </div>

                {/* Hint text */}
                <div className="text-center text-xs subtext mb-4 opacity-60">
                  Tap to return to question
                </div>
                
                {/* Difficulty Buttons */}
                <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDifficultyRating('hard')
                    }}
                    className="btn-difficulty-hard touch-target flex items-center justify-center gap-2"
                  >
                    <span>😓</span> Hard
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDifficultyRating('medium')
                    }}
                    className="btn-difficulty-medium touch-target flex items-center justify-center gap-2"
                  >
                    <span>🤔</span> Medium
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDifficultyRating('easy')
                    }}
                    className="btn-difficulty-easy touch-target flex items-center justify-center gap-2"
                  >
                    <span>😊</span> Easy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Next Button */}
          <button
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1}
            className={`btn-secondary touch-target flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              currentIndex === flashcards.length - 1
                ? 'opacity-30 cursor-not-allowed' 
                : 'hover:scale-110'
            } transition-all duration-200`}
          >
            <span className="text-lg">→</span>
          </button>
        </div>

        {/* Card Counter */}
        <div className="text-center mt-6">
          <span className="text-sm subtext">
            {currentIndex + 1} of {flashcards.length}
          </span>
        </div>
      </div>

      {/* Completion State */}
      {reviewedCount === flashcards.length && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card-container max-w-md w-full text-center animate-fade-in-up">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold mb-2">
              {showingTodayCards ? 'Practice Complete!' : 'You are Ready!'}
            </h2>
            <p className="subtext mb-6">
              {showingTodayCards 
                ? `${flashcards.length} cards practiced. Great work reinforcing your knowledge!`
                : `${flashcards.length} cards reviewed. Great work on building your knowledge!`
              }
            </p>
            <div className="space-y-3">
              <Link href="/">
                <button className="btn-primary w-full touch-target">
                  Continue to Morning Review
                </button>
              </Link>
              <button
                onClick={handleResetToday}
                className="btn-secondary w-full touch-target"
              >
                🔄 Practice Today's Cards Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      <FlashcardInfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        flashcardId={currentCard?.id}
        meetingId={currentCard?.source_meeting_id}
        meetingTitle={currentCard?.source_meeting_title}
      />
    </div>
  )
}