# 🚨 URGENT: Database Migration Required

## Problem

The database schema requires `telegram_bot_token` and `telegram_chat_id` to be NOT NULL, but the multi-step onboarding tries to save Notion config first (without Telegram fields). This causes a 500 error.

## Fix

Run this migration in your Supabase SQL Editor to make Telegram fields nullable:

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run This SQL

```sql
-- Make telegram fields nullable for multi-step onboarding
ALTER TABLE bot_configs
  ALTER COLUMN telegram_bot_token DROP NOT NULL,
  ALTER COLUMN telegram_chat_id DROP NOT NULL;

-- Add constraint to ensure both fields are set together
ALTER TABLE bot_configs
  ADD CONSTRAINT telegram_config_complete
  CHECK (
    (telegram_bot_token IS NULL AND telegram_chat_id IS NULL)
    OR
    (telegram_bot_token IS NOT NULL AND telegram_chat_id IS NOT NULL)
  );
```

### Step 3: Click "Run"

### Step 4: Verify Success

You should see: "Success. No rows returned"

## What This Does

- ✅ Allows Notion setup (step 1) to save without Telegram credentials
- ✅ Telegram setup (step 2) can then add those credentials via updateConfig
- ✅ Ensures both Telegram fields are set together (not just one)
- ✅ Prevents partial configuration

## Then Redeploy

After running the migration, redeploy your app. The code has been updated to:

1. Accept optional Telegram fields in `createConfig`
2. Not send Telegram fields from Notion setup page
3. Updated schema.sql for future deployments

## Testing

After migration and redeployment:

1. Sign up for a new account
2. Go through Notion setup
3. Should successfully save and redirect to Telegram setup
4. Complete Telegram setup
5. Should redirect to Schedule setup
6. Activate bot

---

**Migration file saved at:** `supabase/schema_migration.sql`
**Updated schema:** `supabase/schema.sql` (for future deployments)
