-- Verification codes table for Telegram chat ID linking
-- Allows users to verify their Telegram account by sending a code to the bot

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

-- Clean up expired codes (run periodically or via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM telegram_verification_codes
  WHERE expires_at < NOW() AND used_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE telegram_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification codes" ON telegram_verification_codes
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can insert own verification codes" ON telegram_verification_codes
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

