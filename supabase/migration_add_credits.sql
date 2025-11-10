-- ========================================
-- MIGRATION: Add Claude Credits to Existing Tables
-- Run this FIRST if your tables already exist
-- ========================================

-- Add claude_credits column to existing user_subscriptions table
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS claude_credits INTEGER NOT NULL DEFAULT 0;

-- Create or replace the atomic credit decrement function
CREATE OR REPLACE FUNCTION decrement_claude_credits(user_id_param TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- First ensure a subscription row exists
  INSERT INTO user_subscriptions (user_id, tier, claude_credits)
  VALUES (user_id_param, 'free', 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Perform a guarded atomic update: only decrement if credits > 0
  UPDATE user_subscriptions
  SET claude_credits = claude_credits - 1
  WHERE user_id = user_id_param AND claude_credits > 0;

  -- Check how many rows were affected
  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  -- If no rows were updated, credits are exhausted
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Insufficient credits: User % has no Claude credits remaining', user_id_param;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO service_role;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits
ON user_subscriptions(user_id, claude_credits);

-- Add documentation
COMMENT ON COLUMN user_subscriptions.claude_credits IS 'Number of Claude Sonnet 4.5 generation credits remaining (1 credit = 60 prompts)';
COMMENT ON FUNCTION decrement_claude_credits(TEXT) IS 'Atomically decrements claude_credits by 1 for the given user_id';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully: claude_credits column added';
END $$;
