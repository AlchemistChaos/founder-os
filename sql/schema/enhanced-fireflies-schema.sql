-- Enhanced FounderOS Database Schema with Comprehensive Fireflies Support
-- Run this in your Supabase SQL Editor after the main setup

-- ============================================
-- FIREFLIES MEETING DATA TABLES
-- ============================================

-- Create meetings table for comprehensive meeting data
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core meeting info
  fireflies_id TEXT UNIQUE NOT NULL, -- Fireflies transcript ID
  title TEXT NOT NULL,
  meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (ROUND(duration_seconds::DECIMAL / 60)) STORED,
  
  -- URLs and links
  meeting_url TEXT, -- Original meeting URL (Zoom, Meet, etc.)
  transcript_url TEXT, -- Fireflies transcript viewer URL
  audio_url TEXT, -- Fireflies audio file URL
  
  -- AI-generated content
  overview TEXT, -- Meeting summary overview
  keywords TEXT[], -- AI-extracted keywords
  action_items TEXT[], -- AI-extracted action items
  questions TEXT[], -- Key questions discussed
  tasks TEXT[], -- Tasks identified
  topics TEXT[], -- Discussion topics
  sentiment TEXT, -- Overall meeting sentiment
  
  -- Meeting outline/agenda with timestamps
  outline JSONB DEFAULT '[]', -- Array of {title, timestamp} objects
  
  -- Search and categorization
  tags TEXT[] DEFAULT '{}',
  search_vector tsvector, -- Full-text search
  
  -- Integration metadata
  source_integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting participants table
CREATE TABLE IF NOT EXISTS meeting_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Participant info
  name TEXT NOT NULL,
  email TEXT,
  fireflies_user_id TEXT, -- Fireflies internal user ID
  
  -- Participation stats
  speaking_time_seconds INTEGER DEFAULT 0,
  speaking_percentage DECIMAL(5,2) DEFAULT 0.0,
  word_count INTEGER DEFAULT 0,
  
  -- Role and status
  is_organizer BOOLEAN DEFAULT FALSE,
  is_external BOOLEAN DEFAULT FALSE, -- Not part of your organization
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting transcripts table for detailed conversation data
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Transcript segment
  speaker_name TEXT NOT NULL,
  text_content TEXT NOT NULL,
  start_time_seconds INTEGER NOT NULL,
  end_time_seconds INTEGER NOT NULL,
  segment_duration INTEGER GENERATED ALWAYS AS (end_time_seconds - start_time_seconds) STORED,
  
  -- Content analysis
  word_count INTEGER GENERATED ALWAYS AS (array_length(string_to_array(text_content, ' '), 1)) STORED,
  contains_action_item BOOLEAN DEFAULT FALSE,
  contains_question BOOLEAN DEFAULT FALSE,
  sentiment TEXT, -- positive, negative, neutral
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meeting insights table for AI-generated insights
CREATE TABLE IF NOT EXISTS meeting_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Insight details
  insight_type TEXT NOT NULL CHECK (insight_type IN ('key_decision', 'action_item', 'follow_up', 'concern', 'opportunity', 'blocker')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0, -- 0.0 to 1.0
  
  -- Associated people and timeline
  mentioned_participants TEXT[], -- Names of people mentioned
  due_date DATE, -- For action items
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  
  -- Context
  related_transcript_segments UUID[], -- References to meeting_transcripts.id
  timestamp_in_meeting INTEGER, -- When in the meeting this insight occurred
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Core meeting indexes
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_fireflies_id ON meetings(fireflies_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date);
CREATE INDEX IF NOT EXISTS idx_meetings_duration ON meetings(duration_minutes);
CREATE INDEX IF NOT EXISTS idx_meetings_tags ON meetings USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_meetings_keywords ON meetings USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_meetings_search ON meetings USING GIN(search_vector);

-- Participant indexes
CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_participants_name ON meeting_participants(name);
CREATE INDEX IF NOT EXISTS idx_participants_email ON meeting_participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_speaking_time ON meeting_participants(speaking_time_seconds);

-- Transcript indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON meeting_transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_speaker ON meeting_transcripts(speaker_name);
CREATE INDEX IF NOT EXISTS idx_transcripts_time ON meeting_transcripts(start_time_seconds);
CREATE INDEX IF NOT EXISTS idx_transcripts_content ON meeting_transcripts USING GIN(to_tsvector('english', text_content));

-- Insights indexes
CREATE INDEX IF NOT EXISTS idx_insights_meeting_id ON meeting_insights(meeting_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON meeting_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_due_date ON meeting_insights(due_date);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON meeting_insights(priority);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_meeting_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.overview, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.action_items, ' '), '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.topics, ' '), '')), 'D');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for search vector updates
DROP TRIGGER IF EXISTS update_meeting_search_vector_trigger ON meetings;
CREATE TRIGGER update_meeting_search_vector_trigger 
    BEFORE INSERT OR UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_meeting_search_vector();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate participant speaking stats
CREATE OR REPLACE FUNCTION calculate_participant_speaking_stats()
RETURNS TRIGGER AS $$
DECLARE
    total_meeting_duration INTEGER;
    participant_speaking_time INTEGER;
BEGIN
    -- Get total meeting duration
    SELECT duration_seconds INTO total_meeting_duration
    FROM meetings 
    WHERE id = NEW.meeting_id;
    
    -- Calculate speaking time for this participant
    SELECT COALESCE(SUM(segment_duration), 0) INTO participant_speaking_time
    FROM meeting_transcripts 
    WHERE meeting_id = NEW.meeting_id 
    AND speaker_name = NEW.name;
    
    -- Update participant stats
    UPDATE meeting_participants 
    SET 
        speaking_time_seconds = participant_speaking_time,
        speaking_percentage = CASE 
            WHEN total_meeting_duration > 0 THEN 
                ROUND((participant_speaking_time::DECIMAL / total_meeting_duration) * 100, 2)
            ELSE 0 
        END,
        word_count = (
            SELECT COALESCE(SUM(word_count), 0)
            FROM meeting_transcripts 
            WHERE meeting_id = NEW.meeting_id 
            AND speaker_name = NEW.name
        )
    WHERE meeting_id = NEW.meeting_id 
    AND name = NEW.name;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update participant stats when transcripts change
DROP TRIGGER IF EXISTS update_participant_stats_trigger ON meeting_transcripts;
CREATE TRIGGER update_participant_stats_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON meeting_transcripts
    FOR EACH ROW EXECUTE FUNCTION calculate_participant_speaking_stats();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can only see their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can only see participants from their meetings" ON meeting_participants;
DROP POLICY IF EXISTS "Users can only see transcripts from their meetings" ON meeting_transcripts;
DROP POLICY IF EXISTS "Users can only see insights from their meetings" ON meeting_insights;

-- RLS Policies for meetings table
CREATE POLICY "Users can only see their own meetings" ON meetings
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for meeting_participants table
CREATE POLICY "Users can only see participants from their meetings" ON meeting_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM meetings 
            WHERE meetings.id = meeting_participants.meeting_id 
            AND meetings.user_id = auth.uid()
        )
    );

-- RLS Policies for meeting_transcripts table
CREATE POLICY "Users can only see transcripts from their meetings" ON meeting_transcripts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM meetings 
            WHERE meetings.id = meeting_transcripts.meeting_id 
            AND meetings.user_id = auth.uid()
        )
    );

-- RLS Policies for meeting_insights table
CREATE POLICY "Users can only see insights from their meetings" ON meeting_insights
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM meetings 
            WHERE meetings.id = meeting_insights.meeting_id 
            AND meetings.user_id = auth.uid()
        )
    );

-- ============================================
-- HELPFUL VIEWS FOR QUERYING
-- ============================================

-- View for meeting summaries with participant counts
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

-- View for participant analytics
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

-- ============================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================

-- Example queries you can run after data import:

-- 1. Get recent meetings with key info
-- SELECT title, meeting_date, duration_minutes, participant_count, action_item_count 
-- FROM meeting_summaries 
-- WHERE user_id = auth.uid() 
-- ORDER BY meeting_date DESC LIMIT 10;

-- 2. Find meetings with specific keywords
-- SELECT title, keywords, overview 
-- FROM meetings 
-- WHERE user_id = auth.uid() 
-- AND 'strategy' = ANY(keywords);

-- 3. Get top speakers across all meetings
-- SELECT name, meeting_count, avg_speaking_percentage, total_speaking_time_seconds
-- FROM participant_analytics 
-- ORDER BY avg_speaking_percentage DESC;

-- 4. Search meetings by content
-- SELECT title, meeting_date, ts_rank(search_vector, plainto_tsquery('product launch')) as rank
-- FROM meetings 
-- WHERE user_id = auth.uid() 
-- AND search_vector @@ plainto_tsquery('product launch')
-- ORDER BY rank DESC;

-- 5. Get action items due soon
-- SELECT m.title, mi.title as action_item, mi.due_date, mi.priority
-- FROM meeting_insights mi
-- JOIN meetings m ON mi.meeting_id = m.id
-- WHERE m.user_id = auth.uid() 
-- AND mi.insight_type = 'action_item'
-- AND mi.due_date >= CURRENT_DATE
-- ORDER BY mi.due_date;