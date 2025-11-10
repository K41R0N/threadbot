-- ========================================
-- MIGRATION: Add Webhook Health Tracking
-- Run this in Supabase SQL Editor
-- ========================================

-- Add webhook health tracking columns to bot_configs table
ALTER TABLE bot_configs
ADD COLUMN IF NOT EXISTS last_webhook_setup_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_webhook_status TEXT CHECK (last_webhook_status IN ('success', 'failed')),
ADD COLUMN IF NOT EXISTS last_webhook_error TEXT;

-- Add index for webhook status queries (optional, for better performance)
CREATE INDEX IF NOT EXISTS idx_bot_configs_webhook_status
ON bot_configs(user_id, last_webhook_status);

-- Add comment for documentation
COMMENT ON COLUMN bot_configs.last_webhook_setup_at IS 'Timestamp of last webhook setup attempt';
COMMENT ON COLUMN bot_configs.last_webhook_status IS 'Status of last webhook setup: success or failed';
COMMENT ON COLUMN bot_configs.last_webhook_error IS 'Error message if webhook setup failed';
