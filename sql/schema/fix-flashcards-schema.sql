-- Fix flashcards table schema for AI insights integration
-- Run this in Supabase SQL Editor

-- Add missing columns to flashcards table
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS confidence_level TEXT DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high'));

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_flashcards_meeting_id ON public.flashcards(meeting_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_category ON public.flashcards(category);
CREATE INDEX IF NOT EXISTS idx_flashcards_priority ON public.flashcards(priority);
CREATE INDEX IF NOT EXISTS idx_flashcards_tags ON public.flashcards USING GIN(tags);

-- Make entry_id nullable for AI-generated flashcards (they don't come from entries)
ALTER TABLE public.flashcards 
ALTER COLUMN entry_id DROP NOT NULL;

-- Add comment to document the change
COMMENT ON TABLE public.flashcards IS 'Flashcards for spaced repetition learning. Can be created from entries or AI insights.';
COMMENT ON COLUMN public.flashcards.meeting_id IS 'Reference to meeting if flashcard was created from AI insights';
COMMENT ON COLUMN public.flashcards.category IS 'Category of flashcard (general, ai-insight, manual, etc.)';
COMMENT ON COLUMN public.flashcards.priority IS 'Priority level for review scheduling';
COMMENT ON COLUMN public.flashcards.tags IS 'Tags for categorization and filtering';
COMMENT ON COLUMN public.flashcards.confidence_level IS 'Confidence level of the flashcard content';

SELECT 'Flashcards table updated successfully for AI insights integration!' as status; 