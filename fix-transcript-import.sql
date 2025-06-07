-- Temporarily disable the participant stats trigger that's interfering with transcript import
-- Run this in Supabase SQL Editor

-- Drop the problematic trigger temporarily
DROP TRIGGER IF EXISTS update_participant_stats_trigger ON meeting_transcripts;

-- The function is trying to access NEW.name which doesn't exist in meeting_transcripts
-- We'll recreate it properly after the import

SELECT 'Transcript import trigger disabled. Safe to import transcripts now.' as status; 