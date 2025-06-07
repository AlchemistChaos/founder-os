// SM-2 Spaced Repetition Algorithm implementation

export interface FlashcardStats {
  easeFactor: number
  interval: number
  repetitionCount: number
  lastReviewedAt: Date
  dueAt: Date
}

export type ReviewResult = 'easy' | 'good' | 'hard' | 'forgot'

export function calculateNextReview(
  stats: FlashcardStats,
  result: ReviewResult
): FlashcardStats {
  const now = new Date()
  let { easeFactor, interval, repetitionCount } = stats

  // Update ease factor based on result
  switch (result) {
    case 'forgot':
      // Reset to beginning
      easeFactor = Math.max(1.3, easeFactor - 0.2)
      interval = 1
      repetitionCount = 0
      break
    
    case 'hard':
      easeFactor = Math.max(1.3, easeFactor - 0.15)
      repetitionCount += 1
      if (repetitionCount === 1) {
        interval = 1
      } else if (repetitionCount === 2) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor)
      }
      break
    
    case 'good':
      repetitionCount += 1
      if (repetitionCount === 1) {
        interval = 1
      } else if (repetitionCount === 2) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor)
      }
      break
    
    case 'easy':
      easeFactor = Math.min(2.5, easeFactor + 0.15)
      repetitionCount += 1
      if (repetitionCount === 1) {
        interval = 4
      } else if (repetitionCount === 2) {
        interval = 6
      } else {
        interval = Math.round(interval * easeFactor * 1.3)
      }
      break
  }

  // Calculate next due date
  const dueAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000)

  return {
    easeFactor,
    interval,
    repetitionCount,
    lastReviewedAt: now,
    dueAt
  }
}

export function getFlashcardsDue(flashcards: (FlashcardStats & { id: string })[]): string[] {
  const now = new Date()
  return flashcards
    .filter(card => card.dueAt <= now)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .map(card => card.id)
}

export function initializeFlashcard(): FlashcardStats {
  const now = new Date()
  return {
    easeFactor: 2.5,
    interval: 1,
    repetitionCount: 0,
    lastReviewedAt: now,
    dueAt: now
  }
}