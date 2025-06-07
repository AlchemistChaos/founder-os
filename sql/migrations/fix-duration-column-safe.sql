-- Safe fix for duration_minutes column error
-- Run this in your Supabase SQL Editor

-- First, drop the dependent views
DROP VIEW IF EXISTS meeting_summaries CASCADE;
DROP VIEW IF EXISTS participant_analytics CASCADE;

-- Drop the generated column
ALTER TABLE meetings DROP COLUMN IF EXISTS duration_minutes CASCADE;

-- Add it back as a regular calculated column that updates via trigger
ALTER TABLE meetings ADD COLUMN duration_minutes INTEGER;

-- Create function to calculate duration_minutes
CREATE OR REPLACE FUNCTION update_duration_minutes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.duration_minutes = ROUND(NEW.duration_seconds::DECIMAL / 60);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-calculate duration_minutes
DROP TRIGGER IF EXISTS calculate_duration_minutes_trigger ON meetings;
CREATE TRIGGER calculate_duration_minutes_trigger 
    BEFORE INSERT OR UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_duration_minutes();

-- Update existing records (if any)
UPDATE meetings SET duration_minutes = ROUND(duration_seconds::DECIMAL / 60) WHERE duration_minutes IS NULL;

-- Recreate the views
CREATE OR REPLACE VIEW meeting_summaries AS
SELECT 
    m.id,
    m.user_id,
    m.title,
    m.meeting_date,
    m.duration_minutes,
    m.overview,
    m.meeting_url,
    m.transcript_url,
    m.sentiment,
    array_length(m.action_items, 1) as action_item_count,
    array_length(m.keywords, 1) as keyword_count,
    COUNT(DISTINCT mp.id) as participant_count,
    COUNT(DISTINCT mt.id) as transcript_segment_count,
    COUNT(DISTINCT mi.id) as insight_count,
    m.created_at
FROM meetings m
LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
LEFT JOIN meeting_transcripts mt ON m.id = mt.meeting_id  
LEFT JOIN meeting_insights mi ON m.id = mi.meeting_id
GROUP BY m.id, m.user_id, m.title, m.meeting_date, m.duration_minutes, 
         m.overview, m.meeting_url, m.transcript_url, m.sentiment, 
         m.action_items, m.keywords, m.created_at;

-- Recreate participant analytics view
CREATE OR REPLACE VIEW participant_analytics AS
SELECT 
    mp.name,
    mp.email,
    COUNT(DISTINCT mp.meeting_id) as meeting_count,
    AVG(mp.speaking_percentage) as avg_speaking_percentage,
    SUM(mp.speaking_time_seconds) as total_speaking_time_seconds,
    SUM(mp.word_count) as total_word_count,
    AVG(m.duration_minutes) as avg_meeting_duration_minutes,
    MAX(m.meeting_date) as last_meeting_date
FROM meeting_participants mp
JOIN meetings m ON mp.meeting_id = m.id
WHERE m.user_id = auth.uid()
GROUP BY mp.name, mp.email;