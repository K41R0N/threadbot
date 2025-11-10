# Security Setup Instructions

**IMPORTANT:** After deploying these security fixes, follow these steps to enable protection.

---

## 1. Generate Security Secrets

You need to generate two random secrets for production:

```bash
# Generate CRON_SECRET
openssl rand -base64 32

# Generate TELEGRAM_WEBHOOK_SECRET
openssl rand -base64 32
```

Save these values - you'll need them in the next step.

---

## 2. Add Environment Variables to Vercel

Go to your Vercel project dashboard → **Settings** → **Environment Variables**

Add these NEW variables (in addition to existing ones):

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `CRON_SECRET` | (paste generated secret) | Protects cron endpoint from unauthorized access |
| `TELEGRAM_WEBHOOK_SECRET` | (paste generated secret) | Verifies webhook requests are from Telegram |

**Important:** Add these to ALL environments (Production, Preview, Development)

---

## 3. Redeploy Your Application

After adding the environment variables:

1. Go to **Deployments** tab in Vercel
2. Click on the latest deployment
3. Click **"Redeploy"** button

OR

Simply push a new commit and Vercel will auto-deploy with the new variables.

---

## 4. Update Telegram Webhooks

You need to reconfigure your Telegram webhooks with the secret token:

### Option A: Through the Dashboard (Recommended)

1. Log into your Threadbot dashboard
2. Go to **Setup → Telegram**
3. Re-save your Telegram configuration
   - The app will automatically set the webhook with the secret token

### Option B: Manual Update (Advanced)

Use the Telegram Bot API directly:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/webhook/<USER_ID>",
    "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
  }'
```

---

## 5. Verify Everything Works

### Test 1: Cron Endpoint Protection

Try accessing the cron endpoint without authorization (should be blocked):

```bash
curl https://your-app.vercel.app/api/cron?type=morning
# Should return: {"error":"Unauthorized"}
```

### Test 2: Send a Test Prompt

1. Log into your dashboard
2. Click "TEST MORNING" or "TEST EVENING" button
3. Verify you receive the message in Telegram

### Test 3: Reply to a Prompt

1. Reply to a prompt in Telegram
2. Check your Notion database
3. Verify the reply was logged

---

## 6. Security Checklist

After deployment, verify these security improvements are active:

- [ ] API tokens no longer visible in browser DevTools (Network tab)
- [ ] Cron endpoint returns 401 Unauthorized without proper auth
- [ ] Webhook endpoint rejects requests without Telegram secret
- [ ] Logs show `[REDACTED]` instead of actual tokens
- [ ] All test prompts and replies work correctly

---

## What Changed (Technical Details)

### 1. Tokens Removed from Client Response

**Before:** `bot.getConfig` returned entire row including tokens
**After:** Only non-sensitive fields returned to browser

**Files Changed:**
- `server/routers.ts` (lines 14-24, 72, 119)

---

### 2. Cron Endpoint Protected

**Before:** Publicly accessible - anyone could trigger
**After:** Requires `Authorization: Bearer <CRON_SECRET>` header

**Files Changed:**
- `app/api/cron/route.ts` (lines 11-21)

**How Vercel Cron Works:**
Vercel automatically adds the Authorization header when configured in `vercel.json`. No manual configuration needed for Vercel Cron jobs.

---

### 3. Webhook Verification Added

**Before:** No verification - anyone could send fake updates
**After:** Validates `X-Telegram-Bot-Api-Secret-Token` header

**Files Changed:**
- `app/api/webhook/[userId]/route.ts` (lines 16-27)
- `server/services/telegram.ts` (lines 31-39)

---

### 4. Safe Logging Implemented

**Before:** `console.error` could log tokens
**After:** `SafeLogger` automatically redacts sensitive fields

**Files Changed:**
- `lib/logger.ts` (new file - 120 lines)
- All service files updated to use `SafeLogger`

---

## Troubleshooting

### Issue: "Unauthorized" error on cron jobs

**Cause:** `CRON_SECRET` not set in Vercel

**Fix:**
1. Add `CRON_SECRET` environment variable in Vercel
2. Redeploy

---

### Issue: Webhooks not working after update

**Cause:** Telegram webhook not configured with secret token

**Fix:**
1. Go to dashboard → Setup → Telegram
2. Re-save your configuration
3. Or manually update webhook with secret token (see Step 4 above)

---

### Issue: Can't see config in dashboard

**Cause:** Frontend trying to access removed token fields

**Fix:** This should not happen if you deployed all changes. If it does:
1. Check browser console for errors
2. Clear browser cache
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

---

## Rolling Back (If Needed)

If something breaks and you need to rollback:

1. Go to Vercel → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"
4. Remove the new environment variables (`CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`)

---

## Support

If you encounter issues:

1. Check Vercel deployment logs for errors
2. Verify all environment variables are set correctly
3. Ensure webhook URL includes the correct user ID
4. Test each component individually (cron, webhook, dashboard)

---

## Next Steps (Optional Enhancements)

Once basic security is working, consider these additional improvements:

1. **Encrypt credentials in database** (See `SECURITY_AUDIT.md` - Issue #3)
2. **Add rate limiting** (See `SECURITY_AUDIT.md` - Issue #6)
3. **Implement input sanitization** (See `SECURITY_AUDIT.md` - Issue #7)
4. **Set up monitoring** (Sentry, LogRocket, etc.)

---

**Last Updated:** 2025-11-09
**Status:** Ready for deployment
