-- ========================================
-- COMPLETE DATABASE FIX - Run This First
-- ========================================
-- Fixes two issues:
-- 1. telegram_config_complete constraint (allows ChatID without bot token)
-- 2. Missing timezone column in telegram_verification_codes table
-- ========================================
-- This migration is idempotent (safe to run multiple times)
-- ========================================

-- ========================================
-- FIX 1: Update telegram_config_complete constraint
-- ========================================
-- Problem: Constraint requires both telegram_bot_token and telegram_chat_id
-- Solution: Allow telegram_chat_id without telegram_bot_token (shared bot architecture)

-- Drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'telegram_config_complete' 
    AND table_name = 'bot_configs'
  ) THEN
    ALTER TABLE bot_configs DROP CONSTRAINT telegram_config_complete;
  END IF;
END $$;

-- Add new constraint that allows telegram_chat_id without telegram_bot_token
ALTER TABLE bot_configs
  ADD CONSTRAINT telegram_config_complete
  CHECK (
    -- Case 1: Both null (user hasn't set up Telegram)
    (telegram_bot_token IS NULL AND telegram_chat_id IS NULL)
    OR
    -- Case 2: Only chat_id is set (shared bot - most common case)
    (telegram_bot_token IS NULL AND telegram_chat_id IS NOT NULL)
    OR
    -- Case 3: Both are set (legacy per-user bot support, if needed)
    (telegram_bot_token IS NOT NULL AND telegram_chat_id IS NOT NULL)
    -- Case 4: Only bot_token is set - NOT ALLOWED (makes no sense)
  );

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT telegram_config_complete ON bot_configs IS 
  'Allows telegram_chat_id without telegram_bot_token (shared bot architecture). Prevents partial configs where only bot_token is set.';

-- ========================================
-- FIX 2: Add timezone column to telegram_verification_codes
-- ========================================
-- Problem: Code tries to insert/select timezone column but it doesn't exist
-- Solution: Add timezone column if it doesn't exist

-- Check if telegram_verification_codes table exists, create if not
CREATE TABLE IF NOT EXISTS telegram_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  chat_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add timezone column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_verification_codes' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE telegram_verification_codes 
      ADD COLUMN timezone TEXT;
    
    COMMENT ON COLUMN telegram_verification_codes.timezone IS 
      'User''s detected timezone (optional, for auto-configuration)';
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id 
  ON telegram_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code 
  ON telegram_verification_codes(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires 
  ON telegram_verification_codes(expires_at);

-- Ensure cleanup function exists
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_verification_codes
  WHERE expires_at < NOW() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Ensure RLS is enabled
ALTER TABLE telegram_verification_codes ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own verification codes" ON telegram_verification_codes;
DROP POLICY IF EXISTS "Users can insert own verification codes" ON telegram_verification_codes;
DROP POLICY IF EXISTS "Service role can update all verification codes" ON telegram_verification_codes;

CREATE POLICY "Users can view own verification codes" ON telegram_verification_codes
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own verification codes" ON telegram_verification_codes
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Service role can update all verification codes" ON telegram_verification_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ========================================
-- VERIFICATION
-- ========================================
-- Run these queries to verify the fixes:

-- 1. Check constraint exists and is correct
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'telegram_config_complete';

-- 2. Check timezone column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'telegram_verification_codes' 
AND column_name = 'timezone';

-- Both should return results if fixes are applied correctly
