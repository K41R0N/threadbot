-- Migration: Add prompt_source to bot_configs
-- Allows users to choose between Notion or Agent-generated prompts

ALTER TABLE bot_configs
  ADD COLUMN prompt_source TEXT DEFAULT 'notion' CHECK (prompt_source IN ('notion', 'agent'));

-- Make Notion fields nullable since agent users don't need them
ALTER TABLE bot_configs
  ALTER COLUMN notion_token DROP NOT NULL,
  ALTER COLUMN notion_database_id DROP NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN bot_configs.prompt_source IS 'Source of prompts: notion (default) or agent (AI-generated)';
