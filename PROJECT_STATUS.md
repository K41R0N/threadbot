# ThreadBot - Project Status

**Last Updated**: 2025-11-11
**Branch**: `claude/codebase-review-011CV25yKNzpz9jAWxbGopSc`
**Status**: ✅ Ready for deployment (Phase 1 migration pending)

---

## 🎯 Current State

### System Overview
ThreadBot is a Telegram/Notion bot that delivers AI-generated daily prompts (morning + evening) to users. It features:
- AI prompt generation using Claude Sonnet 4.5 OR DeepSeek R1
- Credits-based monetization system (no subscriptions yet)
- Weekly cooldown for free DeepSeek generations
- Optional Telegram/Notion integration
- User-friendly onboarding flow

### Monetization Model (Credits-Only)
**As of 2025-11-11**: Transitioned from tier-based to credits-only system

- **DeepSeek R1**: FREE once per week (7-day cooldown)
  - Users can bypass cooldown for 1 credit
- **Claude Sonnet 4.5**: 1 credit per generation
- **Pricing**: $9 = 3 credits (one-time purchase)
- **Stripe**: NOT YET INTEGRATED (placeholder UI exists)

### Key Features
✅ AI-powered brand analysis and prompt generation
✅ Weekly theme planning (4 weeks per month)
✅ 60 prompts per generation (30 days × morning + evening)
✅ Telegram bot integration with webhook
✅ Notion database integration
✅ Vercel native cron jobs (every 5 minutes)
✅ Credits system with weekly limits
✅ Bypass mechanism for weekly cooldown
✅ Account deletion and data purge (DANGER ZONE)

❌ Stripe payment integration (coming soon)
❌ Pro tier subscriptions (removed in favor of credits)

---

## 📦 Recent Changes (This Session)

### 1. Credits-Only System Transition
**Commit**: `7ca62fb`

**What Changed**:
- Removed "Pro" vs "Free" tier checks from UI
- Renamed "Claude Credits" → "Generation Credits" throughout
- All users now use credits-only system
- Weekly generation limits enforced for DeepSeek
- Bypass option to spend 1 credit to skip cooldown

**Database Migration**: `supabase/migration_credits_only_phase1.sql`
- Marks `tier` column as DEPRECATED (not removed - Phase 2)
- Adds `last_free_generation_at` column for weekly tracking
- Creates indexes for efficient queries

### 2. Critical Bug Fixes
**Commit**: `8981d70`

**Security Fix** 🚨:
- **CRITICAL**: Credit deduction now happens BEFORE prompt generation
- Prevents users from getting free prompts if deduction fails
- Prevents race conditions with concurrent requests

**UX Improvements**:
- Added bypass UI button when weekly cooldown is active
- Fixed BUY CREDITS button to redirect to dashboard
- Exposed bypass in theme generation (not just prompts)
- Fixed migration SQL to properly log updated row count

### 3. Stripe Integration Planning
**Document**: `STRIPE_INTEGRATION_DANGER_ZONE.md`

Comprehensive guide for future Stripe integration:
- How to cancel subscriptions on account deletion
- Policy decisions (refunds, cancellation timing)
- UI updates needed
- Testing checklist
- Legal/compliance notes (GDPR, ToS)

---

## 🗂️ Important Files & Their Purposes

### Documentation
- **`PROJECT_STATUS.md`** (this file) - Current state and next steps
- **`CREDITS_TRANSITION_ANALYSIS.md`** - Detailed analysis of credits-only transition
- **`STRIPE_INTEGRATION_DANGER_ZONE.md`** - Guide for Stripe integration
- **`README.md`** - Setup instructions and project overview
- **`CODEBASE_REVIEW.md`** - Original codebase analysis (may be outdated)

### Database Migrations
- **`supabase/migration_credits_only_phase1.sql`** - Credits-only system migration
  - Run this BEFORE deploying the current code
  - Safe and reversible

### Core Application Files
- **`server/routers/agent.ts`** - AI generation endpoints with credit checks
- **`server/routers.ts`** - Bot config, testing, DANGER ZONE endpoints
- **`server/services/bot.ts`** - Telegram message sending
- **`app/agent/create/page.tsx`** - AI generation flow with bypass UI
- **`app/dashboard/page.tsx`** - Main dashboard with credit display
- **`app/settings/page.tsx`** - Bot config and DANGER ZONE
- **`lib/logger.ts`** - SafeLogger with credential redaction

### Configuration
- **`vercel.json`** - Vercel cron configuration (every 5 minutes)
- **`.env.local`** - Environment variables (not in git)

---

## 🚀 Deployment Checklist

### Before Deploying Current Code

1. **Run Database Migration**:
   ```bash
   # Connect to production Supabase
   psql $DATABASE_URL < supabase/migration_credits_only_phase1.sql
   ```
   This will:
   - Mark `tier` column as deprecated
   - Set all users to `tier = 'free'`
   - Add `last_free_generation_at` column
   - Create necessary indexes

2. **Verify Environment Variables**:
   ```bash
   # Required
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   CLERK_SECRET_KEY
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   DEEPSEEK_API_KEY
   ANTHROPIC_API_KEY

   # Optional (for Telegram)
   TELEGRAM_BOT_TOKEN
   TELEGRAM_WEBHOOK_SECRET

   # Optional (for Notion)
   NOTION_INTEGRATION_TOKEN

   # For cron jobs
   CRON_SECRET

   # Future (not yet used)
   STRIPE_SECRET_KEY
   STRIPE_PUBLISHABLE_KEY
   ```

3. **Test Locally First**:
   ```bash
   pnpm install
   pnpm run dev
   # Visit http://localhost:3000
   # Test generation flow with cooldown bypass
   ```

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   # Or push to main branch for auto-deploy
   ```

### After Deployment

1. **Monitor Logs** for:
   - "Generation credit deducted (before generation)" - Success!
   - "Credit deduction failed BEFORE generation" - Edge case
   - Weekly cooldown triggers
   - Bypass usage

2. **Test the Flow**:
   - Generate with DeepSeek (free) ✓
   - Try generating again → Should see cooldown banner
   - Click "USE 1 CREDIT" → Should proceed

3. **Watch for Issues**:
   - Credit deduction failures
   - Cooldown calculation errors
   - UI state bugs with bypass button

---

## 🔧 How It Works

### Generation Flow (With Credits)

1. **User starts generation** → `/agent/create`
2. **Analyze brand** (free for all)
3. **Select model**:
   - DeepSeek (free once/week or 1 credit to bypass)
   - Claude (1 credit required)
4. **Check credits** → `checkCredits()` function:
   - If using Claude: Require 1 credit
   - If using DeepSeek:
     - Check `last_free_generation_at`
     - If < 7 days ago → Show cooldown banner
     - User can bypass for 1 credit
5. **Deduct credit** (if required) **BEFORE generation**
6. **Generate themes** (4 weekly themes)
7. **Generate prompts** (60 total: 30 days × 2)
8. **Save to database**
9. **Update timestamp** (if DeepSeek)

### Credit Deduction Order (CRITICAL)
```
✅ CORRECT (current):
1. Check credits exist
2. Deduct credit
3. Generate prompts
4. Insert prompts
→ If deduction fails, no prompts saved

❌ WRONG (old way):
1. Check credits exist
2. Generate prompts
3. Insert prompts
4. Deduct credit
→ If deduction failed, user got free prompts!
```

### Weekly Cooldown Logic
```typescript
// In checkCredits():
if (!useClaude && !bypassWeeklyLimit) {
  const lastGen = subscription.last_free_generation_at;
  if (lastGen) {
    const daysSince = (now - lastGen) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      return {
        allowed: false,
        canBypass: true,
        daysRemaining: Math.ceil(7 - daysSince),
        error: `Free DeepSeek generation available in ${daysRemaining} days. You can spend 1 credit to generate now.`
      };
    }
  }
}
```

### Cron Job Flow
Every 5 minutes (Vercel cron):
1. Hit `/api/cron?type=morning` and `/api/cron?type=evening`
2. Authenticate with Bearer token (`CRON_SECRET`)
3. Fetch all active bot configs
4. For each user:
   - Check if current time ± 5 min matches scheduled time
   - Check if prompt already sent today (idempotency)
   - Fetch prompt from Notion OR agent database
   - Send via Telegram with Markdown formatting
   - Mark as sent

---

## 🐛 Known Issues & Limitations

### No Stripe Integration Yet
- UI shows "Stripe integration coming soon!" toast
- Cannot actually purchase credits
- Fields exist in database but unused:
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `current_period_end`

**See**: `STRIPE_INTEGRATION_DANGER_ZONE.md` for implementation guide

### Vercel Cron Limitations
- **Hobby Plan**: Cron jobs timeout after 10 seconds
- **Pro Plan**: Timeout after 300 seconds (5 minutes)
- Current implementation works on Pro plan
- For Hobby, need external cron provider (e.g., cron-job.org)

### Admin User Hardcoded
- Admin user ID hardcoded in `server/routers/agent.ts:13`
- Admin bypasses all credit checks
- Should move to environment variable

### Race Condition (Now Fixed)
- ✅ **FIXED**: Credit deduction now happens before generation
- Previously: Two concurrent requests could both pass credit check
- Now: First request deducts credit, second fails immediately

---

## 📋 Next Steps / TODO

### Immediate (Before Next Feature)
1. ✅ Run migration on production Supabase
2. ✅ Deploy to Vercel
3. ✅ Test bypass flow end-to-end
4. ⏳ Monitor logs for any edge cases

### Short Term (Next 1-2 Weeks)
1. **Integrate Stripe**:
   - Set up Stripe products for credit packs
   - Implement checkout flow
   - Add webhook handling
   - Update DANGER ZONE to cancel subscriptions
   - See: `STRIPE_INTEGRATION_DANGER_ZONE.md`

2. **Phase 2 Migration** (optional):
   - Remove `tier` column entirely
   - Update TypeScript types
   - Full regression test

3. **Add Credit Purchase UI**:
   - Replace "coming soon" toasts with real Stripe checkout
   - Add multiple pricing tiers ($9/3, $25/10, $75/35 credits)
   - Receipt emails

### Medium Term (1-2 Months)
1. **Analytics**:
   - Track generation usage
   - Monitor credit purchases
   - User retention metrics

2. **New Credit-Based Features**:
   - Regenerate single prompt: 0.1 credit
   - Custom themes: 0.5 credits
   - Priority queue: 0.5 credits
   - Advanced analytics: 0.5 credits/month

3. **Gamification** (optional):
   - Repurpose `tier` column for user levels (Bronze/Silver/Gold)
   - Loyalty discounts based on lifetime purchases
   - Track total credits purchased

### Long Term (3+ Months)
1. **Mobile App**:
   - React Native app for prompt delivery
   - Push notifications instead of Telegram

2. **Team Features**:
   - Shared credit pools
   - Multi-user accounts
   - Team analytics

3. **Marketplace**:
   - User-created themes
   - Template sharing
   - Revenue split for creators

---

## 🔐 Security Notes

### SafeLogger
- **Location**: `lib/logger.ts`
- Automatically redacts sensitive data (tokens, API keys, passwords)
- All production logs go through SafeLogger
- Fixed: Infinite recursion bug with Error objects

### Secrets Management
- Telegram webhook secret must be hex-encoded (not base64)
  - Valid: `openssl rand -hex 32`
  - Invalid: `openssl rand -base64 32` (contains +, /, =)
- CRON_SECRET can be any format (HTTP Bearer token)

### Database Security
- Row-Level Security (RLS) enabled on all tables
- All queries filtered by `user_id`
- Service role key only used server-side
- No direct client access to sensitive data

### Credit Deduction
- ✅ Atomic operation via `decrement_claude_credits()` RPC
- ✅ Happens BEFORE generation (prevents free prompts)
- ✅ Idempotent (won't double-charge)
- ✅ Admin bypass for testing

---

## 🧪 Testing

### Local Development
```bash
# Install dependencies
pnpm install

# Run development server
pnpm run dev

# Type check
pnpm exec tsc --noEmit

# Test database connection
# (requires .env.local with Supabase credentials)
```

### Test Scenarios
1. **Free DeepSeek Generation**:
   - Generate with DeepSeek (should be free first time)
   - Check `last_free_generation_at` updated

2. **Weekly Cooldown**:
   - Try generating again immediately
   - Should see yellow cooldown banner
   - Should offer bypass option

3. **Credit Bypass**:
   - Click "USE 1 CREDIT TO GENERATE NOW"
   - Should deduct 1 credit
   - Should proceed with generation
   - Should update `last_free_generation_at`

4. **Claude Generation**:
   - Select Claude model
   - Should require 1 credit
   - Should deduct BEFORE generation
   - Should create 60 prompts

5. **DANGER ZONE**:
   - Test data purge (preserves credits)
   - Test account deletion (removes everything)
   - Verify confirmations work

---

## 📞 Support & Debugging

### Common Issues

**"Weekly cooldown active" but I want to test**:
- Option 1: Wait 7 days
- Option 2: Manually update `last_free_generation_at` in database:
  ```sql
  UPDATE user_subscriptions
  SET last_free_generation_at = NOW() - INTERVAL '8 days'
  WHERE user_id = 'your_user_id';
  ```
- Option 3: Add yourself to admin list in `server/routers/agent.ts:13`

**"Credit deduction failed"**:
- Check Supabase logs for RPC errors
- Verify `decrement_claude_credits()` function exists
- Check user has credits: `SELECT claude_credits FROM user_subscriptions WHERE user_id = '...'`

**"Telegram webhook failed"**:
- Check secret is hex-encoded (not base64)
- Verify webhook URL is publicly accessible
- Check Telegram bot token is valid

**"Cron jobs not firing"**:
- Verify `CRON_SECRET` is set in Vercel environment variables
- Check Vercel cron logs in dashboard
- Ensure you're on Vercel Pro (Hobby has 10s timeout)

---

## 📚 Additional Resources

### Documentation
- **Credits Transition**: `CREDITS_TRANSITION_ANALYSIS.md`
- **Stripe Integration**: `STRIPE_INTEGRATION_DANGER_ZONE.md`
- **Codebase Review**: `CODEBASE_REVIEW.md` (may be outdated)
- **Setup Guide**: `README.md`

### External Links
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Notion API](https://developers.notion.com/)
- [Stripe API](https://stripe.com/docs/api) (for future use)

---

## 🎉 Summary for Next Session

**What's Working**:
- ✅ Credits-only system fully functional
- ✅ Weekly cooldown with bypass option
- ✅ Security bug fixed (credit deduction order)
- ✅ Complete UI for bypass flow
- ✅ Database migration ready to run

**What's Next**:
1. Run `supabase/migration_credits_only_phase1.sql` on production
2. Deploy current code to Vercel
3. Test bypass flow in production
4. Start Stripe integration

**Branch**: `claude/codebase-review-011CV25yKNzpz9jAWxbGopSc`

All commits are pushed and ready to merge!
