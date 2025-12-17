# Supabase Migration Guide

## Quick Start

Run these migrations in order in your Supabase SQL Editor:

1. **`supabase/consolidated_migration.sql`** - Main migration (run this first)
2. **`supabase/enable_rls_schema_migrations.sql`** - Security fix (optional but recommended)

---

## Migration Files Overview

### 1. `consolidated_migration.sql` ⭐ **REQUIRED**

**What it does:**
- ✅ Updates `bot_configs` table for shared bot (makes `telegram_bot_token` nullable)
- ✅ Creates `telegram_verification_codes` table with timezone support
- ✅ Ensures all core tables exist with correct schema
- ✅ Sets up indexes, triggers, and RLS policies
- ✅ Creates necessary functions (credit decrement, cleanup, etc.)

**When to run:** First time setup or when updating schema

**Idempotent:** Yes (safe to run multiple times)

---

### 2. `enable_rls_schema_migrations.sql` ⚠️ **RECOMMENDED**

**What it does:**
- ✅ Enables RLS on `schema_migrations` table
- ✅ Revokes client access (security best practice)

**When to run:** After main migration (addresses security lint warning)

**Idempotent:** Yes

---

## Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run Main Migration

1. Open `supabase/consolidated_migration.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**Expected output:**
- Should complete without errors
- You'll see "Success: All 8 core tables exist" at the end

### Step 3: Run Security Migration (Optional)

1. Open `supabase/enable_rls_schema_migrations.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run**

**Expected output:**
- Should complete without errors
- Security lint warning should be resolved

---

## Verification Checklist

After running migrations, verify:

### ✅ Tables Exist
```sql
SELECT table_name 
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
  )
ORDER BY table_name;
```

**Expected:** 8 rows

### ✅ bot_configs Schema
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bot_configs'
ORDER BY ordinal_position;
```

**Check for:**
- `telegram_bot_token` is nullable (`is_nullable = 'YES'`)
- `prompt_source` column exists
- `last_webhook_setup_at`, `last_webhook_status`, `last_webhook_error` exist

### ✅ telegram_verification_codes Table
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'telegram_verification_codes'
ORDER BY ordinal_position;
```

**Check for:**
- `timezone` column exists
- RLS is enabled

### ✅ RLS Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('bot_configs', 'telegram_verification_codes', 'schema_migrations');
```

**Expected:** All should have `rowsecurity = true`

---

## Troubleshooting

### Error: "column already exists"
- **Cause:** Migration was partially run before
- **Fix:** This is fine - the migration uses `IF NOT EXISTS` and `DO $$` blocks to handle existing columns
- **Action:** Continue running the migration

### Error: "relation does not exist"
- **Cause:** Table doesn't exist yet
- **Fix:** The migration creates all tables - just run it
- **Action:** Re-run the migration

### Error: "permission denied"
- **Cause:** Using wrong database role
- **Fix:** Make sure you're using the SQL Editor (uses service_role automatically)
- **Action:** Check you're logged into Supabase Dashboard

### RLS Policies Not Working
- **Cause:** Policies might be missing or incorrect
- **Fix:** Re-run the RLS policy sections of the migration
- **Action:** Check policies exist:
  ```sql
  SELECT tablename, policyname 
  FROM pg_policies 
  WHERE schemaname = 'public';
  ```

---

## What Each Table Does

| Table | Purpose |
|-------|---------|
| `bot_configs` | User bot settings (Telegram, Notion, schedule) |
| `bot_state` | Tracks last sent prompt for reply handling |
| `user_prompts` | AI-generated prompt calendar |
| `user_generation_context` | Brand voice and analysis context |
| `user_weekly_themes` | Monthly weekly themes for prompts |
| `agent_generation_jobs` | Tracks AI generation job status |
| `user_subscriptions` | User tier and Claude credits |
| `telegram_verification_codes` | Temporary codes for Telegram linking |

---

## Key Changes in This Migration

### 1. Shared Bot Support
- `telegram_bot_token` is now nullable (using shared bot from environment)
- Users only need to provide `telegram_chat_id`

### 2. Verification Code Flow
- New `telegram_verification_codes` table
- Includes `timezone` column for auto-configuration
- 10-minute expiration with cleanup function

### 3. Prompt Source Selection
- `prompt_source` column: 'notion' or 'agent'
- Notion fields are nullable (agent users don't need them)

### 4. Webhook Health Tracking
- `last_webhook_setup_at`, `last_webhook_status`, `last_webhook_error`
- Helps debug webhook issues

---

## Next Steps After Migration

1. **Set Environment Variables** (in Vercel/Supabase):
   - `TELEGRAM_BOT_TOKEN` - Your shared bot token
   - `TELEGRAM_WEBHOOK_SECRET` - Secret for webhook verification
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Bot username (e.g., "threadbot_bot")

2. **Test the Flow**:
   - Sign up a test user
   - Generate prompts
   - Connect Telegram via verification code
   - Verify bot receives messages

3. **Monitor Logs**:
   - Check Supabase logs for any errors
   - Check Vercel function logs for webhook activity

---

## Rollback (If Needed)

If you need to rollback:

1. **Don't delete tables** - Just update columns back
2. **Make telegram_bot_token NOT NULL again** (if you had existing data):
   ```sql
   ALTER TABLE bot_configs ALTER COLUMN telegram_bot_token SET NOT NULL;
   ```
3. **Drop verification codes table** (if needed):
   ```sql
   DROP TABLE IF EXISTS telegram_verification_codes CASCADE;
   ```

**Note:** Rollback is rarely needed - the migration is designed to be safe and additive.

---

## Support

If you encounter issues:
1. Check the error message in Supabase SQL Editor
2. Verify you're running migrations in order
3. Check that all tables exist before running
4. Review the verification checklist above

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Ready to Deploy

