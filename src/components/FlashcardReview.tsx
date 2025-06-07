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

export function FlashcardReview() {
  const { user, loading: authLoading } = useAuth()
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)

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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="skeleton w-80 h-64 rounded-2xl"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="card-primary max-w-md w-full text-center fade-slide-in">
          <h2 className="text-xl font-semibold text-white mb-4">
            🔐 Sign In Required
          </h2>
          <p className="text-[#888888] mb-6">
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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="skeleton w-80 h-64 rounded-2xl"></div>
          <div className="skeleton w-64 h-4 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="card-primary max-w-md w-full text-center">
          <h2 className="text-xl font-semibold text-red-400 mb-4">
            ⚠️ Error
          </h2>
          <p className="text-[#888888] mb-6">{error}</p>
          <button onClick={fetchFlashcards} className="btn-primary w-full touch-target">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="card-primary max-w-md w-full text-center fade-slide-in">
          <h2 className="text-xl font-semibold text-white mb-4">
            📚 No Flashcards Yet
          </h2>
          <p className="text-[#888888] mb-6">
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
    <div className="min-h-screen bg-[#121212] p-4">
      {/* Progress Header */}
      <div className="max-w-md mx-auto mb-6 fade-slide-in">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-white">📚 Flashcard Review</h1>
          <span className="text-sm text-[#888888]">
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

      {/* Flashcard Container */}
      <div className={`flashcard-container fade-slide-in ${isFlipping ? 'flip-card flipped' : ''}`}>
        {/* Card metadata */}
        <div className="flashcard-meta">
          From: {currentCard.source_meeting_title || 'Meeting'} • {new Date(currentCard.created_at).toLocaleDateString()}
        </div>

        {/* Question */}
        <div className="flashcard-question">
          {currentCard.question}
        </div>

        {/* Show Answer Button or Answer + Difficulty */}
        {!showAnswer ? (
          <button 
            onClick={handleShowAnswer}
            className="btn-primary mx-auto block touch-target bounce-tap"
            disabled={isFlipping}
          >
            {isFlipping ? 'Revealing...' : 'Show Answer'}
          </button>
        ) : (
          <div className="fade-slide-in">
            <div className="flashcard-answer">
              {currentCard.answer}
            </div>
            
            {/* Difficulty Buttons */}
            <div className="flex justify-between gap-3">
              <button 
                onClick={() => handleDifficultyRating('hard')}
                className="btn-difficulty-hard touch-target"
              >
                😓 Hard
              </button>
              <button 
                onClick={() => handleDifficultyRating('medium')}
                className="btn-difficulty-medium touch-target"
              >
                🤔 Medium
              </button>
              <button 
                onClick={() => handleDifficultyRating('easy')}
                className="btn-difficulty-easy touch-target"
              >
                😊 Easy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="max-w-md mx-auto mt-6 flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className={`btn-secondary touch-target ${currentIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          ← Previous
        </button>
        
        <span className="text-sm text-[#888888]">
          {currentIndex + 1} of {flashcards.length}
        </span>
        
        <button
          onClick={handleNext}
          disabled={currentIndex === flashcards.length - 1 || !showAnswer}
          className={`btn-secondary touch-target ${(currentIndex === flashcards.length - 1 || !showAnswer) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next →
        </button>
      </div>

      {/* Completion State */}
      {reviewedCount === flashcards.length && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card-primary max-w-md w-full text-center fade-slide-in">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-white mb-2">
              You're Ready!
            </h2>
            <p className="text-[#888888] mb-6">
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