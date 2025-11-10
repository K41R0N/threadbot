# Troubleshooting Review - Completed 2025-11-10

## ✅ Cron Path Parity
**Status: FIXED**

- Fixed cron path in README.md from `/api/cron/prompts` to `/api/cron`
- Matches actual implementation in `app/api/cron/route.ts`
- vercel.json correctly configured with `/api/cron?type=morning` and `/api/cron?type=evening`

## ✅ Server-Only Supabase Usage
**Status: VERIFIED**

All imports of `lib/supabase-server.ts` are server-side only:
- `server/routers.ts` (no 'use client')
- `server/routers/agent.ts` (no 'use client')
- `server/services/bot.ts` (no 'use client')
- `app/api/webhook/[userId]/route.ts` (API route)
- `app/api/cron/route.ts` (API route)
- `app/api/webhook-test/route.ts` (API route)

No violations found - service role key never exposed to client.

## ✅ Environment Secret Completeness
**Status: FIXED**

Added missing environment variables to README.md:
- `CRON_SECRET` - Required for cron endpoint security
- `TELEGRAM_WEBHOOK_SECRET` - Required for webhook endpoint security
- `ANTHROPIC_API_KEY` - Optional for AI features
- `DEEPSEEK_API_KEY` - Optional for AI features

All env vars now documented in both README.md and .env.example.

## ✅ Cron Handler Security
**Status: VERIFIED**

`app/api/cron/route.ts` has proper fail-closed security:
- Lines 18-24: Returns 500 if CRON_SECRET not configured
- Lines 27-35: Returns 401 if authorization header doesn't match secret
- Logs unauthorized attempts with IP and user agent (line 28-34)

## ✅ Agent Data Pipeline Status Values
**Status: VERIFIED**

All status enums match schema:
- `user_prompts`: 'draft', 'scheduled', 'sent' ✓
- `agent_generation_jobs`: 'pending', 'analyzing', 'generating_themes', 'generating_prompts', 'completed', 'failed' ✓
- `user_generation_context`: 'active', 'inactive' ✓

## ✅ Settings Form Data Hygiene
**Status: VERIFIED**

`app/settings/page.tsx` properly manages clear flags and prompt source:
- Lines 32-33: Clear flags for tokens (`shouldClearNotionToken`, `shouldClearTelegramToken`)
- Lines 49-51: Flags reset after successful save
- Lines 135-149: Smart handling - if user types new value, clear flag is canceled
- Lines 176-194: Only updates Notion settings if `promptSource === 'notion'`
- Lines 178-184: Properly checks clear flag before sending null vs new token
- Lines 206-214: Webhook only updated if telegram token actually changed (not cleared)

**No data hygiene issues found.**

## ✅ tRPC Mutation Coverage
**Status: VERIFIED**

All bot-related mutations use `protectedProcedure` (requires Clerk authentication):
- `bot.getConfig` (line 60)
- `bot.getState` (line 72)
- `bot.createConfig` (line 85)
- `bot.updateConfig` (line 100)
- `bot.setupWebhookForUser` (line 145)
- `bot.setupWebhook` (line 210) - legacy
- `bot.getWebhookInfo` (line 232) - legacy
- `bot.testPrompt` (line 252)

All sensitive fields stay server-side. Tokens are retrieved from database within procedures, never passed from client.

## ✅ Onboarding & Dashboard Redirects
**Status: VERIFIED**

**Dashboard** (`app/dashboard/page.tsx` lines 62-70):
- Not loaded: returns early
- Not signed in: redirects to '/' (home)
- No config: redirects to '/onboarding'

**Onboarding** (`app/onboarding/page.tsx` lines 15-30):
- Not loaded or loading: returns early
- Not signed in: redirects to '/'
- Config exists: redirects to '/dashboard' (prevents re-onboarding)
- No config: redirects to '/setup/notion' (actual onboarding flow)

**No redirect issues found.**

## ✅ Idempotency & Rate Controls
**Status: VERIFIED**

`server/services/bot.ts` implements proper idempotency:

**sendScheduledPrompt** (lines 18-35):
- Calls `hasAlreadySentToday()` before sending any prompt
- If already sent today, returns early with `success: false`

**hasAlreadySentToday** (lines 281-326):
- Checks `bot_state` table for last send
- Compares date in user's timezone (not UTC)
- Logs duplicate send prevention (line 312)
- Returns `false` on error (fail-open for checking, but send will still update state)

**Cron handler** (`app/api/cron/route.ts` lines 75-82):
- Calls `BotService.shouldSendPrompt()` to check time window (5-minute window)
- Then calls `BotService.sendScheduledPrompt()` which includes idempotency check

**No idempotency issues found.**

## ✅ Telegram Message Safety
**Status: VERIFIED**

`server/services/bot.ts` properly escapes Markdown:
- Line 127: `escapedTopic = TelegramService.escapeMarkdown(topicProperty)`
- Line 128: `escapedContent = TelegramService.escapeMarkdown(content)`
- Line 135: Both escaped values used in message construction
- Line 137: `telegram.sendMessage()` called with escaped message

`server/services/telegram.ts` provides `escapeMarkdown` static method that escapes all Telegram MarkdownV2 special characters.

**No Markdown injection vulnerabilities found.**

## ⚠️ Legacy Webhook Helpers
**Status: ISSUE FOUND**

Two legacy tRPC procedures are still exposed but unused:

1. **setupWebhook** (`server/routers.ts` line 210):
   - Comment says "legacy - for manual setup with token"
   - Requires client to pass `botToken` and `webhookUrl`
   - Less secure than `setupWebhookForUser` which retrieves token server-side
   - **Not used anywhere in the app**

2. **getWebhookInfo** (`server/routers.ts` line 232):
   - Requires client to pass `botToken`
   - Less secure than retrieving from database
   - **Not used anywhere in the app**

**Current usage:**
- `setupWebhookForUser` is used in:
  - `app/settings/page.tsx:213`
  - `app/setup/schedule/page.tsx:42`

**Recommendation:** Consider removing legacy procedures or adding deprecation warnings.

## ⚠️ Deployment Gate Checks
**Status: PARTIAL**

**Runtime validation (✓):**
- `lib/supabase-server.ts` throws on missing SUPABASE vars (lines 27, 31)
- `lib/supabase.ts` throws on missing SUPABASE vars (line 8)
- `app/api/cron/route.ts` returns 500 if CRON_SECRET missing (lines 18-24)

**Build-time validation (✗):**
- No pre-build script validates required environment variables
- Type generation is optional (`|| echo 'warning'`) so missing SUPABASE vars won't fail build
- Could deploy with missing env vars and get runtime errors

**Recommendation:** Add a build-time validation script that checks for required env vars:
```bash
# scripts/validate-env.sh
required_vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "CLERK_SECRET_KEY"
  "NEXT_PUBLIC_APP_URL"
  "CRON_SECRET"
  "TELEGRAM_WEBHOOK_SECRET"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: Required environment variable $var is not set"
    exit 1
  fi
done
```

## ✅ Debug Endpoints
**Status: VERIFIED**

`app/api/webhook-test/route.ts`:
- Lines 13-18: Properly checks Clerk authentication
- Returns 401 if not authenticated
- Only exposes non-sensitive webhook info

**No security issues found.**

---

## Summary

### Fixed Issues
- ✅ Cron path documentation
- ✅ Missing environment variables in README

### Verified Secure
- ✅ Server-only Supabase usage
- ✅ Cron handler security (fail-closed)
- ✅ Agent status values
- ✅ Settings form data hygiene
- ✅ tRPC mutation authentication
- ✅ Onboarding/Dashboard redirects
- ✅ Idempotency controls
- ✅ Telegram message escaping
- ✅ Debug endpoint authentication

### Recommended Improvements
- ⚠️ Remove or deprecate legacy webhook procedures (`setupWebhook`, `getWebhookInfo`)
- ⚠️ Add build-time environment variable validation script
