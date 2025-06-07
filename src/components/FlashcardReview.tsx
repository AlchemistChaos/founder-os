'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { calculateNextReview, ReviewResult, FlashcardStats } from '@/lib/srs'
import { supabase } from '@/lib/supabase'

interface Flashcard {
  id: string
  question: string
  answer: string
  tags: string[]
  stats: FlashcardStats
  notes?: string
  source?: string
}

export function FlashcardReview() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [filter, setFilter] = useState<'due' | 'all' | string>('due')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isReviewMode, setIsReviewMode] = useState(false)

  useEffect(() => {
    // Check for review mode from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('mode') === 'review') {
      setIsReviewMode(true)
      setFilter('due')
    }
  }, [])

  useEffect(() => {
    // Fetch real flashcards from database
    const fetchFlashcards = async () => {
      try {
        // Get auth headers similar to insights page
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.access_token) {
          console.log('No authentication session found')
          setFlashcards([])
          return
        }

        const response = await fetch('/api/flashcards', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          const realFlashcards = data.flashcards?.map((card: any) => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            tags: [], // No tags in current schema
            stats: {
              easeFactor: card.ease_factor || 2.5,
              interval: card.interval || 1,
              repetitionCount: card.repetition_count || 0,
              lastReviewedAt: card.last_reviewed_at ? new Date(card.last_reviewed_at) : null,
              dueAt: card.due_at ? new Date(card.due_at) : new Date()
            },
            notes: '',
            source: 'Generated from meetings'
          })) || []
          
          setFlashcards(realFlashcards)
        } else {
          console.error('Failed to fetch flashcards:', response.status)
          setFlashcards([])
        }
      } catch (error) {
        console.error('Error fetching flashcards:', error)
        setFlashcards([])
      }
    }
    
    fetchFlashcards()
  }, [])

  const filteredFlashcards = flashcards.filter(card => {
    if (filter === 'due') {
      return card.stats.dueAt <= new Date()
    }
    if (filter === 'all') {
      return true
    }
    if (selectedTags.length > 0) {
      return selectedTags.some(tag => card.tags.includes(tag))
    }
    return card.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
  })

  const currentCard = filteredFlashcards[currentIndex]
  const dueCount = flashcards.filter(card => card.stats.dueAt <= new Date()).length
  const allTags = Array.from(new Set(flashcards.flatMap(card => card.tags)))

  const handleReview = (result: ReviewResult) => {
    if (!currentCard) return

    const updatedStats = calculateNextReview(currentCard.stats, result)
    
    setFlashcards(prev => 
      prev.map(card => 
        card.id === currentCard.id 
          ? { ...card, stats: updatedStats }
          : card
      )
    )

    // Move to next card or finish review
    if (currentIndex < filteredFlashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setShowAnswer(false)
    } else {
      // Review complete
      setIsReviewMode(false)
      setCurrentIndex(0)
      setShowAnswer(false)
      alert('Review session complete! 🎉')
    }
  }

  const startReview = () => {
    setIsReviewMode(true)
    setCurrentIndex(0)
    setShowAnswer(false)
    setFilter('due')
  }

  const nextCard = () => {
    if (currentIndex < filteredFlashcards.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setShowAnswer(false)
    }
  }

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setShowAnswer(false)
    }
  }

  if (isReviewMode && currentCard) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🧠 Flashcard Review</h1>
          <p className="text-lg text-gray-600">
            Card {currentIndex + 1} of {filteredFlashcards.length}
          </p>
        </div>

        <Card className="min-h-[400px]">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex flex-wrap gap-1">
                {currentCard.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              {currentCard.source && (
                <span className="text-sm text-gray-500">from {currentCard.source}</span>
              )}
            </div>

            <div className="text-center py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {currentCard.question}
              </h2>
              
              {showAnswer ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-900">{currentCard.answer}</p>
                  </div>
                  {currentCard.notes && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>Notes:</strong> {currentCard.notes}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={() => setShowAnswer(true)}
                  variant="outline"
                  size="lg"
                >
                  Show Answer
                </Button>
              )}
            </div>

            {showAnswer && (
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                  onClick={() => handleReview('forgot')}
                  variant="outline"
                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                >
                  ❌ Forgot
                </Button>
                <Button 
                  onClick={() => handleReview('hard')}
                  variant="outline"
                  className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  🤔 Hard
                </Button>
                <Button 
                  onClick={() => handleReview('good')}
                  variant="outline"
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  👍 Good
                </Button>
                <Button 
                  onClick={() => handleReview('easy')}
                  variant="outline"
                  className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                >
                  ✅ Easy
                </Button>
              </div>
            )}
          </div>
        </Card>

        <div className="flex justify-between">
          <Button onClick={() => setIsReviewMode(false)} variant="outline">
            Exit Review
          </Button>
          <div className="flex gap-2">
            <Button onClick={prevCard} disabled={currentIndex === 0} variant="outline">
              Previous
            </Button>
            <Button onClick={nextCard} disabled={currentIndex === filteredFlashcards.length - 1} variant="outline">
              Skip
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🧠 Flashcard Deck</h1>
        <p className="text-lg text-gray-600">
          {dueCount} cards due today • {flashcards.length} total cards
        </p>
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={startReview} variant="primary" disabled={dueCount === 0}>
            Start Review Session ({dueCount} due)
          </Button>
          <Button variant="outline">Add New Card</Button>
          <Button variant="outline">Import Cards</Button>
        </div>
      </Card>

      {/* Filters */}
      <Card title="Filter Cards">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => setFilter('due')}
              variant={filter === 'due' ? 'primary' : 'outline'}
              size="sm"
            >
              Due Today ({dueCount})
            </Button>
            <Button 
              onClick={() => setFilter('all')}
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
            >
              All Cards ({flashcards.length})
            </Button>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Filter by tags:</p>
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setFilter(tag)
                    setSelectedTags([tag])
                  }}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full hover:bg-gray-200"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Cards List */}
      <Card title={`Cards (${filteredFlashcards.length})`}>
        <div className="space-y-3">
          {filteredFlashcards.map((card, index) => (
            <div key={card.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-2">{card.question}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {card.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500">
                    <p>Due: {card.stats.dueAt.toLocaleDateString()}</p>
                    <p>Interval: {card.stats.interval} days • Ease: {card.stats.easeFactor.toFixed(1)}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => {
                      setCurrentIndex(index)
                      setIsReviewMode(true)
                      setShowAnswer(false)
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Review
                  </Button>
                  <Button size="sm" variant="outline">Edit</Button>
                </div>
              </div>
            </div>
          ))}
          
          {filteredFlashcards.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No cards match your current filter
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}