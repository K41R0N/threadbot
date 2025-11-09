-- ========================================
-- AGENTIC PROMPT GENERATION SCHEMA
-- ========================================

-- User prompt calendars (alternative to Notion)
CREATE TABLE user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  week_theme TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('morning', 'evening')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  prompts TEXT[] NOT NULL, -- Array of 5 prompts
  response TEXT, -- User's reply from Telegram
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Composite unique constraint: one morning and one evening per day per user
  UNIQUE(user_id, date, post_type)
);

-- User generation context (brand voice, URLs, etc.)
CREATE TABLE user_generation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  brand_urls TEXT[],
  competitor_urls TEXT[],
  brand_voice TEXT,
  tone_attributes JSONB, -- { formal/casual, professional/friendly, etc. }
  target_audience TEXT,
  core_themes TEXT[],
  uploaded_files JSONB, -- References to Vercel Blob storage
  last_analysis_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly themes for each generation
CREATE TABLE user_weekly_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  month_year TEXT NOT NULL, -- Format: "2025-11"
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
CREATE TABLE agent_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'analyzing', 'generating_themes', 'generating_prompts', 'completed', 'failed')),
  model_used TEXT NOT NULL, -- 'deepseek-r1' or 'claude-sonnet-4.5'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_prompts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscription tiers
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_prompts_user_date ON user_prompts(user_id, date);
CREATE INDEX idx_user_prompts_status ON user_prompts(status);
CREATE INDEX idx_agent_jobs_user_status ON agent_generation_jobs(user_id, status);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX idx_user_weekly_themes_user_month ON user_weekly_themes(user_id, month_year);

-- Auto-update triggers
CREATE TRIGGER update_user_prompts_updated_at BEFORE UPDATE ON user_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_generation_context_updated_at BEFORE UPDATE ON user_generation_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_weekly_themes_updated_at BEFORE UPDATE ON user_weekly_themes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_generation_jobs_updated_at BEFORE UPDATE ON agent_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE user_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_generation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_weekly_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service role bypasses these)
CREATE POLICY "Users can view own prompts" ON user_prompts
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own prompts" ON user_prompts
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own prompts" ON user_prompts
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can delete own prompts" ON user_prompts
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- Similar policies for other tables
CREATE POLICY "Users can manage own context" ON user_generation_context
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can manage own themes" ON user_weekly_themes
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can view own jobs" ON agent_generation_jobs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);
