-- ========================================
-- FIX: Update telegram_config_complete constraint for shared bot architecture
-- ========================================
-- Problem: Constraint requires both telegram_bot_token and telegram_chat_id to be set together
-- Reality: App uses shared bot, so users only need telegram_chat_id (bot_token is always null)
-- Solution: Update constraint to allow telegram_chat_id without telegram_bot_token
-- ========================================

-- Drop the old constraint
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
-- This reflects the shared bot architecture where bot_token comes from environment
-- Logic: 
--   - Allow telegram_chat_id to be set independently (shared bot users)
--   - Prevent partial config where only telegram_bot_token is set (makes no sense)
--   - Allow both to be null (user hasn't set up Telegram yet)
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
