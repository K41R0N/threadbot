-- ========================================
-- FIX: Add missing notion_token column
-- ========================================
-- Run this FIRST before running complete_schema.sql

-- Add notion_token column to bot_configs if it doesn't exist
ALTER TABLE bot_configs 
ADD COLUMN IF NOT EXISTS notion_token TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_bot_configs_notion_token 
ON bot_configs(notion_token) 
WHERE notion_token IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bot_configs'
AND column_name = 'notion_token';
