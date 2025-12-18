# Database Migration Fix

**Created**: 2025-11-17
**Issue**: Missing database migrations causing multiple errors

---

## **Quick Diagnosis**

Run this query in Supabase SQL Editor to check if migrations have been applied:

```sql
-- Check if prompt_source column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'bot_configs'
  AND column_name = 'prompt_source';

-- Check if last_free_generation_at column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_subscriptions'
  AND column_name = 'last_free_generation_at';
```

**Expected Results:**
- ✅ Both queries return exactly one row
- ❌ If empty: Migration hasn't been run

---

## **Issue 1: Missing `prompt_source` Column**

### **Symptoms:**
- Prompt source toggle in Settings doesn't work
- Test function always uses Notion regardless of selection
- Database not updating when switching between Notion/Agent

### **Root Cause:**
Migration `add_prompt_source.sql` not run on production database

### **Fix:**
Run this SQL in Supabase SQL Editor:

```sql
-- Add prompt_source to bot_configs
ALTER TABLE bot_configs
  ADD COLUMN IF NOT EXISTS prompt_source TEXT DEFAULT 'notion' CHECK (prompt_source IN ('notion', 'agent'));

-- Make Notion fields nullable (agent users don't need them)
ALTER TABLE bot_configs
  ALTER COLUMN notion_token DROP NOT NULL,
  ALTER COLUMN notion_database_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN bot_configs.prompt_source IS 'Source of prompts: notion (default) or agent (AI-generated)';

-- Verify migration succeeded
SELECT user_id, prompt_source, is_active
FROM bot_configs
LIMIT 5;
```

**Expected Output:**
- ✅ Query succeeds without errors
- ✅ All existing rows have `prompt_source = 'notion'` (default)
- ✅ You can now switch to 'agent' in Settings

---

## **Issue 2: Missing `last_free_generation_at` Column**

### **Symptoms:**
- Error: `column user_subscriptions.last_free_generation_at does not exist`
- Agent generation endpoints failing
- Vercel logs showing repeated database errors

### **Root Cause:**
Migration `migration_credits_only_phase1.sql` not run on production database

### **Fix:**
Run this SQL in Supabase SQL Editor:

```sql
-- ========================================
-- CREDITS-ONLY SYSTEM MIGRATION (Phase 1)
-- ========================================

-- 1. Deprecate tier system (keep column for rollback)
COMMENT ON COLUMN user_subscriptions.tier IS
  'DEPRECATED 2025-11-11: All access now controlled by claude_credits (renamed to generation_credits in UI).
   Tier column preserved for rollback compatibility. Will be removed in Phase 2 after testing.';

-- 2. Set all users to 'free' (tier no longer affects access)
UPDATE user_subscriptions
SET tier = 'free'
WHERE tier IS DISTINCT FROM 'free';

-- 3. Add weekly generation tracking column
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS last_free_generation_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_subscriptions.last_free_generation_at IS
  'Timestamp of last free DeepSeek generation. Enforces 7-day cooldown.
   NULL = never generated. Users can bypass cooldown by spending 1 generation credit.';

-- 4. Add index for efficient weekly limit queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_generation_limit
ON user_subscriptions(user_id, last_free_generation_at)
WHERE last_free_generation_at IS NOT NULL;

-- 5. Add optimized index for credit-based queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits_only
ON user_subscriptions(user_id, claude_credits)
WHERE claude_credits > 0;

-- 6. Update function comments
COMMENT ON FUNCTION decrement_claude_credits(TEXT) IS
  'Atomically decrements generation credits by 1 for the given user_id.
   NOTE: Function name references "claude" for DB compatibility but now called "generation credits" in UI.
   Used for both Claude Sonnet 4.5 AND bypass of weekly DeepSeek limit.';

-- 7. Verify migration succeeded
SELECT
  user_id,
  tier,
  claude_credits,
  last_free_generation_at
FROM user_subscriptions
LIMIT 5;
```

**Expected Output:**
- ✅ Query succeeds without errors
- ✅ All existing rows have `last_free_generation_at = NULL` (default)
- ✅ All users have `tier = 'free'`
- ✅ Agent generation endpoints now work

---

## **Verification**

After running both migrations, verify everything works:

### **1. Check Column Existence**
```sql
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name IN ('bot_configs', 'user_subscriptions')
  AND column_name IN ('prompt_source', 'last_free_generation_at')
ORDER BY table_name, column_name;
```

**Expected Output:**
```
table_name          | column_name               | data_type | column_default
--------------------|---------------------------|-----------|---------------
bot_configs         | prompt_source             | text      | 'notion'::text
user_subscriptions  | last_free_generation_at   | timestamp | NULL
```

### **2. Test Prompt Source Toggle**
1. Go to `/settings` page
2. Change "Prompt Source" from "Notion" to "AI Agent"
3. Save changes
4. Run this query:

```sql
SELECT user_id, prompt_source, is_active
FROM bot_configs
WHERE user_id = 'YOUR_CLERK_USER_ID';
```

**Expected Output:**
- ✅ `prompt_source = 'agent'`

### **3. Test Agent Generation**
1. Go to `/agent/create` page
2. Click "Generate Prompts"
3. Should complete without errors

---

## **Why Migrations Weren't Run**

Possible reasons:
1. **Manual deployment**: Migrations require manual execution in Supabase SQL Editor
2. **Schema drift**: Production database diverged from migration files
3. **Incomplete setup**: Initial schema setup missed these migrations

---

## **Best Practices Going Forward**

### **Track Migration Status**
Create a migrations tracking table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by TEXT,
  checksum TEXT
);

-- Record these migrations
INSERT INTO schema_migrations (migration_name, applied_by)
VALUES
  ('add_prompt_source', 'manual'),
  ('migration_credits_only_phase1', 'manual')
ON CONFLICT (migration_name) DO NOTHING;
```

### **Before Deploying New Features**
1. Check if migration files exist in `supabase/` directory
2. Compare schema with production database
3. Run migrations in Supabase SQL Editor
4. Verify with test queries
5. Deploy application code

---

## **Troubleshooting**

### **Migration Failed with Error**
If you get errors when running migrations:

**Error: "column already exists"**
```sql
-- Safe version using IF NOT EXISTS
ALTER TABLE bot_configs
  ADD COLUMN IF NOT EXISTS prompt_source TEXT DEFAULT 'notion';
```

**Error: "constraint already exists"**
```sql
-- Drop old constraint first
ALTER TABLE bot_configs
  DROP CONSTRAINT IF EXISTS bot_configs_prompt_source_check;

-- Add new constraint
ALTER TABLE bot_configs
  ADD CONSTRAINT bot_configs_prompt_source_check
  CHECK (prompt_source IN ('notion', 'agent'));
```

### **Data Integrity Check**
After migration, ensure no NULL values where they shouldn't be:

```sql
-- Check for NULL prompt_source (should default to 'notion')
SELECT COUNT(*)
FROM bot_configs
WHERE prompt_source IS NULL;
-- Expected: 0

-- Check for invalid prompt_source values
SELECT COUNT(*)
FROM bot_configs
WHERE prompt_source NOT IN ('notion', 'agent');
-- Expected: 0
```

---

**Last Updated**: 2025-11-17
**Status**: Migration Required
