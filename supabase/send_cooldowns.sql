-- Send Cooldowns Table
-- Tracks "Send Now" button usage to prevent Telegram API abuse

CREATE TABLE IF NOT EXISTS send_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  cooldown_key TEXT NOT NULL, -- Format: "send:{userId}:{date}:{type}"
  send_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, cooldown_key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_send_cooldowns_user_id
ON send_cooldowns(user_id);

CREATE INDEX IF NOT EXISTS idx_send_cooldowns_key
ON send_cooldowns(user_id, cooldown_key);

CREATE INDEX IF NOT EXISTS idx_send_cooldowns_last_sent
ON send_cooldowns(last_sent_at);

-- Auto-update updated_at timestamp
CREATE TRIGGER update_send_cooldowns_updated_at
BEFORE UPDATE ON send_cooldowns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for old records (run daily via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_old_send_cooldowns()
RETURNS void AS $$
BEGIN
  -- Delete records older than 7 days
  DELETE FROM send_cooldowns
  WHERE last_sent_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (defense in depth)
ALTER TABLE send_cooldowns ENABLE ROW LEVEL SECURITY;

-- Users can only view their own cooldowns
CREATE POLICY "Users can view own cooldowns" ON send_cooldowns
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- Comments for documentation
COMMENT ON TABLE send_cooldowns IS
  'Tracks "Send Now" button usage to prevent Telegram API spam. Limits: 10 sends/hour, 30s between sends.';

COMMENT ON COLUMN send_cooldowns.cooldown_key IS
  'Unique key per prompt (format: send:{userId}:{date}:{type})';

COMMENT ON COLUMN send_cooldowns.send_count IS
  'Number of sends in current hour. Resets after 1 hour of inactivity.';

COMMENT ON FUNCTION cleanup_old_send_cooldowns() IS
  'Cleanup function for old send cooldown records. Run daily.';
