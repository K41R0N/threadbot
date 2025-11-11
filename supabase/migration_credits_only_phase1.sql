-- ========================================
-- PHASE 1: Credits-Only System Migration
-- Date: 2025-11-11
-- ========================================
-- This migration transitions from tier+credits hybrid to credits-only monetization
-- Safe and reversible - only deprecates tier, doesn't remove it yet

-- ========================================
-- 1. DEPRECATE TIER SYSTEM
-- ========================================

-- Mark tier column as deprecated (keep for Phase 2 removal)
COMMENT ON COLUMN user_subscriptions.tier IS
  'DEPRECATED 2025-11-11: All access now controlled by claude_credits (renamed to generation_credits in UI).
   Tier column preserved for rollback compatibility. Will be removed in Phase 2 after testing.';

-- Set all existing users to 'free' (tier no longer affects access)
-- Move UPDATE inside DO block to correctly capture ROW_COUNT
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_subscriptions
  SET tier = 'free'
  WHERE tier IS DISTINCT FROM 'free';  -- Handles NULL and non-'free' values

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % user(s) to free tier', updated_count;
END $$;

-- ========================================
-- 2. ADD WEEKLY GENERATION TRACKING
-- ========================================

-- Add column to track last free (DeepSeek) generation
-- This enforces "1 free generation per week" limit
-- Users can bypass by spending 1 credit
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS last_free_generation_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_subscriptions.last_free_generation_at IS
  'Timestamp of last free DeepSeek generation. Enforces 7-day cooldown.
   NULL = never generated. Users can bypass cooldown by spending 1 generation credit.';

-- Add index for efficient weekly limit queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_generation_limit
ON user_subscriptions(user_id, last_free_generation_at)
WHERE last_free_generation_at IS NOT NULL;

-- ========================================
-- 3. OPTIMIZE CREDIT QUERIES
-- ========================================

-- Add optimized index for credit-based queries (replaces tier-based access)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits_only
ON user_subscriptions(user_id, claude_credits)
WHERE claude_credits > 0;

-- Mark old tier index as deprecated (will drop in Phase 2)
COMMENT ON INDEX idx_user_subscriptions_tier IS
  'DEPRECATED 2025-11-11: Tier no longer used for access control. Drop in Phase 2.';

-- ========================================
-- 4. UPDATE FUNCTION COMMENTS
-- ========================================

-- Update credit decrement function comment to reflect new naming
COMMENT ON FUNCTION decrement_claude_credits(TEXT) IS
  'Atomically decrements generation credits by 1 for the given user_id.
   NOTE: Function name references "claude" for DB compatibility but now called "generation credits" in UI.
   Used for both Claude Sonnet 4.5 AND bypass of weekly DeepSeek limit.';

-- ========================================
-- 5. MIGRATION SUMMARY
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PHASE 1 MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Tier column deprecated (marked, not dropped)';
  RAISE NOTICE '  ✓ All users set to "free" tier';
  RAISE NOTICE '  ✓ Added last_free_generation_at column';
  RAISE NOTICE '  ✓ Added generation limit index';
  RAISE NOTICE '  ✓ Added credits-only index';
  RAISE NOTICE '  ✓ Updated function comments';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Deploy updated application code';
  RAISE NOTICE '  2. Monitor for 1-2 weeks';
  RAISE NOTICE '  3. Run Phase 2 migration (remove tier column)';
  RAISE NOTICE '========================================';
END $$;
