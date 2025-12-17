# Telegram Verification Code Setup

## Overview

Users can now connect their Telegram account with a single click! The system generates a verification code, opens Telegram, and automatically links the account when the user sends the code (or just says "hello").

## How It Works

1. **User clicks "Open Telegram"** button
2. **System generates a 6-digit verification code** (valid for 10 minutes)
3. **Telegram opens** with the bot chat
4. **User sends the code** (or just says "hello")
5. **System automatically links** their chat ID to their account
6. **User is redirected** to the next step

## Setup Required

### 1. Database Migration

Run the verification codes migration:

```sql
-- Run this in Supabase SQL Editor
\i supabase/verification_codes_migration.sql
```

Or copy the contents of `supabase/verification_codes_migration.sql` into Supabase SQL Editor.

### 2. Environment Variable

Add your bot's username to environment variables:

**Variable Name:** `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`  
**Value:** Your bot's username (e.g., `threadbot_bot`)  
**Environments:** Production, Preview, Development

**Note:** If not set, defaults to `threadbot_bot`

### 3. Update Bot Username

Make sure your bot's username matches what you set in the environment variable. You can check/change it via @BotFather on Telegram.

## User Flow

### Automatic Flow (Recommended)
1. User clicks "📱 OPEN TELEGRAM" button
2. Verification code is generated and displayed
3. Telegram opens automatically
4. User sends code or says "hello"
5. Account is linked automatically
6. User proceeds to next step

### Manual Flow (Fallback)
- Users can still skip and enter Chat ID manually if needed

## Security

- **Code Expiration:** Codes expire after 10 minutes
- **One-Time Use:** Each code can only be used once
- **User-Specific:** Codes are tied to specific user accounts
- **Automatic Cleanup:** Expired codes are cleaned up automatically

## Troubleshooting

### Issue: Code not working

**Check:**
1. Code hasn't expired (10-minute window)
2. Code hasn't been used already
3. User is sending to the correct bot
4. Webhook is configured correctly

### Issue: "hello" not linking account

**Check:**
1. User has an active verification code (generated within last 10 minutes)
2. User is sending to the correct bot
3. Webhook is receiving messages

### Issue: Button doesn't open Telegram

**Check:**
1. `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set correctly
2. Bot username matches the environment variable
3. User's browser allows popups

## Code Structure

### Database Table
- `telegram_verification_codes` - Stores verification codes
  - `user_id` - Clerk user ID
  - `code` - 6-digit code
  - `chat_id` - Set when verified
  - `expires_at` - Expiration timestamp
  - `used_at` - When code was used

### API Endpoints
- `bot.generateVerificationCode` - Generates a new code
- `bot.checkChatIdLinked` - Polls to check if account was linked

### Webhook Logic
- Detects verification codes (6-digit numbers)
- Detects "hello", "hi", "hey" messages
- Links chat ID to user account
- Sends confirmation message

## Testing

1. **Generate Code:**
   - Click "Open Telegram" button
   - Verify code is displayed

2. **Send Code:**
   - Open Telegram
   - Send the code to the bot
   - Verify account is linked

3. **Send "hello":**
   - Generate a new code
   - Send "hello" to the bot
   - Verify account is linked

4. **Expired Code:**
   - Generate a code
   - Wait 10+ minutes
   - Try to use it
   - Should fail gracefully

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Ready for Testing

