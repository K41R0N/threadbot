# Telegram Bot Setup Guide

## Quick Setup (5 minutes)

Follow these steps to get your Telegram bot working:

---

## Step 1: Create Telegram Bot

1. **Open Telegram** and search for **@BotFather**
2. Send `/newbot` command
3. **Choose a name** (e.g., "Threadbot")
4. **Choose a username** (must end with `_bot`, e.g., `threadbot_bot`)
5. **Copy the bot token** - You'll see something like:
   ```
   123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```
   ⚠️ **Save this token** - you'll need it in the next step!

---

## Step 2: Set Environment Variables in Vercel

Go to your **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these **4 variables**:

### 1. `TELEGRAM_BOT_TOKEN`
- **Value:** The bot token you copied from BotFather
- **Example:** `123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

### 2. `TELEGRAM_WEBHOOK_SECRET`
- **Value:** Generate a random secret (see below)
- **Requirements:** 
  - 1-256 characters
  - Only: `A-Z`, `a-z`, `0-9`, `_`, `-`
  - No spaces or special characters
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

**Generate secret (PowerShell):**
```powershell
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString("x2") }) -join ''
```

**Or use a simple one for testing:**
```
threadbot_webhook_secret_2025_production_v1
```

### 3. `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
- **Value:** Your bot's username (without @)
- **Example:** `threadbot_bot`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

### 4. `NEXT_PUBLIC_APP_URL`
- **Value:** Your production domain
- **Example:** `https://threadbot.dev` or `https://your-app.vercel.app`
- **Environments:** ✅ Production (set for production only)

---

## Step 3: Redeploy Your App

After adding environment variables:

1. Go to **Deployments** tab in Vercel
2. Click **"Redeploy"** on the latest deployment
   - OR push a new commit to trigger auto-deploy

**Important:** Environment variables only take effect after redeployment!

---

## Step 4: Set Up Webhook

You have **2 options**:

### Option A: Via Dashboard (Recommended)

1. **Log into your app** (threadbot.dev)
2. Go to **Settings** page
3. Enter your **Telegram Chat ID**:
   - Open Telegram
   - Search for **@userinfobot**
   - Start a chat
   - Copy your Chat ID (numbers only)
4. Click **"Setup Webhook"** button (if available)
   - OR just save your Chat ID - webhook will be set automatically

### Option B: Manual Setup (Advanced)

Use Telegram Bot API directly:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://threadbot.dev/api/webhook",
    "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
  }'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your actual bot token
- `<YOUR_TELEGRAM_WEBHOOK_SECRET>` with your webhook secret

---

## Step 5: Test the Bot

### Test 1: Send Test Message

1. Go to **Settings** page in your app
2. Click **"🧪 TEST NOW"** button
3. Check your Telegram - you should receive a test message!

### Test 2: Verify Webhook

Send a message to your bot on Telegram:
- Open Telegram
- Search for your bot (e.g., `@threadbot_bot`)
- Send any message (e.g., "hello")

**Expected:** Bot should respond (or at least receive the message)

### Test 3: Check Webhook Status

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Should return:
```json
{
  "ok": true,
  "result": {
    "url": "https://threadbot.dev/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## Troubleshooting

### Error: "TELEGRAM_BOT_TOKEN environment variable not configured"

**Cause:** Environment variable not set or app not redeployed

**Fix:**
1. ✅ Verify `TELEGRAM_BOT_TOKEN` exists in Vercel Environment Variables
2. ✅ Check it's set for the correct environment (Production/Preview/Development)
3. ✅ **Redeploy your app** after adding the variable
4. ✅ Verify the token is correct (no extra spaces)

### Error: "Failed to set webhook"

**Possible causes:**
1. **Invalid webhook secret** - Contains invalid characters
   - **Fix:** Regenerate secret using only `A-Z`, `a-z`, `0-9`, `_`, `-`
2. **Invalid URL** - Webhook URL not accessible
   - **Fix:** Verify `NEXT_PUBLIC_APP_URL` is correct and app is deployed
3. **Bot token incorrect**
   - **Fix:** Double-check token from BotFather

### Bot Not Receiving Messages

**Check:**
1. ✅ Webhook is set correctly (use `getWebhookInfo` API)
2. ✅ Webhook URL is accessible (should return 200 OK)
3. ✅ `TELEGRAM_WEBHOOK_SECRET` matches in both places
4. ✅ User has entered their Chat ID in Settings
5. ✅ Bot is active (`is_active = true` in database)

### Webhook Returns 401 Unauthorized

**Cause:** Webhook secret doesn't match

**Fix:**
1. Verify `TELEGRAM_WEBHOOK_SECRET` in Vercel matches what you set in Telegram
2. Check for typos or extra spaces
3. Redeploy after fixing

---

## Environment Variables Checklist

Before testing, verify you have **ALL** of these set in Vercel:

- [ ] `TELEGRAM_BOT_TOKEN` - Bot token from BotFather
- [ ] `TELEGRAM_WEBHOOK_SECRET` - Random secret (A-Z, a-z, 0-9, _, -)
- [ ] `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Bot username (without @)
- [ ] `NEXT_PUBLIC_APP_URL` - Your app URL (production only)
- [ ] `CRON_SECRET` - For cron jobs (if using scheduled prompts)
- [ ] Other existing variables (Supabase, Clerk, etc.)

---

## Quick Reference

### Get Your Chat ID
1. Open Telegram
2. Search `@userinfobot`
3. Start chat
4. Copy the Chat ID (numbers only)

### Get Bot Token
1. Open Telegram
2. Search `@BotFather`
3. Send `/mybots`
4. Select your bot
5. Click "API Token"

### Check Webhook Status
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Delete Webhook (if needed)
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

---

## Next Steps

After setup is complete:

1. ✅ **Test the bot** - Send a test message from Settings
2. ✅ **Connect your account** - Use the verification code flow
3. ✅ **Generate prompts** - Create your first prompt database
4. ✅ **Activate bot** - Start receiving daily prompts!

---

**Need Help?** Check the logs in Vercel Dashboard → Functions → View logs

**Last Updated:** 2025-01-XX

