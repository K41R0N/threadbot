# Telegram Troubleshooting Guide

**Created**: 2025-11-17
**Issue**: Telegram messages not being sent, replies not being logged

---

## **Quick Diagnostic Checklist**

### **Step 1: Check Bot Configuration in Database**

Run this query in Supabase SQL Editor:

```sql
SELECT
  user_id,
  is_active,
  prompt_source,
  timezone,
  morning_time,
  evening_time,
  telegram_bot_token IS NOT NULL as has_telegram_token,
  telegram_chat_id,
  last_webhook_setup_at,
  last_webhook_status,
  created_at,
  updated_at
FROM bot_configs
WHERE user_id = 'YOUR_USER_ID';
```

**Expected Results:**
- ✅ `is_active = true`
- ✅ `prompt_source = 'agent'` (if using AI-generated prompts)
- ✅ `has_telegram_token = true`
- ✅ `telegram_chat_id` is populated
- ✅ `last_webhook_status = 'success'` (if webhook was set up)

**If `is_active = false`:**
- Go to Settings page
- Toggle "Activate Bot" switch
- Save configuration

---

### **Step 2: Check Prompts Exist for Today**

Run this query in Supabase SQL Editor:

```sql
SELECT
  date,
  post_type,
  week_theme,
  prompts,
  status,
  created_at
FROM user_prompts
WHERE user_id = 'YOUR_USER_ID'
  AND date = CURRENT_DATE
ORDER BY post_type;
```

**Expected Results:**
- ✅ Two rows: one `post_type = 'morning'`, one `post_type = 'evening'`
- ✅ `prompts` array has 5 questions
- ✅ `date` matches today

**If no prompts found:**
- Go to `/agent/create` page
- Generate prompts for this month
- Wait for generation to complete
- Re-run query

---

### **Step 3: Check Cron Timing**

The cron runs **every 5 minutes** but only sends if:
- Current time is within **5 minutes** of your scheduled time

**Example:**
- Scheduled: `08:00` in `America/New_York`
- Cron runs at: `08:00`, `08:05`, `08:10`, `08:15`...
- Will send at: `08:00` or `08:05` (within 5-minute window)
- Won't send at: `08:10` (more than 5 minutes past)

**How to verify:**

1. Check current time in your timezone:
```sql
SELECT NOW() AT TIME ZONE 'America/New_York' as current_time_in_my_tz;
```

2. Check your scheduled times:
```sql
SELECT morning_time, evening_time, timezone
FROM bot_configs
WHERE user_id = 'YOUR_USER_ID';
```

3. Wait for next cron run within 5 minutes of scheduled time

---

### **Step 4: Test Telegram Connection**

Use the **TEST NOW** button in Settings:

1. Go to `/settings` page
2. Scroll to "Telegram Configuration"
3. Click **🧪 TEST NOW** button
4. Check the detailed logs that appear

**Expected logs:**
```
✅ Bot config found
✅ Telegram token: bot123...
✅ Chat ID: 1234567890
📊 Bot active: Yes
📅 Prompt source: agent
🔍 Checking for today's prompt...
✅ Found morning/evening prompt for 2025-11-17
📤 Sending test message to Telegram...
✅ Message sent successfully!
```

**If you see errors:**
- ❌ Bot config not found → Configure bot in Settings
- ❌ No telegram token → Add Telegram bot token
- ❌ No chat ID → Add Telegram chat ID
- ❌ No prompt found → Generate prompts in Agent
- ❌ Telegram API error → Check bot token is valid

---

### **Step 5: Verify Telegram Webhook**

Check if Telegram knows where to send replies:

1. Get your bot token from Settings
2. Run this command (replace `YOUR_BOT_TOKEN`):

```bash
curl https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://threadbot.dev/api/webhook/YOUR_USER_ID",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null,
    "max_connections": 40
  }
}
```

**If `url` is empty or wrong:**

The webhook wasn't set up. This happens when:
- You configured bot but didn't activate it
- Webhook setup failed (check logs)

**To fix:**
1. Go to Settings
2. Make sure bot is activated (`is_active = true`)
3. The app should auto-setup webhook on activation
4. Re-run the curl command to verify

---

### **Step 6: Check Environment Variables**

Verify all required variables are set in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Check these are set:

**Required:**
- ✅ `CRON_SECRET` - Random secret for cron authentication
- ✅ `TELEGRAM_WEBHOOK_SECRET` - Random secret for webhook authentication
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `CLERK_SECRET_KEY`
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

**How to check if CRON_SECRET is working:**

The cron logs show **200** responses, which means:
- ✅ CRON_SECRET is configured correctly
- ✅ Authorization is passing
- ✅ Cron is reaching the code

---

### **Step 7: Enable Detailed Logging**

Check Vercel logs for detailed output:

1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by `/api/cron`
3. Look for these log messages:

**Successful send:**
```
Processed morning prompts
processed: 1
results: [{ userId: "...", success: true, message: "Prompt sent successfully" }]
```

**No send (not time yet):**
```
Processed morning prompts
processed: 0
results: []
```

**No send (no active bots):**
```
No active bots found
processed: 0
```

**No send (no prompt found):**
```
results: [{ userId: "...", success: false, message: "No morning prompt found for 2025-11-17" }]
```

---

## **Common Issues & Solutions**

### **Issue 1: Cron runs but no messages sent**

**Cause:** Bot not activated or no prompts in database

**Solution:**
1. Activate bot in Settings (`is_active = true`)
2. Generate prompts in Agent for current month
3. Verify prompts exist with SQL query above

---

### **Issue 2: Messages sent but replies not logged**

**Cause:** Webhook not configured

**Solution:**
1. Check webhook with `getWebhookInfo` (Step 5)
2. If empty, go to Settings and re-save configuration
3. Check `last_webhook_status` in database

---

### **Issue 3: "Prompt already sent today"**

**Cause:** Idempotency check preventing duplicate sends

**Solution:**
This is **expected behavior**. The bot sends each prompt **once per day**.

To reset for testing:
```sql
UPDATE bot_state
SET last_prompt_sent_at = NULL,
    last_prompt_type = NULL
WHERE user_id = 'YOUR_USER_ID';
```

---

### **Issue 4: Wrong timezone**

**Cause:** Timezone mismatch between database and reality

**Solution:**
1. Check your timezone:
```sql
SELECT timezone FROM bot_configs WHERE user_id = 'YOUR_USER_ID';
```

2. Update if wrong:
```sql
UPDATE bot_configs
SET timezone = 'America/New_York'  -- Change to your timezone
WHERE user_id = 'YOUR_USER_ID';
```

3. Available timezones: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

### **Issue 5: Cron runs every 5 minutes but misses scheduled time**

**Cause:** 5-minute window means cron might not align perfectly

**Solution:**

**Current behavior:**
- Cron runs: `:00`, `:05`, `:10`, `:15`, `:20`, etc.
- Scheduled time: `08:00`
- Will send at: `08:00` or `08:05`

**Workaround:**
Set scheduled times to multiples of 5:
- ✅ `08:00`, `08:05`, `08:10` (aligned)
- ❌ `08:03`, `08:17`, `08:42` (might miss)

---

## **WordPress Logs in Vercel**

**Question**: "Why are there WordPress logs?"

**Answer**: These are **bot/scanner attempts**, not your application:

```
GET 307 /wp-admin/setup-config.php
GET 307 /wordpress/wp-admin/setup-config.php
```

**What's happening:**
1. Bots scan public domains for vulnerable WordPress installations
2. Your app returns **307 redirects** (not 200)
3. This is **harmless** and normal for any public website

**Why 307?**
- Next.js returns 307 for unknown routes
- Your app doesn't have those WordPress routes
- Bots give up after redirect

**Should you worry?** No. These are blocked by your app.

---

## **Next Steps**

### **Immediate Actions:**

1. **Run SQL diagnostics** (Steps 1 & 2)
2. **Click "TEST NOW"** in Settings (Step 4)
3. **Check Vercel logs** during next cron run (Step 7)

### **If still not working:**

Reply with:
1. Results from SQL queries (Steps 1 & 2)
2. Logs from "TEST NOW" button
3. Your user ID from Clerk
4. Your timezone
5. Scheduled times (morning/evening)

### **Expected Timeline:**

Once configured correctly:
- Cron runs every 5 minutes
- Sends prompts when within 5-minute window of scheduled time
- Logs all activity to Vercel logs

---

## **Quick Fix Script**

If you want to manually trigger a send right now:

1. Go to Settings
2. Click **TEST NOW**
3. Check your Telegram

This bypasses all timing checks and sends immediately.

---

**Last Updated**: 2025-11-17
**Status**: Diagnostic Guide
