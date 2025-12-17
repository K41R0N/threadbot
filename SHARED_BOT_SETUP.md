# Shared Telegram Bot Setup Guide

## Overview

The application has been updated to use a **single shared Telegram bot** for all users, instead of requiring each user to create their own bot. This simplifies onboarding and reduces setup friction.

## What Changed

### Architecture Changes

1. **Shared Bot Token**: Stored in `TELEGRAM_BOT_TOKEN` environment variable (not per-user)
2. **Single Webhook**: All messages route through `/api/webhook` (no userId in path)
3. **Chat ID Routing**: Messages are routed to users based on their `telegram_chat_id`
4. **Simplified Onboarding**: Users only need to provide their Chat ID (no bot token needed)

### Files Modified

- ✅ `app/api/webhook/route.ts` - New shared webhook endpoint
- ✅ `server/services/telegram.ts` - Uses shared bot token from environment
- ✅ `server/services/bot.ts` - Updated to use shared bot token
- ✅ `server/routers.ts` - Updated webhook setup and test functions
- ✅ `app/setup/telegram/page.tsx` - Removed bot token input
- ✅ `app/settings/page.tsx` - Removed bot token input
- ✅ `lib/supabase.ts` - Made `telegram_bot_token` nullable in type

### Files to Update (Database Migration)

The database schema needs to be updated to make `telegram_bot_token` nullable:

```sql
-- Make telegram_bot_token nullable (already nullable in schema.sql, but verify)
ALTER TABLE bot_configs 
  ALTER COLUMN telegram_bot_token DROP NOT NULL;

-- Update constraint to allow NULL bot_token (chat_id still required)
ALTER TABLE bot_configs
  DROP CONSTRAINT IF EXISTS telegram_config_complete;

ALTER TABLE bot_configs
  ADD CONSTRAINT telegram_config_complete
  CHECK (
    (telegram_bot_token IS NULL AND telegram_chat_id IS NOT NULL)
    OR
    (telegram_bot_token IS NOT NULL AND telegram_chat_id IS NOT NULL)
  );
```

---

## Setup Instructions

### Step 1: Create Your Shared Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Choose a name (e.g., "Threadbot")
4. Choose a username (e.g., "threadbot_bot")
5. Copy the bot token (long string like `123456789:ABC-DEF...`)

### Step 2: Set Environment Variable

Add the bot token to your Vercel environment variables:

**Variable Name:** `TELEGRAM_BOT_TOKEN`  
**Value:** Your bot token from BotFather  
**Environments:** Production, Preview, Development

### Step 3: Configure Webhook (One-Time Setup)

The webhook needs to be set up once for the shared bot. You can do this:

**Option A: Via Dashboard (Recommended)**
1. Log in as any user
2. Go to Settings
3. Enter your Chat ID
4. Click "Setup Webhook" button

**Option B: Via API/Code**
Add a one-time setup script or admin endpoint:

```typescript
// One-time webhook setup
const telegram = new TelegramService(); // Uses TELEGRAM_BOT_TOKEN
const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`;
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
await telegram.setWebhook(webhookUrl, secretToken);
```

### Step 4: User Onboarding Flow

Users now only need to:

1. **Get their Chat ID:**
   - Open Telegram
   - Search for **@userinfobot**
   - Start a chat and copy their Chat ID

2. **Start a chat with your bot:**
   - Search for your bot (e.g., @threadbot_bot)
   - Send any message to activate

3. **Enter Chat ID in app:**
   - Go to Settings or Setup
   - Enter their Chat ID
   - Save

That's it! No bot creation needed.

---

## Migration Guide for Existing Users

### For Users with Existing Bot Tokens

Existing users who already have bot tokens configured will continue to work, but:

1. **Old webhook URLs** (`/api/webhook/[userId]`) will stop working
2. **Users need to:**
   - Keep their Chat ID (no change needed)
   - Remove/clear their bot token (optional - will be ignored)
   - Re-setup webhook using the shared bot

### Database Cleanup (Optional)

You can optionally clear old bot tokens:

```sql
-- Clear all user bot tokens (they're no longer needed)
UPDATE bot_configs 
SET telegram_bot_token = NULL 
WHERE telegram_bot_token IS NOT NULL;
```

---

## Security Considerations

### Webhook Security

The shared webhook endpoint (`/api/webhook`) is secured by:

1. **Secret Token**: `TELEGRAM_WEBHOOK_SECRET` environment variable
   - Telegram sends this in `X-Telegram-Bot-Api-Secret-Token` header
   - Must match exactly

2. **Chat ID Verification**: 
   - Messages are routed to users based on `telegram_chat_id`
   - If no user found for chat ID, request is silently ignored

### Environment Variables Required

**Required:**
- `TELEGRAM_BOT_TOKEN` - Shared bot token from BotFather
- `TELEGRAM_WEBHOOK_SECRET` - Random secret for webhook verification
- `NEXT_PUBLIC_APP_URL` - Your app URL (e.g., `https://your-app.vercel.app`)

**How to generate `TELEGRAM_WEBHOOK_SECRET`:**
```powershell
# PowerShell
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider; $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

Or use hex format (Telegram accepts A-Z, a-z, 0-9, _, -):
```powershell
$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider; $bytes = New-Object byte[] 32; $rng.GetBytes($bytes); ($bytes | ForEach-Object { $_.ToString("x2") }) -join ''
```

---

## Testing

### Test the Shared Bot

1. **Send a test message:**
   - Use the "Test Telegram Prompt" button in Settings
   - Should send message using shared bot token

2. **Test webhook:**
   - Send a message to the bot from Telegram
   - Check logs to verify routing works
   - Verify reply is logged correctly

### Verify Webhook is Set

```bash
# Check webhook info (requires bot token)
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Should return:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app.vercel.app/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

---

## Troubleshooting

### Issue: Messages not being received

**Check:**
1. Webhook is configured: `getWebhookInfo` shows correct URL
2. `TELEGRAM_BOT_TOKEN` is set in environment
3. User's `telegram_chat_id` matches their actual Telegram chat ID
4. User has sent at least one message to the bot

### Issue: Webhook returns 401 Unauthorized

**Check:**
1. `TELEGRAM_WEBHOOK_SECRET` is set in environment
2. Secret matches what was used when setting webhook
3. Telegram is sending the secret token in header

### Issue: Messages routed to wrong user

**Check:**
1. Chat IDs are unique per user
2. User's `telegram_chat_id` in database matches their actual Telegram chat ID
3. No duplicate chat IDs in database

---

## Benefits of Shared Bot

✅ **Simpler Onboarding**: Users don't need to create bots  
✅ **Less Friction**: Only Chat ID needed  
✅ **Easier Support**: One bot to manage  
✅ **Better UX**: No confusing bot creation steps  
✅ **Centralized Control**: You control the bot experience  

---

## Next Steps

1. ✅ Code changes complete
2. ⏳ Set `TELEGRAM_BOT_TOKEN` in Vercel
3. ⏳ Run database migration (make bot_token nullable)
4. ⏳ Set up webhook once
5. ⏳ Test with a user account
6. ⏳ Update user documentation

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Code Complete - Ready for Deployment

