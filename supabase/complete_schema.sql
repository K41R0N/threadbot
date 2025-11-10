-- ========================================
-- THREADBOT - COMPLETE SCHEMA SETUP
-- Run this in Supabase SQL Editor to set up everything
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 0. MIGRATIONS (for existing tables)
-- ========================================

-- Add claude_credits to existing user_subscriptions table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
    ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS claude_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add prompt_source to existing bot_configs table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_configs') THEN
    ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS prompt_source TEXT DEFAULT 'agent' CHECK (prompt_source IN ('notion', 'agent'));
  END IF;
END $$;

-- Add webhook health tracking to existing bot_configs table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bot_configs') THEN
    ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS last_webhook_setup_at TIMESTAMPTZ;
    ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS last_webhook_status TEXT CHECK (last_webhook_status IN ('success', 'failed'));
    ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS last_webhook_error TEXT;
  END IF;
END $$;

-- Add onboarding completion tracking to existing user_subscriptions table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
    ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ========================================
-- 1. CORE BOT CONFIGURATION TABLES
-- ========================================

-- Bot configurations (Notion + Telegram integration)
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  notion_token TEXT,
  notion_database_id TEXT,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  morning_time TEXT DEFAULT '08:00',
  evening_time TEXT DEFAULT '20:00',
  is_active BOOLEAN DEFAULT false,
  prompt_source TEXT DEFAULT 'agent' CHECK (prompt_source IN ('notion', 'agent')),
  last_webhook_setup_at TIMESTAMPTZ,
  last_webhook_status TEXT CHECK (last_webhook_status IN ('success', 'failed')),
  last_webhook_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot state tracking (for reply handling)
CREATE TABLE IF NOT EXISTS bot_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  last_prompt_type TEXT CHECK (last_prompt_type IN ('morning', 'evening')),
  last_prompt_sent_at TIMESTAMPTZ,
  last_prompt_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 2. AI AGENT PROMPT GENERATION TABLES
-- ========================================

-- User prompts (AI-generated calendar)
CREATE TABLE IF NOT EXISTS user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  week_theme TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('morning', 'evening')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  prompts TEXT[] NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, post_type)
);

-- User generation context (brand voice, URLs, etc.)
CREATE TABLE IF NOT EXISTS user_generation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  brand_urls TEXT[],
  competitor_urls TEXT[],
  brand_voice TEXT,
  tone_attributes JSONB,
  target_audience TEXT,
  core_themes TEXT[],
  uploaded_files JSONB,
  last_analysis_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly themes for each generation
CREATE TABLE IF NOT EXISTS user_weekly_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  month_year TEXT NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  theme_title TEXT NOT NULL,
  theme_description TEXT,
  keywords TEXT[],
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, month_year, week_number)
);

-- Track agent generation jobs
CREATE TABLE IF NOT EXISTS agent_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'analyzing', 'generating_themes', 'generating_prompts', 'completed', 'failed')),
  model_used TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_prompts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 3. SUBSCRIPTION & CREDITS SYSTEM
-- ========================================

-- User subscriptions (credit-based system)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  claude_credits INTEGER NOT NULL DEFAULT 0,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_skipped BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 4. FUNCTIONS
-- ========================================

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Atomic credit decrement function
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

-- ========================================
-- 5. TRIGGERS
-- ========================================

-- Bot configs
DROP TRIGGER IF EXISTS update_bot_configs_updated_at ON bot_configs;
CREATE TRIGGER update_bot_configs_updated_at
  BEFORE UPDATE ON bot_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bot state
DROP TRIGGER IF EXISTS update_bot_state_updated_at ON bot_state;
CREATE TRIGGER update_bot_state_updated_at
  BEFORE UPDATE ON bot_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User prompts
DROP TRIGGER IF EXISTS update_user_prompts_updated_at ON user_prompts;
CREATE TRIGGER update_user_prompts_updated_at
  BEFORE UPDATE ON user_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User generation context
DROP TRIGGER IF EXISTS update_user_generation_context_updated_at ON user_generation_context;
CREATE TRIGGER update_user_generation_context_updated_at
  BEFORE UPDATE ON user_generation_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User weekly themes
DROP TRIGGER IF EXISTS update_user_weekly_themes_updated_at ON user_weekly_themes;
CREATE TRIGGER update_user_weekly_themes_updated_at
  BEFORE UPDATE ON user_weekly_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Agent generation jobs
DROP TRIGGER IF EXISTS update_agent_generation_jobs_updated_at ON agent_generation_jobs;
CREATE TRIGGER update_agent_generation_jobs_updated_at
  BEFORE UPDATE ON agent_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- User subscriptions
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6. INDEXES
-- ========================================

-- Bot configs
CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_configs_is_active ON bot_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_configs_prompt_source ON bot_configs(prompt_source);

-- Bot state
CREATE INDEX IF NOT EXISTS idx_bot_state_user_id ON bot_state(user_id);

-- User prompts
CREATE INDEX IF NOT EXISTS idx_user_prompts_user_date ON user_prompts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_prompts_status ON user_prompts(status);
CREATE INDEX IF NOT EXISTS idx_user_prompts_date ON user_prompts(date);

-- User generation context
CREATE INDEX IF NOT EXISTS idx_user_generation_context_user_id ON user_generation_context(user_id);

-- User weekly themes
CREATE INDEX IF NOT EXISTS idx_user_weekly_themes_user_month ON user_weekly_themes(user_id, month_year);

-- Agent generation jobs
CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_status ON agent_generation_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_created_at ON agent_generation_jobs(created_at DESC);

-- User subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits ON user_subscriptions(user_id, claude_credits);

-- ========================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ========================================
-- NOTE: All queries use service_role key which bypasses RLS
-- These policies are here for reference and future client-side queries

ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_generation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Bot configs policies
DROP POLICY IF EXISTS "Users can view own bot config" ON bot_configs;
CREATE POLICY "Users can view own bot config" ON bot_configs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Users can update own bot config" ON bot_configs;
CREATE POLICY "Users can update own bot config" ON bot_configs
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Bot state policies
DROP POLICY IF EXISTS "Users can view own bot state" ON bot_state;
CREATE POLICY "Users can view own bot state" ON bot_state
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- User prompts policies
DROP POLICY IF EXISTS "Users can manage own prompts" ON user_prompts;
CREATE POLICY "Users can manage own prompts" ON user_prompts
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- User generation context policies
DROP POLICY IF EXISTS "Users can manage own context" ON user_generation_context;
CREATE POLICY "Users can manage own context" ON user_generation_context
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- User weekly themes policies
DROP POLICY IF EXISTS "Users can manage own themes" ON user_weekly_themes;
CREATE POLICY "Users can manage own themes" ON user_weekly_themes
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- Agent generation jobs policies
DROP POLICY IF EXISTS "Users can view own jobs" ON agent_generation_jobs;
CREATE POLICY "Users can view own jobs" ON agent_generation_jobs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- User subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- ========================================
-- 8. GRANTS
-- ========================================

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;

-- ========================================
-- 9. COMMENTS (Documentation)
-- ========================================

COMMENT ON TABLE bot_configs IS 'User bot configurations for Notion/Telegram integration';
COMMENT ON TABLE bot_state IS 'Tracks last sent prompt for reply handling';
COMMENT ON TABLE user_prompts IS 'AI-generated prompt calendar (alternative to Notion)';
COMMENT ON TABLE user_generation_context IS 'User brand voice and analysis context';
COMMENT ON TABLE user_weekly_themes IS 'Monthly weekly themes for prompt generation';
COMMENT ON TABLE agent_generation_jobs IS 'Tracks AI generation job status';
COMMENT ON TABLE user_subscriptions IS 'User tier and Claude credits';

COMMENT ON COLUMN user_subscriptions.claude_credits IS 'Number of Claude Sonnet 4.5 generation credits remaining (1 credit = 60 prompts)';
COMMENT ON COLUMN bot_configs.prompt_source IS 'Source of prompts: "notion" (legacy) or "agent" (AI-generated)';

COMMENT ON FUNCTION decrement_claude_credits(TEXT) IS 'Atomically decrements claude_credits by 1 for the given user_id';
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to auto-update updated_at timestamp';

-- ========================================
-- SETUP COMPLETE
-- ========================================
