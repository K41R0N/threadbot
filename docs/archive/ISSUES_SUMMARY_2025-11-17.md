# ThreadBot Issues Summary & Fixes

**Date**: 2025-11-17
**Session**: claude/analyze-context-files-011CV2eLGD4C9GWWXybTgwkB

---

## **Issues Reported**

### **1. Scheduling Function Not Working**
- **Symptom**: Cron returns 200 success but no messages sent
- **User feedback**: "The scheduling function isn't working"

### **2. Prompt Source Toggle Not Working**
- **Symptom**: Test function uses Notion even when Agent is selected
- **User feedback**: "it didn't use the agent generated prompts when I set the data source to be the agent"

### **3. Webhook Secret Token Error**
- **Error**: "ETELEGRAM: 400 Bad Request: secret token contains unallowed characters"
- **Location**: Settings dashboard when attempting webhook setup

### **4. Missing Database Column**
- **Error**: `column user_subscriptions.last_free_generation_at does not exist`
- **Impact**: Agent generation endpoints failing with database errors

---

## **Root Cause Analysis**

All issues stem from **missing database migrations**:

### **Missing Migration #1: `add_prompt_source.sql`**
- **Column**: `bot_configs.prompt_source`
- **Impact**:
  - Prompt source toggle doesn't work (no column to store value)
  - Settings page can't switch between Notion/Agent
  - Test always defaults to Notion (fallback behavior)

### **Missing Migration #2: `migration_credits_only_phase1.sql`**
- **Column**: `user_subscriptions.last_free_generation_at`
- **Impact**:
  - Agent generation fails with database errors
  - Weekly free generation tracking broken
  - Repeated errors in Vercel logs

### **Additional Issue: Invalid Webhook Secret**
- **Cause**: `TELEGRAM_WEBHOOK_SECRET` contains characters not allowed by Telegram API
- **Telegram requires**: Only `A-Z`, `a-z`, `0-9`, `_`, `-` (1-256 characters)

---

## **Fixes Applied**

### **1. Documentation Created**

#### **`docs/DATABASE_MIGRATION_FIX.md`**
- Complete migration guide for both missing columns
- SQL commands to run in Supabase
- Verification queries
- Troubleshooting section

#### **`docs/WEBHOOK_SECRET_FIX.md`**
- How to generate valid webhook secret token
- Step-by-step guide to update Vercel environment variable
- Verification methods
- Security best practices

#### **`docs/ISSUES_SUMMARY_2025-11-17.md`**
- This document summarizing all issues and fixes

### **2. Code Changes**

#### **`server/services/telegram.ts`** (lines 69-77)
Added validation to prevent invalid webhook secret tokens:

```typescript
// VALIDATION: Telegram only allows A-Z, a-z, 0-9, _, - (1-256 chars)
const validTokenPattern = /^[A-Za-z0-9_-]{1,256}$/;
if (!validTokenPattern.test(secretToken)) {
  throw new Error(
    'Invalid webhook secret token. Must be 1-256 characters and only contain: A-Z, a-z, 0-9, _, -'
  );
}
```

**Why this helps:**
- Gives clear error message before attempting Telegram API call
- Prevents cryptic "unallowed characters" errors
- Guides user to fix the environment variable

---

## **Action Required From You**

### **STEP 1: Run Database Migrations**

Open Supabase SQL Editor and run these migrations:

#### **Migration 1: Add `prompt_source` column**

```sql
-- Add prompt_source to bot_configs
ALTER TABLE bot_configs
  ADD COLUMN IF NOT EXISTS prompt_source TEXT DEFAULT 'notion' CHECK (prompt_source IN ('notion', 'agent'));

-- Make Notion fields nullable (agent users don't need them)
ALTER TABLE bot_configs
  ALTER COLUMN notion_token DROP NOT NULL,
  ALTER COLUMN notion_database_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN bot_configs.prompt_source IS 'Source of prompts: notion (default) or agent (AI-generated)';

-- Verify
SELECT user_id, prompt_source, is_active FROM bot_configs;
```

**Expected output:** All rows show `prompt_source = 'notion'`

#### **Migration 2: Add `last_free_generation_at` column**

```sql
-- Add weekly generation tracking column
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS last_free_generation_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN user_subscriptions.last_free_generation_at IS
  'Timestamp of last free DeepSeek generation. Enforces 7-day cooldown.';

-- Add index
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_generation_limit
ON user_subscriptions(user_id, last_free_generation_at)
WHERE last_free_generation_at IS NOT NULL;

-- Verify
SELECT user_id, claude_credits, last_free_generation_at FROM user_subscriptions;
```

**Expected output:** All rows show `last_free_generation_at = NULL`

---

### **STEP 2: Fix Webhook Secret Token**

#### **Generate new secret token:**

```bash
# Run in terminal
openssl rand -base64 48 | tr '+/' '_-' | head -c 64
```

**Example output:**
```
Xj9kL2mP4nQ7rT8sW1vY5zB6cD3fG0hJ9kL2mP4nQ7rT8sW1vY5zB6cD3fG0hJ
```

#### **Update Vercel environment variable:**

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Find `TELEGRAM_WEBHOOK_SECRET`
3. Click **Edit**
4. Paste the new token (from step above)
5. Select environments: **Production**, **Preview**, **Development**
6. Click **Save**
7. **Redeploy** your application (Deployments → ⋯ → Redeploy)

---

### **STEP 3: Verify Everything Works**

After completing Steps 1 & 2:

#### **Test 1: Verify migrations**
```sql
-- Check columns exist
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('bot_configs', 'user_subscriptions')
  AND column_name IN ('prompt_source', 'last_free_generation_at');
```

**Expected:** 2 rows returned

#### **Test 2: Test prompt source toggle**

1. Go to `/settings`
2. Change "Prompt Source" to "AI Agent"
3. Save changes
4. Click **🧪 TEST NOW**
5. Check logs show: `📡 Prompt source: agent`

#### **Test 3: Test agent generation**

1. Go to `/agent/create`
2. Click "Generate Prompts"
3. Should complete without database errors

#### **Test 4: Test webhook**

1. Go to `/settings`
2. Save configuration (triggers webhook setup)
3. Should NOT show "unallowed characters" error
4. Should show success message

---

## **Why the Scheduling Isn't Working**

Even after fixing the database migrations, the scheduling function may still not send messages. This could be due to:

1. **Bot not activated** - Check `bot_configs.is_active = true`
2. **No prompts in database** - Generate prompts in `/agent/create`
3. **Timing window mismatch** - Cron runs every 5 minutes, only sends within 5-minute window of scheduled time
4. **Wrong timezone** - Check `bot_configs.timezone` matches your actual timezone

Run this diagnostic query:

```sql
SELECT
  user_id,
  is_active,
  prompt_source,
  timezone,
  morning_time,
  evening_time,
  last_webhook_status
FROM bot_configs
WHERE user_id = 'YOUR_CLERK_USER_ID';
```

Then check if prompts exist for today:

```sql
SELECT
  date,
  post_type,
  week_theme,
  array_length(prompts, 1) as num_prompts
FROM user_prompts
WHERE user_id = 'YOUR_CLERK_USER_ID'
  AND date = CURRENT_DATE;
```

If you still have issues after completing all steps above, please provide:
1. Results from both diagnostic queries
2. Your Clerk user ID
3. Your timezone
4. Scheduled times (morning/evening)

---

## **Files Changed**

### **Documentation Added:**
- `docs/DATABASE_MIGRATION_FIX.md` - Complete migration guide
- `docs/WEBHOOK_SECRET_FIX.md` - Webhook token fix guide
- `docs/ISSUES_SUMMARY_2025-11-17.md` - This summary

### **Code Modified:**
- `server/services/telegram.ts:69-77` - Added webhook secret validation

---

## **Next Steps After You Complete Migrations**

1. **Commit these documentation files**
2. **Push to your branch**
3. **Run the migrations** in Supabase
4. **Update webhook secret** in Vercel
5. **Redeploy** application
6. **Test all functionality**
7. **Report back** if scheduling still doesn't work

---

**Last Updated**: 2025-11-17
**Status**: Awaiting user action (migrations + webhook secret update)
