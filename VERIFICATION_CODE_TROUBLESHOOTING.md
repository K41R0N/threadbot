# Verification Code Troubleshooting Guide

## Problem: Bot Not Responding After Sending Code

If you sent a verification code but the bot didn't respond and the UI is stuck "waiting", follow these steps:

## Step 1: Check Database Migration

**CRITICAL**: You must run the database migration first!

1. Go to Supabase SQL Editor
2. Run `supabase/complete_database_fix.sql`
3. This adds the missing `timezone` column that the webhook needs

**Verify it worked:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'telegram_verification_codes' 
AND column_name = 'timezone';
```
Should return a row with `timezone`.

## Step 2: Check Webhook is Receiving Messages

### Option A: Check Vercel Logs (If Deployed)
1. Go to Vercel dashboard
2. Click on your project
3. Go to "Logs" tab
4. Look for messages containing:
   - "Shared webhook received"
   - "Telegram update received"
   - "Looking for verification code"

### Option B: Check Local Logs (If Running Locally)
Check your terminal/console for webhook logs.

**If you don't see any webhook logs:**
- The webhook might not be configured in Telegram
- See "Step 3: Verify Webhook Setup" below

## Step 3: Verify Webhook Setup

The webhook must be configured in Telegram to receive messages.

1. Check if webhook is set up:
   - Go to Settings page in your app
   - Click "Test Your Bot" button
   - This should set up the webhook automatically

2. Or manually check webhook status:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-domain.com/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Step 4: Check Verification Code Status

The code might have expired or been used already.

**Check in Supabase SQL Editor:**
```sql
SELECT 
  code, 
  user_id, 
  expires_at, 
  used_at, 
  chat_id,
  created_at,
  NOW() as current_time
FROM telegram_verification_codes
WHERE code = '978894'  -- Replace with your code
ORDER BY created_at DESC
LIMIT 1;
```

**What to look for:**
- `expires_at` should be in the future
- `used_at` should be NULL (not used yet)
- `chat_id` should be NULL (not linked yet)

**If code is expired:**
- Generate a new code
- Codes expire after 10 minutes

## Step 5: Check for Database Errors

The webhook now has better error logging. Check for these errors:

**Common errors:**

1. **"Could not find the 'timezone' column"**
   - **Fix**: Run `supabase/complete_database_fix.sql` migration

2. **"violates check constraint 'telegram_config_complete'"**
   - **Fix**: Run `supabase/complete_database_fix.sql` migration (fixes constraint)

3. **"permission denied" or RLS policy errors**
   - **Fix**: Check RLS policies in Supabase
   - Run this to verify policies exist:
     ```sql
     SELECT * FROM pg_policies 
     WHERE tablename = 'telegram_verification_codes';
     ```

## Step 6: Manual Verification

If everything else seems correct, try this manual test:

1. **Generate a new code** (old one might be expired)
2. **Send "hello" instead of the code** (sometimes works better)
3. **Wait 5-10 seconds** (polling checks every 2 seconds)
4. **Check if chat ID was linked:**
   ```sql
   SELECT telegram_chat_id, user_id 
   FROM bot_configs 
   WHERE user_id = 'your_user_id';
   ```

## Step 7: Check Environment Variables

Make sure these are set correctly:

- `TELEGRAM_BOT_TOKEN` - Your bot token
- `TELEGRAM_WEBHOOK_SECRET` - Secret token for webhook security (optional but recommended)
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Your bot username (e.g., "threadbot_bot")

## Quick Fix Checklist

- [ ] Ran `supabase/complete_database_fix.sql` migration
- [ ] Verified `timezone` column exists in `telegram_verification_codes` table
- [ ] Verified webhook is configured in Telegram
- [ ] Generated a fresh verification code (not expired)
- [ ] Checked Vercel/logs for webhook errors
- [ ] Tried sending "hello" instead of code
- [ ] Checked environment variables are set

## Still Not Working?

If you've checked everything above:

1. **Check the webhook logs** - Look for specific error messages
2. **Try the manual ChatID entry** - Go to Settings → Manual Entry
3. **Check Supabase logs** - Go to Supabase → Logs → API Logs
4. **Verify RLS policies** - Make sure service role can update verification codes

## Recent Improvements

The webhook now has:
- ✅ Better error logging
- ✅ Error handling for all database operations
- ✅ Graceful handling of missing timezone column
- ✅ Detailed logging for debugging

Check your logs for these new error messages to identify the exact issue.
