-- Webhook Events Table for Linear Integration
-- This table stores webhook events from Linear for processing and audit trail

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Service and event info
  service TEXT NOT NULL CHECK (service IN ('linear', 'slack', 'google', 'fireflies')),
  event_type TEXT NOT NULL, -- 'issue', 'comment', 'project', 'cycle', etc.
  action TEXT NOT NULL, -- 'create', 'update', 'remove', etc.
  
  -- External reference
  external_id TEXT NOT NULL, -- The ID from the external service
  
  -- Event data
  data JSONB NOT NULL, -- The full webhook payload data
  url TEXT, -- URL to view the resource (if provided)
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Metadata
  webhook_id TEXT, -- Linear webhook ID
  delivery_id TEXT, -- Webhook delivery ID for deduplication
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_service ON webhook_events(service);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON webhook_events(external_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_delivery_id ON webhook_events(delivery_id);

-- Unique constraint to prevent duplicate webhook deliveries
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_unique_delivery 
ON webhook_events(service, delivery_id) 
WHERE delivery_id IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON webhook_events;
CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 