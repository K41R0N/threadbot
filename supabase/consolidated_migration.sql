-- ========================================
-- THREADBOT - CONSOLIDATED MIGRATION
-- Run this in Supabase SQL Editor to update everything
-- This migration is idempotent (safe to run multiple times)
-- ========================================

-- ========================================
-- 1. UPDATE bot_configs FOR SHARED BOT
-- ========================================

-- Make telegram_bot_token nullable (we're using shared bot from environment)
DO $$
BEGIN
  -- Check if column exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bot_configs' 
    AND column_name = 'telegram_bot_token'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bot_configs ALTER COLUMN telegram_bot_token DROP NOT NULL;
  END IF;
END $$;

-- Ensure prompt_source column exists (for agent/notion selection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bot_configs' 
    AND column_name = 'prompt_source'
  ) THEN
    ALTER TABLE bot_configs 
      ADD COLUMN prompt_source TEXT DEFAULT 'agent' 
      CHECK (prompt_source IN ('notion', 'agent'));
  END IF;
END $$;

-- Ensure webhook health tracking columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bot_configs' 
    AND column_name = 'last_webhook_setup_at'
  ) THEN
    ALTER TABLE bot_configs
      ADD COLUMN last_webhook_setup_at TIMESTAMPTZ,
      ADD COLUMN last_webhook_status TEXT CHECK (last_webhook_status IN ('success', 'failed')),
      ADD COLUMN last_webhook_error TEXT;
  END IF;
END $$;

-- Make Notion fields nullable (agent users don't need them)
DO $$
BEGIN
  -- Check if notion_token exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bot_configs' 
    AND column_name = 'notion_token'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bot_configs ALTER COLUMN notion_token DROP NOT NULL;
  END IF;
  
  -- Check if notion_database_id exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bot_configs' 
    AND column_name = 'notion_database_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bot_configs ALTER COLUMN notion_database_id DROP NOT NULL;
  END IF;
END $$;

-- ========================================
-- 2. CREATE telegram_verification_codes TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS telegram_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  code TEXT NOT NULL, -- 6-digit verification code
  chat_id TEXT, -- Telegram chat ID (set when code is verified)
  timezone TEXT, -- User's detected timezone (optional, for auto-configuration)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON telegram_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON telegram_verification_codes(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON telegram_verification_codes(expires_at);

-- Clean up expired codes function
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_verification_codes
  WHERE expires_at < NOW() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security for verification codes
ALTER TABLE telegram_verification_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own verification codes" ON telegram_verification_codes;
DROP POLICY IF EXISTS "Users can insert own verification codes" ON telegram_verification_codes;
DROP POLICY IF EXISTS "Service role can update all verification codes" ON telegram_verification_codes;

-- Users can view their own verification codes
CREATE POLICY "Users can view own verification codes" ON telegram_verification_codes
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- Users can insert their own verification codes
CREATE POLICY "Users can insert own verification codes" ON telegram_verification_codes
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Service role can update any code (for webhook linking)
-- This policy is for the server-side webhook, which uses the service role key
CREATE POLICY "Service role can update all verification codes" ON telegram_verification_codes
  FOR UPDATE USING (TRUE);

-- ========================================
-- 3. ENSURE ALL CORE TABLES EXIST
-- ========================================

-- Bot configs table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  notion_token TEXT,
  notion_database_id TEXT,
  telegram_bot_token TEXT, -- Nullable for shared bot
  telegram_chat_id TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  morning_time TEXT DEFAULT '09:00',
  evening_time TEXT DEFAULT '18:00',
  is_active BOOLEAN DEFAULT false,
  prompt_source TEXT DEFAULT 'agent' CHECK (prompt_source IN ('notion', 'agent')),
  last_webhook_setup_at TIMESTAMPTZ,
  last_webhook_status TEXT CHECK (last_webhook_status IN ('success', 'failed')),
  last_webhook_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot state table
CREATE TABLE IF NOT EXISTS bot_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  last_prompt_type TEXT CHECK (last_prompt_type IN ('morning', 'evening')),
  last_prompt_sent_at TIMESTAMPTZ,
  last_prompt_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User prompts table (AI-generated calendar)
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

-- User generation context table
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

-- User weekly themes table
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

-- Agent generation jobs table
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

-- User subscriptions table
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
-- 4. CREATE/UPDATE FUNCTIONS
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
-- 5. CREATE/UPDATE TRIGGERS
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
-- 6. CREATE/UPDATE INDEXES
-- ========================================

-- Bot configs indexes
CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_configs_is_active ON bot_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_configs_prompt_source ON bot_configs(prompt_source);
CREATE INDEX IF NOT EXISTS idx_bot_configs_webhook_status ON bot_configs(user_id, last_webhook_status);

-- Bot state indexes
CREATE INDEX IF NOT EXISTS idx_bot_state_user_id ON bot_state(user_id);

-- User prompts indexes
CREATE INDEX IF NOT EXISTS idx_user_prompts_user_date ON user_prompts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_prompts_status ON user_prompts(status);
CREATE INDEX IF NOT EXISTS idx_user_prompts_date ON user_prompts(date);

-- User generation context indexes
CREATE INDEX IF NOT EXISTS idx_user_generation_context_user_id ON user_generation_context(user_id);

-- User weekly themes indexes
CREATE INDEX IF NOT EXISTS idx_user_weekly_themes_user_month ON user_weekly_themes(user_id, month_year);

-- Agent generation jobs indexes
CREATE INDEX IF NOT EXISTS idx_agent_jobs_user_status ON agent_generation_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_jobs_created_at ON agent_generation_jobs(created_at DESC);

-- User subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits ON user_subscriptions(user_id, claude_credits);

-- ========================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_generation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 8. CREATE/UPDATE RLS POLICIES
-- ========================================

-- Bot configs policies
DROP POLICY IF EXISTS "Users can view own bot config" ON bot_configs;
CREATE POLICY "Users can view own bot config" ON bot_configs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Users can update own bot config" ON bot_configs;
CREATE POLICY "Users can update own bot config" ON bot_configs
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

DROP POLICY IF EXISTS "Users can insert own bot config" ON bot_configs;
CREATE POLICY "Users can insert own bot config" ON bot_configs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

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
-- 9. SECURITY FIX: schema_migrations RLS
-- ========================================

-- Enable RLS on schema_migrations table for security compliance
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from anon and authenticated roles
-- This prevents any client access via PostgREST, which is appropriate for operational tables
REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated;

-- Add a comment explaining the security posture
COMMENT ON TABLE public.schema_migrations IS 
  'Operational table for tracking Supabase migrations. RLS enabled and client access revoked for security.';

-- ========================================
-- 10. GRANT PERMISSIONS
-- ========================================

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_claude_credits(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_verification_codes() TO service_role;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================

-- Verify key tables exist
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'bot_configs',
      'bot_state',
      'user_prompts',
      'user_generation_context',
      'user_weekly_themes',
      'agent_generation_jobs',
      'user_subscriptions',
      'telegram_verification_codes'
    );
  
  IF table_count < 8 THEN
    RAISE NOTICE 'Warning: Expected 8 tables, found %', table_count;
  ELSE
    RAISE NOTICE 'Success: All 8 core tables exist';
  END IF;
END $$;

