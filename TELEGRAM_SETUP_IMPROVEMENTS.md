# Telegram Setup Improvements - Complete Guide

## Overview

The Telegram setup flow has been completely redesigned to be **frictionless, intuitive, and reliable**. Users no longer need to manually find their Chat ID - everything happens automatically through a verification code flow.

## Key Improvements

### 1. **Verification Code Flow (Primary Method)**
- **Settings Page**: Users can generate a verification code directly from Settings
- **Calendar View**: After generating prompts, users see a modal with verification code
- **Automatic Linking**: When user sends "hello" or the code to the bot, their account is automatically linked
- **No Manual Entry Required**: Chat ID is captured automatically from Telegram

### 2. **Manual Entry (Fallback)**
- Still available for users who prefer manual setup
- Located below the verification code flow in Settings
- Uses @userinfobot to get Chat ID

### 3. **Auto-Creation of Bot Config**
- `updateConfig` mutation automatically creates `bot_configs` record if it doesn't exist
- Works seamlessly for AI-only users who haven't set up Telegram yet
- Auto-activates bot if user has prompts and connects Telegram

### 4. **Better Error Messages**
- Clear guidance when webhook setup fails
- Helpful messages directing users to use verification code flow
- Prevents confusion about what to do next

## Setup Flow

### For New Users (AI Path)

1. **Generate Prompts** (`/agent/create`)
   - User creates prompts database
   - Redirected to calendar view

2. **Connect Telegram** (Modal appears automatically)
   - Click "OPEN TELEGRAM & GENERATE CODE"
   - Verification code is generated
   - Telegram opens automatically
   - User sends "hello" or code to bot
   - Account is linked automatically
   - Bot is auto-activated (since user has prompts)

3. **Done!** Bot starts sending daily prompts

### For Existing Users (Settings Page)

1. **Go to Settings** (`/settings`)
2. **Telegram Section**:
   - If not connected: Click "GENERATE VERIFICATION CODE"
   - Code appears with instructions
   - Open Telegram and send code or "hello"
   - Account links automatically
   - Or use manual entry fallback

3. **Save Settings** - Config is created/updated automatically

## Technical Details

### Environment Variables Required

```bash
# Required for Telegram bot to work
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_SECRET=random_secret_for_webhook_security
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Bot Username Fallback

If `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is not set, the app defaults to `'threadbot_bot'`. However, **this should always be set** to match your actual bot username.

### Webhook Setup

- Webhook is set up automatically when user connects Telegram
- Uses shared webhook URL: `/api/webhook`
- Routes messages to users based on `telegram_chat_id`
- Only needs to be set once (shared bot)

### Auto-Activation Logic

- If user has prompts (`user_prompts` table) AND connects Telegram → Bot auto-activates
- If user connects Telegram but has no prompts → Bot stays inactive (user can activate manually)
- `prompt_source` is set to `'agent'` if user has prompts, `'notion'` otherwise

## Troubleshooting

### "Bot configuration not found" Error

**Cause**: User tried to setup webhook before connecting Telegram

**Solution**: 
- Use the verification code flow to connect Telegram first
- The config will be created automatically when Telegram is linked

### Button Goes to telegram.org Instead of Bot

**Cause**: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` environment variable is not set

**Solution**:
1. Get your bot username from @BotFather
2. Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` in Vercel environment variables
3. Redeploy the application

### Can't Add Chat ID to Field

**Cause**: Input field might be disabled or form validation issue

**Solution**:
- Use the verification code flow instead (recommended)
- Or check browser console for errors
- Ensure you're logged in and have proper permissions

### Verification Code Not Working

**Check**:
1. Bot token is set in environment variables
2. Webhook is configured (check `/api/webhook` endpoint)
3. User sent message to correct bot username
4. Verification code hasn't expired (10 minutes)

## Files Modified

- `app/settings/page.tsx` - Added verification code flow, improved UI
- `app/agent/database/range/[startDate]/[endDate]/page.tsx` - Improved modal and button behavior
- `server/routers.ts` - Improved error messages, auto-config creation
- `app/api/webhook/route.ts` - Handles verification code linking

## Best Practices

1. **Always use verification code flow** - It's the easiest and most reliable
2. **Set environment variables** - Ensure all required vars are configured
3. **Test webhook** - Use the "TEST NOW" button in Settings after connecting
4. **Monitor logs** - Check Vercel logs if issues occur

## Next Steps

1. Ensure `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set in Vercel
2. Test the verification code flow end-to-end
3. Verify webhook is working with test button
4. Monitor for any edge cases or errors

