# Cron Bot Fix Summary

## 🔴 Critical Issue Found: Vercel Cron Authentication

### Problem
The cron endpoint was checking for `Authorization: Bearer ${CRON_SECRET}` header, but **Vercel Cron does NOT automatically send this header**. This caused all cron requests to be rejected with 401 Unauthorized.

### Solution Applied
✅ Updated `app/api/cron/route.ts` to check for Vercel's `x-vercel-cron` header instead
- Vercel automatically sends `x-vercel-cron: 1` header with all cron requests
- This header can only be set by Vercel, making it secure
- Added optional secret token support for manual testing

### Files Changed
1. `app/api/cron/route.ts` - Fixed authentication logic
2. `vercel.json` - Removed placeholder secret (not needed)

---

## ✅ Next Steps to Verify Everything Works

### 1. Check Vercel Environment Variables
Make sure these are set in Vercel Dashboard → Settings → Environment Variables:

**Required:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (bypasses RLS)
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- ✅ `CLERK_SECRET_KEY` - Clerk secret key
- ✅ `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., `https://your-app.vercel.app`)
- ✅ `TELEGRAM_WEBHOOK_SECRET` - Random secret for webhook auth (hex-encoded)

**Optional (for manual testing):**
- `CRON_SECRET` - Can be used for manual cron testing via URL: `/api/cron?type=morning&secret=YOUR_SECRET`

### 2. Verify Bot Configuration in Supabase
Run this SQL query in Supabase SQL Editor to check your bot config:

```sql
SELECT 
  user_id,
  is_active,
  timezone,
  morning_time,
  evening_time,
  telegram_bot_token IS NOT NULL as has_telegram_token,
  telegram_chat_id IS NOT NULL as has_telegram_chat_id,
  prompt_source
FROM bot_configs;
```

**Check:**
- ✅ `is_active` should be `true` for bots that should send messages
- ✅ `telegram_bot_token` and `telegram_chat_id` should be set
- ✅ `timezone`, `morning_time`, and `evening_time` should be configured

### 3. Check Vercel Cron Logs
1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by `/api/cron`
3. Look for recent cron executions

**Expected successful response:**
```json
{
  "message": "Processed morning prompts",
  "processed": 1,
  "results": [{
    "userId": "...",
    "success": true,
    "message": "Prompt sent successfully"
  }]
}
```

**If no bots are active:**
```json
{
  "message": "No active bots found",
  "processed": 0
}
```

**If it's not time yet:**
```json
{
  "message": "Processed morning prompts",
  "processed": 0,
  "results": []
}
```

### 4. Test Timezone Handling
The cron runs every 5 minutes (`*/5 * * * *`), and `shouldSendPrompt` checks if current time is within 5 minutes of scheduled time.

**Example:**
- Scheduled time: `09:00`
- Cron runs at: `08:55`, `09:00`, `09:05`
- Bot will send if current time is between `08:55` and `09:05`

**To test:**
1. Set your bot's `morning_time` to 5 minutes from now
2. Wait for next cron run (within 5 minutes)
3. Check logs to see if message was sent

### 5. Manual Testing (Optional)
You can manually trigger the cron endpoint for testing:

```bash
# With secret (if CRON_SECRET is set)
curl "https://your-app.vercel.app/api/cron?type=morning&secret=YOUR_CRON_SECRET"

# Or test locally
curl "http://localhost:3000/api/cron?type=morning&secret=YOUR_CRON_SECRET"
```

---

## 🔍 Common Issues & Solutions

### Issue 1: Cron runs but no messages sent
**Possible causes:**
- Bot `is_active` is `false` → Set to `true` in database
- No prompts found for today → Generate prompts or add to Notion
- Timezone mismatch → Check `timezone` field matches your actual timezone
- Scheduled time not reached → Wait for scheduled time ± 5 minutes

**Solution:**
```sql
-- Check bot status
SELECT is_active, timezone, morning_time, evening_time FROM bot_configs WHERE user_id = 'YOUR_USER_ID';

-- Activate bot
UPDATE bot_configs SET is_active = true WHERE user_id = 'YOUR_USER_ID';
```

### Issue 2: "Unauthorized" errors in logs
**Cause:** Old code was checking for Authorization header
**Solution:** ✅ Fixed - now checks for `x-vercel-cron` header

### Issue 3: Messages sent but replies not logged
**Cause:** Webhook not configured
**Solution:**
1. Go to Dashboard → Settings
2. Click "Setup Webhook" button
3. Verify webhook is set: Check `last_webhook_status` in database

### Issue 4: Timezone issues
**Check:**
- `timezone` field uses IANA timezone format (e.g., `America/New_York`, `Europe/London`)
- `morning_time` and `evening_time` use 24-hour format (e.g., `09:00`, `18:00`)

---

## 📋 Verification Checklist

After deploying the fix, verify:

- [ ] Cron endpoint returns 200 OK (not 401 Unauthorized)
- [ ] Vercel logs show cron executions every 5 minutes
- [ ] Bot config has `is_active = true`
- [ ] Telegram bot token and chat ID are configured
- [ ] Timezone and schedule times are set correctly
- [ ] Prompts exist for today's date (in Notion or agent database)
- [ ] Webhook is configured (check `last_webhook_status = 'success'`)

---

## 🚀 Deployment Steps

1. **Commit and push changes:**
   ```powershell
   git add app/api/cron/route.ts vercel.json
   git commit -m "Fix Vercel Cron authentication - use x-vercel-cron header"
   git push
   ```

2. **Wait for Vercel deployment** (automatic)

3. **Check Vercel logs** after next cron run (within 5 minutes)

4. **Verify bot sends messages** at scheduled times

---

## 📝 Technical Details

### How Vercel Cron Works
- Vercel Cron automatically sends `x-vercel-cron: 1` header with all cron requests
- This header cannot be spoofed by external requests
- No additional configuration needed in `vercel.json` for authentication

### Cron Schedule
- Current: `*/5 * * * *` (every 5 minutes)
- This ensures prompts are sent within 5 minutes of scheduled time
- Can be changed to less frequent if needed (e.g., `0 * * * *` for hourly)

### Security
- ✅ Vercel Cron requests are authenticated via `x-vercel-cron` header
- ✅ Optional secret token for manual testing
- ✅ Service role key bypasses RLS for cron operations
- ✅ All sensitive data excluded from client responses

---

**Last Updated:** 2025-01-XX
**Status:** ✅ Fixed - Ready for testing

