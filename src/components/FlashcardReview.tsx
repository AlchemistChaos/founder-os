'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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

  // Determine theme based on time of day or explicit prop
  const getTheme = () => {
    if (theme !== 'auto') return theme
    
    const currentHour = new Date().getHours()
    // Morning: 5 AM - 5 PM = light theme
    // Evening: 5 PM - 5 AM = dark theme
    return (currentHour >= 5 && currentHour < 17) ? 'light' : 'dark'
  }

  const currentTheme = getTheme()
  const themeClass = currentTheme === 'light' ? 'theme-light' : 'theme-dark'

  const getAuthHeaders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        return {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    } catch (error) {
      console.log('No Supabase session found')
    }
    
    return null
  }

  const fetchFlashcards = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      
      const headers = await getAuthHeaders()
      if (!headers) {
        setError('Authentication required. Please sign in.')
        return
      }

      const response = await fetch('/api/flashcards', { headers })
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please sign in again.')
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setFlashcards(data.flashcards || [])
    } catch (error) {
      console.error('Error fetching flashcards:', error)
      setError('Failed to load flashcards. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      fetchFlashcards()
    } else if (!authLoading && !user) {
      setLoading(false)
    }
  }, [user, authLoading])

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
      setShowAnswer(true)
      setIsFlipping(false)
    }, 300)
  }

  const handleDifficultyRating = async (rating: 'easy' | 'medium' | 'hard') => {
    // TODO: Send rating to API to update spaced repetition algorithm
    console.log(`Rated flashcard ${flashcards[currentIndex]?.id} as ${rating}`)
    
    setReviewedCount(prev => prev + 1)
    
    // Move to next card after a brief delay
    setTimeout(() => {
      handleNext()
    }, 200)
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
      <div className={`${themeClass} min-h-screen flex items-center justify-center p-4`}>
        <div className="card-container max-w-md w-full text-center animate-fade-in-up">
          <h2 className="text-xl font-semibold mb-4">
            📚 No Flashcards Yet
          </h2>
          <p className="subtext mb-6">
            Flashcards will be generated automatically from your meetings. 
            Connect your meeting tools in the integrations page to get started.
          </p>
          <Link href="/integrations">
            <button className="btn-primary w-full touch-target">
              Set Up Integrations
            </button>
          </Link>
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
          <h1 className="header-text">📚 Flashcard Review</h1>
          <span className="text-sm subtext">
            {reviewedCount} of {flashcards.length} reviewed
          </span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Main Flashcard Area with Side Navigation */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-3">
          {/* Previous Button */}
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className={`btn-secondary touch-target flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'} transition-all duration-200`}
          >
            <span className="text-lg">←</span>
          </button>

          {/* Flashcard Container */}
          <div 
            className={`flashcard-container animate-fade-in-up cursor-pointer transition-all duration-300 ${
              isFlipping ? 'transform scale-95' : !showAnswer ? 'hover:scale-[1.02] hover:shadow-lg' : ''
            }`}
            onClick={!showAnswer ? handleShowAnswer : undefined}
          >
            {/* Card metadata */}
            <div className="text-xs subtext mb-4 uppercase tracking-wide">
              From: {currentCard.source_meeting_title || 'Meeting'} • {new Date(currentCard.created_at).toLocaleDateString()}
            </div>

            {/* Question */}
            <div className="flashcard-question">
              {currentCard.question}
            </div>

            {/* Answer + Difficulty or Empty Space */}
            {showAnswer ? (
              <div className="animate-fade-in-up">
                <div className="text-center mb-6 p-4 rounded-2xl border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30">
                  <div className="text-green-700 dark:text-green-300 font-medium">
                    {currentCard.answer}
                  </div>
                </div>
                
                {/* Difficulty Buttons */}
                <div className="grid grid-cols-3 gap-3">
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
            ) : (
              <div className="mt-6 h-24"></div>
            )}
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
              You're Ready!
            </h2>
            <p className="subtext mb-6">
              {flashcards.length} cards reviewed. Great work on building your knowledge!
            </p>
            <Link href="/">
              <button className="btn-primary w-full touch-target">
                Continue to Morning Review
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}