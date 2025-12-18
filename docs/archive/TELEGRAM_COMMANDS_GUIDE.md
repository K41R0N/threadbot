# Telegram Bot Commands Guide

## Overview

The Threadbot Telegram bot now supports commands to make account setup and management easier and more reliable.

## Available Commands

### `/start` or `/verify`
**Purpose**: Connect your Telegram account to Threadbot

**What it does**:
- If **not linked**: Provides step-by-step instructions to connect your account
- If **already linked**: Confirms your connection status and shows bot activity status

**Example flow**:
1. User sends `/start` to the bot
2. Bot responds with instructions to generate a verification code from the dashboard
3. User goes to dashboard, generates code
4. User sends the 6-digit code to the bot
5. Account is linked automatically

### `/status`
**Purpose**: Check your connection status and bot activity

**What it shows**:
- Connection status (Linked/Not Linked)
- Bot activity status (Active/Inactive)
- Last prompt sent timestamp
- Quick tips for activation

### `/help`
**Purpose**: Get help and see all available commands

**What it shows**:
- List of all commands
- Quick instructions for connecting
- Link to dashboard for support

## Improved Verification Flow

### Before (Issues)
- Users had to know to generate a code first
- No clear instructions in the bot
- Verification codes could be treated as replies to old prompts
- No feedback when codes didn't work

### After (Fixed)
1. **Command-based initiation**: Users can start with `/start` or `/verify`
2. **Clear instructions**: Bot provides step-by-step guidance
3. **State reset**: Generating a code resets bot conversation state
4. **Better error handling**: Bot responds with helpful messages when codes fail
5. **Rate limiting**: Prevents brute-force attacks (10 attempts max, 1-hour lockout)

## Technical Implementation

### Command Detection
Commands are detected by checking if the message starts with `/`:
```typescript
const isCommand = messageText.startsWith('/');
const command = messageTextLower.split(' ')[0]; // Get command without parameters
```

### Command Priority
Commands are handled **before** verification codes and replies:
1. Commands (`/start`, `/verify`, `/status`, `/help`)
2. Verification codes (6-digit numbers or "hello")
3. Replies to prompts (for linked users)

### State Management
When generating a verification code:
- Bot conversation state is reset (clears `last_prompt_*` fields)
- Old verification codes are cleaned up
- Fresh verification code is generated

## User Experience Flow

### New User Setup
```
User → /start
Bot → "Welcome! To connect: 1. Go to dashboard 2. Generate code 3. Send code here"
User → [Goes to dashboard, generates code]
User → [Sends 6-digit code]
Bot → "✅ Account Linked! You can now receive prompts..."
```

### Returning User Check
```
User → /status
Bot → "📊 Your Threadbot Status
      🔗 Connection: ✅ Linked
      📱 Bot Status: ✅ Active
      📅 Last Prompt: [timestamp]"
```

### Verification Issues
```
User → [Sends wrong/expired code]
Bot → "❌ Verification Code Not Found
      The code is either expired, already used, or incorrect.
      Attempt 3 of 10. Account locks after 10 failed attempts."
```

## Security Features

1. **Rate Limiting**: 
   - 10 verification attempts per hour per chat
   - 1-hour lockout after 10 failed attempts
   - Automatic reset after 1 hour of inactivity

2. **State Reset**: 
   - Bot conversation state cleared when generating codes
   - Prevents old prompts from interfering with verification

3. **Clear Feedback**: 
   - Users know exactly what went wrong
   - Attempt counter shows remaining tries
   - Lockout messages explain when they can try again

## Database Tables

### `verification_attempts`
Tracks verification attempts per chat_id:
- `chat_id`: Telegram chat ID
- `attempt_count`: Number of attempts
- `last_attempt_at`: Timestamp of last attempt
- `locked_until`: Optional lockout period

### `send_cooldowns`
Tracks "Send Now" button usage:
- `user_id`: Clerk user ID
- `cooldown_key`: Unique key per prompt
- `send_count`: Number of sends in current hour
- `last_sent_at`: Timestamp of last send

## Migration Required

If you haven't run these migrations yet, run them in Supabase SQL Editor:

1. `supabase/verification_rate_limiting.sql` - For rate limiting
2. `supabase/send_cooldowns.sql` - For send cooldowns

## Testing

To test the commands:

1. **Test `/start` when not linked**:
   - Send `/start` to bot
   - Should receive connection instructions

2. **Test `/start` when linked**:
   - Link account first
   - Send `/start` to bot
   - Should receive confirmation with status

3. **Test `/status`**:
   - Send `/status` to bot
   - Should show current connection and activity status

4. **Test `/help`**:
   - Send `/help` to bot
   - Should show all available commands

5. **Test verification flow**:
   - Send `/start` → Get instructions
   - Generate code from dashboard
   - Send code to bot
   - Should link successfully

## Future Enhancements

Potential improvements:
- `/link <code>` - Direct code linking via command
- `/unlink` - Disconnect Telegram account
- `/settings` - Quick access to common settings
- Inline keyboard buttons for common actions
- Web app integration for seamless dashboard access
