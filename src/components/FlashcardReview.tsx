'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowAnswer(false)
    }
  }

  const handleDifficultyRating = async (rating: 'easy' | 'medium' | 'hard') => {
    // TODO: Send rating to API to update spaced repetition algorithm
    console.log(`Rated flashcard ${flashcards[currentIndex]?.id} as ${rating}`)
    
    // Move to next card
    handleNext()
  }

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Sign In Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please sign in to access your flashcards and start reviewing key insights from your meetings.
          </p>
          <Link href="/auth">
            <Button variant="primary" className="w-full">
              Sign In
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-8">
          <div className="text-gray-500">Loading flashcards...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-red-700 mb-4">
            Error
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={fetchFlashcards} variant="primary">
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  if (flashcards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            No Flashcards Yet
          </h2>
          <p className="text-gray-600 mb-6">
            Flashcards will be generated automatically from your meetings. 
            Connect your meeting tools in the integrations page to get started.
          </p>
          <Link href="/integrations">
            <Button variant="primary">
              Set Up Integrations
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  const currentCard = flashcards[currentIndex]

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-0">
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">📚 Flashcard Review</h1>
        <p className="text-sm md:text-base text-gray-600">
          Reviewing {currentIndex + 1} of {flashcards.length} flashcards
        </p>
      </div>

      <Card className="p-4 md:p-6 mb-4 md:mb-6">
        <div className="min-h-[180px] md:min-h-[200px] flex items-center justify-center">
          <div className="text-center w-full">
            <div className="text-base md:text-lg font-medium text-gray-900 mb-4 leading-relaxed px-2">
              {currentCard.question}
            </div>
            
            {showAnswer && (
              <div className="mt-4 md:mt-6 p-3 md:p-4 bg-blue-50 rounded-lg">
                <div className="text-gray-700 text-sm md:text-base leading-relaxed">{currentCard.answer}</div>
                {currentCard.source_meeting_title && (
                  <div className="text-xs md:text-sm text-gray-500 mt-2">
                    From: {currentCard.source_meeting_title}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-center mt-4 md:mt-6">
          {!showAnswer ? (
            <Button 
              onClick={() => setShowAnswer(true)} 
              variant="primary"
              className="w-full sm:w-auto px-6 py-3 text-sm md:text-base"
            >
              Show Answer
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                onClick={() => handleDifficultyRating('easy')}
                variant="outline"
                className="text-green-600 border-green-600 hover:bg-green-50 flex-1 sm:flex-none text-sm md:text-base py-2 md:py-3"
              >
                😊 Easy
              </Button>
              <Button
                onClick={() => handleDifficultyRating('medium')}
                variant="outline"
                className="text-yellow-600 border-yellow-600 hover:bg-yellow-50 flex-1 sm:flex-none text-sm md:text-base py-2 md:py-3"
              >
                🤔 Medium
              </Button>
              <Button
                onClick={() => handleDifficultyRating('hard')}
                variant="outline"
                className="text-red-600 border-red-600 hover:bg-red-50 flex-1 sm:flex-none text-sm md:text-base py-2 md:py-3"
              >
                😓 Hard
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between items-center">
        <Button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          variant="outline"
          className="text-sm md:text-base px-3 md:px-4 py-2"
        >
          <span className="hidden sm:inline">← Previous</span>
          <span className="sm:hidden">←</span>
        </Button>
        
        <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-none px-2">
          {flashcards.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        
        <Button
          onClick={handleNext}
          disabled={currentIndex === flashcards.length - 1}
          variant="outline"
          className="text-sm md:text-base px-3 md:px-4 py-2"
        >
          <span className="hidden sm:inline">Next →</span>
          <span className="sm:hidden">→</span>
        </Button>
      </div>

      {/* Mobile-friendly progress info */}
      <div className="mt-4 text-center">
        <div className="text-xs md:text-sm text-gray-500">
          Card {currentIndex + 1} of {flashcards.length}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
          <div 
            className="bg-blue-600 h-1 rounded-full transition-all duration-300" 
            style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}