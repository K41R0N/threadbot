-- Threadbot Database Schema for Supabase (PostgreSQL)

-- Bot configurations table (one per user)
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE, -- Clerk user ID
  notion_token TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  telegram_bot_token TEXT NOT NULL,
  telegram_chat_id TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  morning_time TEXT NOT NULL DEFAULT '12:00',
  evening_time TEXT NOT NULL DEFAULT '17:00',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bot state table (tracks last sent prompts)
CREATE TABLE IF NOT EXISTS bot_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE, -- Clerk user ID
  last_prompt_type TEXT, -- 'morning' or 'evening'
  last_prompt_sent_at TIMESTAMPTZ,
  last_prompt_page_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_configs_is_active ON bot_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_state_user_id ON bot_state(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_bot_configs_updated_at BEFORE UPDATE ON bot_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_state_updated_at BEFORE UPDATE ON bot_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_state ENABLE ROW LEVEL SECURITY;

-- Users can only access their own bot config
CREATE POLICY "Users can view own bot config" ON bot_configs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own bot config" ON bot_configs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own bot config" ON bot_configs
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Users can only access their own bot state
CREATE POLICY "Users can view own bot state" ON bot_state
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own bot state" ON bot_state
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own bot state" ON bot_state
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);
