-- Fix for duration_minutes column error
-- Run this in your Supabase SQL Editor

-- First, drop the generated column
ALTER TABLE meetings DROP COLUMN IF EXISTS duration_minutes;

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