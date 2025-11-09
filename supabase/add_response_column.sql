-- Migration: Add response column to user_prompts table
-- This allows storing Telegram replies in the agent database

ALTER TABLE user_prompts
  ADD COLUMN IF NOT EXISTS response TEXT;

COMMENT ON COLUMN user_prompts.response IS 'User''s reply from Telegram (supports multiple replies separated by ----)';
