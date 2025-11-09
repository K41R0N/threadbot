-- Migration: Allow partial bot configuration for multi-step onboarding
-- This allows users to complete setup in steps (Notion → Telegram → Schedule)

-- Make telegram fields nullable since they're added in step 2
ALTER TABLE bot_configs
  ALTER COLUMN telegram_bot_token DROP NOT NULL,
  ALTER COLUMN telegram_chat_id DROP NOT NULL;

-- Add a check constraint to ensure if one is set, both are set
-- (Prevents partial Telegram configuration)
ALTER TABLE bot_configs
  ADD CONSTRAINT telegram_config_complete
  CHECK (
    (telegram_bot_token IS NULL AND telegram_chat_id IS NULL)
    OR
    (telegram_bot_token IS NOT NULL AND telegram_chat_id IS NOT NULL)
  );
