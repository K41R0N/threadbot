-- ========================================
-- ADD CLAUDE CREDITS SYSTEM
-- Migration: Add credit-based subscription model
-- ========================================

-- Add claude_credits column to user_subscriptions
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS claude_credits INTEGER NOT NULL DEFAULT 0;

-- Create function to atomically decrement claude credits
CREATE OR REPLACE FUNCTION decrement_claude_credits(user_id_param TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET claude_credits = GREATEST(claude_credits - 1, 0)
  WHERE user_id = user_id_param;

  -- If no subscription exists, create one with 0 credits
  IF NOT FOUND THEN
    INSERT INTO user_subscriptions (user_id, tier, claude_credits)
    VALUES (user_id_param, 'free', 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO service_role;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits
ON user_subscriptions(user_id, claude_credits);

-- Add comment for documentation
COMMENT ON COLUMN user_subscriptions.claude_credits IS 'Number of Claude Sonnet 4.5 generation credits remaining (1 credit = 60 prompts)';
COMMENT ON FUNCTION decrement_claude_credits(TEXT) IS 'Atomically decrements claude_credits by 1 for the given user_id';
