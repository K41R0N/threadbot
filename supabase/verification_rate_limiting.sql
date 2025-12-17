-- Verification Rate Limiting Table
-- Tracks verification code attempts per chat_id to prevent brute-force attacks

CREATE TABLE IF NOT EXISTS verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL UNIQUE, -- Telegram chat ID
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ, -- Optional lockout period
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_verification_attempts_chat_id
ON verification_attempts(chat_id);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_verification_attempts_locked_until
ON verification_attempts(locked_until) WHERE locked_until IS NOT NULL;

-- Auto-update updated_at timestamp
CREATE TRIGGER update_verification_attempts_updated_at
BEFORE UPDATE ON verification_attempts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for old records (run daily via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_old_verification_attempts()
RETURNS void AS $$
BEGIN
  -- Delete records older than 7 days with no recent activity
  DELETE FROM verification_attempts
  WHERE last_attempt_at < NOW() - INTERVAL '7 days';

  -- Reset attempt counts for records older than 1 hour
  UPDATE verification_attempts
  SET attempt_count = 0,
      locked_until = NULL
  WHERE last_attempt_at < NOW() - INTERVAL '1 hour'
    AND attempt_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (even though this is server-side only, defense in depth)
ALTER TABLE verification_attempts ENABLE ROW LEVEL SECURITY;

-- No client policies needed - server role only
-- Service role bypasses RLS anyway, but this prevents accidental client access

-- Comments for documentation
COMMENT ON TABLE verification_attempts IS
  'Tracks verification code attempts per Telegram chat_id to prevent brute-force attacks. Resets after 1 hour.';

COMMENT ON COLUMN verification_attempts.attempt_count IS
  'Number of failed verification attempts. Resets after 1 hour of inactivity.';

COMMENT ON COLUMN verification_attempts.locked_until IS
  'If set, chat_id is locked from attempting verification until this timestamp.';

COMMENT ON FUNCTION cleanup_old_verification_attempts() IS
  'Cleanup function for old verification attempt records. Run daily.';
