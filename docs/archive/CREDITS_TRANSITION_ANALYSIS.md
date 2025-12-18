# Credits-Only System Transition Analysis

## Executive Summary

**Current State**: Hybrid system with "Pro/Free" tiers + Claude credits
**Proposed State**: Credits-only monetization where every "Pro" action costs 1 credit
**Stripe Status**: NOT INTEGRATED (all Stripe fields unused, payment shows "coming soon")

## 1. Current System Architecture

### 1.1 Database Schema (`user_subscriptions` table)

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Tier system (currently used for UI gating)
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),

  -- Credits system (currently used for Claude access)
  claude_credits INTEGER NOT NULL DEFAULT 0,

  -- Unused Stripe fields
  stripe_customer_id TEXT,              -- UNUSED
  stripe_subscription_id TEXT,          -- UNUSED
  current_period_end TIMESTAMPTZ,       -- UNUSED

  -- Onboarding
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  onboarding_skipped BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Current Monetization Model

**Pricing**: $9 one-time purchase = 3 Claude credits

**Access Rules**:
- **Free Tier Users** (`tier = 'free'`):
  - ✅ DeepSeek R1: Unlimited, free
  - ❌ Claude Sonnet 4.5: Blocked by tier check in UI
  - UI shows "PRO ONLY" overlay on Claude option
  - Can theoretically buy credits but UI suggests they need "Pro"

- **Pro Tier Users** (`tier = 'pro'`):
  - ✅ DeepSeek R1: Unlimited, free
  - ✅ Claude Sonnet 4.5: 1 credit per generation (if credits > 0)
  - No other benefits besides Claude access

**Credit System**:
- Function: `decrement_claude_credits(user_id)` - atomic decrement
- Timing: Deducted AFTER successful generation, BEFORE marking job complete
- Admin bypass: Admin user (`user_2qVl3Z4r8Ys9Xx7Ww6Vv5Uu4Tt3`) has unlimited credits

### 1.3 Where Tier is Currently Checked

**UI Components** (4 locations):
1. `/app/agent/create/page.tsx:446-475`
   - Blocks Claude option if `tier === 'free'`
   - Shows "Upgrade to Pro to use Claude Sonnet 4.5" toast
   - Displays "Pro Plan Required" overlay

2. `/app/agent/create/page.tsx:496-503`
   - Shows "⚠️ FREE TIER LIMIT" message
   - Text: "You can generate 1 database per week" (NOT ENFORCED)

3. `/app/dashboard/page.tsx:510`
   - Upgrade modal: "$9 one-time purchase"
   - Button shows "Stripe integration coming soon!"

**Server-Side** (1 location):
- `/server/routers/agent.ts:28-59` - `checkCredits()` function
  - **Does NOT check tier for blocking**
  - Only checks: `useClaude` flag + `claude_credits > 0`
  - Returns error if credits exhausted

**Actual Enforcement**: Credits are enforced server-side, tier is only used for UI gating.

### 1.4 Where Credits are Used

**Single Enforcement Point**:
- `/server/routers/agent.ts:398-407`
  - Deducts 1 credit when `useClaude === true`
  - Occurs during `generatePrompts` mutation
  - Happens after prompts are generated, before marking job complete
  - Admin users exempt from deduction

**Credit Display**:
- Dashboard shows credit count prominently
- Explains: "DeepSeek R1: FREE (Unlimited)" vs "Claude Sonnet 4.5: 1 CREDIT per generation"
- "Each purchase = 3 credits"

## 2. Proposed Credits-Only System

### 2.1 Conceptual Model

**Core Change**: Remove tier distinction, make credits the only currency

**New Rules**:
- All users start with 0 credits
- DeepSeek R1: Always free, unlimited (no credit cost)
- Claude Sonnet 4.5: Costs 1 credit per generation
- Users buy credits in packs (e.g., 3 for $9)
- No "Pro" vs "Free" distinction

**Optional Enhancement**:
- Allow users to spend 1 credit to generate with DeepSeek before monthly limit
- This removes the confusing "1 database per week" restriction

### 2.2 Benefits of This Approach

1. **Simpler Mental Model**:
   - One currency (credits) instead of two concepts (tier + credits)
   - Clear value proposition: pay per premium feature use

2. **No Tier Confusion**:
   - Current system: "I'm free tier, can I buy credits?" is ambiguous
   - New system: "Credits unlock premium features" is clear

3. **Flexible Monetization**:
   - Easy to add new "Pro" actions: just cost 1 credit each
   - Examples: Priority support, advanced analytics, custom themes

4. **No Stripe Subscription Complexity**:
   - One-time purchases only (current model)
   - No recurring billing, cancellation, refunds
   - Simpler compliance (no subscription regulations)

5. **Removes "Weekly Limit" Issue**:
   - Current UI claims "1 database per week" for free tier
   - Limit is NOT ENFORCED in code
   - Can be replaced with: "Use DeepSeek anytime, or spend 1 credit to generate now"

## 3. Required Changes

### 3.1 Database Schema Changes

**Option A: Minimal (Keep `tier` for compatibility)**
```sql
-- Keep tier column but make it vestigial
-- All users set to 'free', only credits matter
-- No code changes needed in RLS policies
ALTER TABLE user_subscriptions
  ALTER COLUMN tier SET DEFAULT 'free';

-- Update all existing users to 'free'
UPDATE user_subscriptions SET tier = 'free';

-- Add comment explaining the change
COMMENT ON COLUMN user_subscriptions.tier IS
  'DEPRECATED: Kept for compatibility. All access now controlled by claude_credits.';
```

**Option B: Clean Removal (Breaking change)**
```sql
-- Remove tier column entirely
ALTER TABLE user_subscriptions DROP COLUMN tier;

-- Update TypeScript types (lib/database.types.ts)
-- Remove tier from all type definitions
```

**Option C: Repurpose `tier` for future use**
```sql
-- Change tier to represent spending level (gamification)
-- e.g., 'bronze', 'silver', 'gold' based on total credits purchased
-- This preserves column for future features
ALTER TABLE user_subscriptions
  ALTER COLUMN tier TYPE TEXT,
  DROP CONSTRAINT user_subscriptions_tier_check,
  ADD CONSTRAINT user_subscriptions_tier_check
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum'));
```

**Recommendation**: Option A (minimal) for safety

**Stripe Fields**:
- Keep for future subscription features
- Add comment: "Reserved for future subscription tiers"
- No changes needed now

### 3.2 Code Changes by File

#### `/server/routers/agent.ts`

**Current `checkCredits()` function** (lines 28-59):
```typescript
async function checkCredits(userId: string, useClaude: boolean) {
  if (isAdmin(userId)) {
    return { allowed: true };
  }

  // Free tier using DeepSeek: unlimited, no credit check
  if (!useClaude) {
    return { allowed: true };
  }

  // Using Claude: check credits
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('claude_credits')
    .eq('user_id', userId)
    .single();

  const credits = subscription?.claude_credits || 0;

  if (credits <= 0) {
    return {
      allowed: false,
      error: 'No Claude credits remaining. Purchase more credits to generate with Claude.',
      needsCredits: true,
    };
  }

  return { allowed: true, credits };
}
```

**No changes needed** - already credits-based!

**`getSubscription` endpoint** (lines 63-79):
```typescript
// BEFORE:
return data || { claude_credits: 0, tier: 'free', current_period_end: null };

// AFTER (if removing tier):
return data || { claude_credits: 0, current_period_end: null };

// OR (if keeping tier as vestigial):
return data || { claude_credits: 0, tier: 'free', current_period_end: null };
```

**New `getOnboardingStatus`/`completeOnboarding`/`skipOnboarding`** (lines 546-655):
```typescript
// Update all places that insert default subscription:
// BEFORE:
.insert({
  user_id: ctx.userId,
  tier: 'free',  // <-- Remove or keep as vestigial
  claude_credits: 0,
  onboarding_completed: true,
})

// AFTER (credits-only):
.insert({
  user_id: ctx.userId,
  claude_credits: 0,
  onboarding_completed: true,
})
```

#### `/app/agent/create/page.tsx`

**Model Selection UI** (lines 440-477):

**BEFORE**:
```tsx
<button
  onClick={() => {
    if (subscription?.tier === 'free') {
      toast.error('Upgrade to Pro to use Claude Sonnet 4.5');
    } else {
      setUseClaude(true);
    }
  }}
  disabled={subscription?.tier === 'free'}
>
  <div className="font-display text-2xl mb-2">CLAUDE SONNET 4.5</div>
  <div className="text-xl">PRO ONLY</div>

  {subscription?.tier === 'free' && (
    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
      <div className="text-center">
        <div className="text-sm text-gray-600 mb-2">Pro Plan Required</div>
        <Button size="sm">UPGRADE →</Button>
      </div>
    </div>
  )}
</button>
```

**AFTER (Credits-only)**:
```tsx
<button
  onClick={() => {
    if ((subscription?.claude_credits || 0) === 0) {
      toast.error('Purchase credits to use Claude Sonnet 4.5');
    } else {
      setUseClaude(true);
    }
  }}
  disabled={(subscription?.claude_credits || 0) === 0}
>
  <div className="font-display text-2xl mb-2">CLAUDE SONNET 4.5</div>
  <div className="text-xl">1 CREDIT</div>

  {(subscription?.claude_credits || 0) === 0 && (
    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
      <div className="text-center">
        <div className="text-sm text-gray-600 mb-2">Credits Required</div>
        <Button size="sm" onClick={(e) => {
          e.stopPropagation();
          router.push('/dashboard'); // Goes to credit purchase
        }}>
          BUY CREDITS →
        </Button>
      </div>
    </div>
  )}
</button>
```

**Free Tier Limit Message** (lines 496-503):

**BEFORE**:
```tsx
{subscription?.tier === 'free' && (
  <div className="border-2 border-yellow-500 bg-yellow-50 p-4 mb-6">
    <div className="font-display text-sm mb-1">⚠️ FREE TIER LIMIT</div>
    <div className="text-sm text-gray-700">
      You can generate 1 database per week. After generation, you can manually edit prompts anytime.
    </div>
  </div>
)}
```

**AFTER (Remove entirely or replace)**:
```tsx
{/* Remove the message OR replace with usage tip */}
{(subscription?.claude_credits || 0) === 0 && (
  <div className="border-2 border-blue-500 bg-blue-50 p-4 mb-6">
    <div className="font-display text-sm mb-1">💡 TIP</div>
    <div className="text-sm text-gray-700">
      DeepSeek R1 is always free with unlimited generations. Purchase credits to unlock Claude Sonnet 4.5.
    </div>
  </div>
)}
```

#### `/app/dashboard/page.tsx`

**Credits Display** (lines 243-280) - **No changes needed!** Already perfect.

**Upgrade Modal** (lines 486-534):

**BEFORE**:
```tsx
<div className="text-3xl font-display mb-4">UPGRADE TO PRO</div>
<p className="text-gray-600 mb-6">
  Get access to Claude Sonnet 4.5 for best-in-class prompt generation
</p>
```

**AFTER**:
```tsx
<div className="text-3xl font-display mb-4">BUY CLAUDE CREDITS</div>
<p className="text-gray-600 mb-6">
  Each credit lets you generate 60 prompts (1 month) using Claude Sonnet 4.5
</p>
```

### 3.3 TypeScript Types

**`/lib/database.types.ts`** (lines 266-301):

**If removing tier**:
```typescript
// Remove tier from all three type definitions:
export type UserSubscription = {
  // tier: 'free' | 'pro' | 'enterprise';  // DELETE
  claude_credits: number;
  // ... rest
}

export type UserSubscriptionInsert = {
  // tier?: 'free' | 'pro' | 'enterprise';  // DELETE
  claude_credits?: number;
  // ... rest
}

export type UserSubscriptionUpdate = {
  // tier?: 'free' | 'pro' | 'enterprise';  // DELETE
  claude_credits?: number;
  // ... rest
}
```

**If keeping tier as vestigial**: No changes needed.

**`/lib/supabase-agent.ts`** (line 3):
```typescript
// If removing tier:
// export type UserTier = 'free' | 'pro' | 'enterprise';  // DELETE

// If keeping:
export type UserTier = 'free' | 'pro' | 'enterprise'; // DEPRECATED
```

### 3.4 Settings Page Cleanup

**`/app/settings/page.tsx:548`**:

**BEFORE**:
```tsx
<li>Keeps: Subscription tier, Claude credits, Stripe billing info</li>
```

**AFTER**:
```tsx
<li>Keeps: Claude credits, Stripe billing info</li>
```

## 4. Supabase Migration

### 4.1 Migration Strategy

**Recommended**: Two-phase approach

**Phase 1: Soft Transition** (Safe, reversible)
```sql
-- /supabase/migration_credits_only_phase1.sql

-- 1. Mark tier as deprecated
COMMENT ON COLUMN user_subscriptions.tier IS
  'DEPRECATED 2025-11-11: All access now controlled by claude_credits. Will be removed in Phase 2.';

-- 2. Set all users to 'free' (tier no longer matters)
UPDATE user_subscriptions
SET tier = 'free'
WHERE tier != 'free';

-- 3. Preserve credits for existing Pro users
-- (No action needed - credits already stored)

-- 4. Add new index for credit-based queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_credits_only
ON user_subscriptions(user_id, claude_credits)
WHERE claude_credits > 0;

-- 5. Log migration
DO $$
BEGIN
  RAISE NOTICE 'Phase 1 complete: Tier deprecated, all users set to free, credits preserved';
END $$;
```

**Phase 2: Full Cleanup** (After code deployed and tested)
```sql
-- /supabase/migration_credits_only_phase2.sql

-- Only run AFTER confirming Phase 1 works in production

-- 1. Drop tier column
ALTER TABLE user_subscriptions
DROP COLUMN tier;

-- 2. Drop tier index
DROP INDEX IF EXISTS idx_user_subscriptions_tier;

-- 3. Update RLS policies if they reference tier
-- (Review: No policies currently check tier)

-- 4. Update types
-- Run: pnpm run db:types

-- 5. Log migration
DO $$
BEGIN
  RAISE NOTICE 'Phase 2 complete: Tier column removed, schema cleanup finished';
END $$;
```

### 4.2 Migration Checklist

**Before Phase 1**:
- [ ] Backup production database
- [ ] Review all code references to `tier` field
- [ ] Confirm no RLS policies depend on tier
- [ ] Test locally with sample data

**Phase 1 Deployment**:
- [ ] Run migration SQL on production
- [ ] Deploy updated code (tier checks removed from UI)
- [ ] Monitor for errors in logs
- [ ] Test credit purchases work correctly
- [ ] Verify AI generation still functions

**Before Phase 2** (1-2 weeks later):
- [ ] Confirm no tier-related errors in logs
- [ ] Verify all credit operations working
- [ ] Get user feedback on new system
- [ ] Backup database again

**Phase 2 Deployment**:
- [ ] Run Phase 2 migration
- [ ] Update TypeScript types: `pnpm run db:types`
- [ ] Deploy type-safe code
- [ ] Smoke test all features

## 5. Impact Analysis

### 5.1 Breaking Changes

**Database**:
- ❌ **None** if using Phase 1 approach
- ⚠️ **Schema change** if removing tier column (Phase 2)

**API**:
- ✅ No breaking changes to tRPC endpoints
- ✅ `getSubscription` still returns same shape (if tier kept as vestigial)
- ⚠️ TypeScript types change if tier removed (caught at compile time)

**User Experience**:
- ✅ Simplifies mental model (one currency)
- ✅ Removes confusing "Pro" upgrade prompts
- ⚠️ Users currently on "Pro" tier see no change (credits still work)
- ⚠️ Free tier users see less gatekeeping (DeepSeek always available)

### 5.2 Risk Assessment

**LOW RISK**:
- ✅ Credit system already fully implemented
- ✅ No Stripe integration to migrate
- ✅ Server-side enforcement already credits-based
- ✅ Backward compatible with existing user data

**MEDIUM RISK**:
- ⚠️ UI changes could confuse existing users expecting "Pro" language
- ⚠️ TypeScript type changes require full recompile
- ⚠️ Need to test all credit purchase flows

**HIGH RISK**:
- ❌ None identified

### 5.3 Rollback Plan

**If Phase 1 issues occur**:
```sql
-- Restore tier values from backup
-- (No data loss - credits preserved)
UPDATE user_subscriptions
SET tier = backup_table.tier
FROM backup_table
WHERE user_subscriptions.user_id = backup_table.user_id;
```

**If Phase 2 issues occur**:
```sql
-- Cannot rollback column drop without restore
-- Must restore from full database backup
-- Reason: Need to test Phase 1 thoroughly first
```

## 6. Future Enhancements

### 6.1 "Pro Actions" as Credit Costs

With credits as the only currency, you can easily add new premium features:

**Examples**:
- **Regenerate single prompt**: 0.1 credits (1/10th cost)
- **Priority AI queue**: 0.5 credits per generation
- **Custom brand analysis**: 1 credit per analysis
- **Advanced analytics**: 0.5 credits per month
- **Export to multiple formats**: 0.2 credits per export

**Implementation**:
```typescript
// Add credit cost to each endpoint
async function checkCredits(userId: string, actionCost: number = 1) {
  if (isAdmin(userId)) return { allowed: true };

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('claude_credits')
    .eq('user_id', userId)
    .single();

  const credits = subscription?.claude_credits || 0;

  if (credits < actionCost) {
    return {
      allowed: false,
      error: `This action requires ${actionCost} credit(s). You have ${credits}.`,
      needsCredits: true,
    };
  }

  return { allowed: true, credits };
}
```

### 6.2 Credit Packs & Pricing

**Current**: $9 = 3 credits ($3/credit)

**Suggested tiers**:
- **Starter**: $9 = 3 credits ($3/credit)
- **Creator**: $25 = 10 credits ($2.50/credit) - 17% discount
- **Pro**: $75 = 35 credits ($2.14/credit) - 29% discount
- **Enterprise**: Custom pricing, bulk discounts

**Free credits for new users**:
- Give 1 free credit on signup to try Claude
- Incentivizes trying premium features
- Low cost ($3) for high conversion

### 6.3 Gamification

**Repurpose `tier` column** for user levels:
- Bronze: 0-10 credits purchased lifetime
- Silver: 11-50 credits purchased
- Gold: 51-100 credits purchased
- Platinum: 100+ credits purchased

**Benefits per level**:
- Bronze: Nothing (default)
- Silver: 5% discount on purchases
- Gold: 10% discount + priority support
- Platinum: 15% discount + custom features

## 7. Recommendations

### 7.1 Immediate Actions (This Sprint)

1. ✅ **Remove tier checks from UI** (`/app/agent/create/page.tsx`)
   - Replace `tier === 'free'` with `claude_credits === 0`
   - Change "PRO ONLY" to "1 CREDIT"
   - Update error messages

2. ✅ **Update dashboard messaging** (`/app/dashboard/page.tsx`)
   - Change "UPGRADE TO PRO" to "BUY CLAUDE CREDITS"
   - Emphasize credit pricing over tier system

3. ✅ **Remove "1 database per week" message**
   - Not enforced, causes confusion
   - Replace with: "DeepSeek: unlimited free"

4. ✅ **Run Phase 1 migration**
   - Set all tiers to 'free'
   - Mark tier column as deprecated
   - Test thoroughly in staging

### 7.2 Next Sprint

5. ✅ **Deploy Phase 1 to production**
   - Monitor for errors
   - Gather user feedback
   - Ensure credit purchases work

6. ✅ **Add credit purchase flow**
   - Integrate Stripe (finally!)
   - Test $9 = 3 credits flow
   - Add receipt emails

7. ✅ **Update documentation**
   - README.md: Explain credits-only system
   - Help docs: "How credits work"

### 7.3 Future Sprints

8. ⚠️ **Run Phase 2 migration** (after 2 weeks)
   - Remove tier column entirely
   - Update TypeScript types
   - Full regression test

9. 💡 **Add new credit-based features**
   - Regenerate single prompts (0.1 credit)
   - Custom themes (0.5 credits)
   - Advanced analytics (subscription?)

10. 🎮 **Implement gamification** (optional)
    - Repurpose tier for user levels
    - Add loyalty discounts
    - Track lifetime credit purchases

## 8. Open Questions

1. **DeepSeek Credit Cost**: Should unlimited DeepSeek generation require 1 credit to incentivize purchases, or stay free to maintain freemium model?
   - **Pro Free**: Lowers barrier to entry, gets users hooked
   - **Pro Paid**: Prevents abuse, generates revenue from heavy users
   - **Recommendation**: Keep free, add optional "priority" for 0.5 credits

2. **"Weekly Limit" Enforcement**: UI claims "1 database per week" for free tier, but not enforced. Should we:
   - Remove message entirely (recommended)
   - Actually enforce the limit for DeepSeek
   - Replace with: "Unlimited DeepSeek, or 1 credit for Claude"

3. **Stripe Subscription Fields**: Keep unused columns for future recurring subscriptions?
   - **Yes**: Enables monthly subscriptions later (e.g., "Pro: $9/mo = 5 credits")
   - **No**: YAGNI principle, add when needed
   - **Recommendation**: Keep for now, costs nothing

4. **Admin Credit Bypass**: Admin has unlimited credits. Should this change?
   - Keep for testing
   - Track admin usage separately
   - Consider adding "test mode" flag instead

5. **Credit Refunds**: If user deletes account, refund unused credits?
   - Legal implications (varies by jurisdiction)
   - Operational cost of refunds
   - **Recommendation**: State "no refunds" in ToS, handle exceptions manually

## 9. Summary

**Current State**:
- Confusing hybrid: "Pro tier" + "Claude credits"
- UI blocks Claude for free tier, but server only checks credits
- Stripe not integrated, all fields unused
- "1 database per week" limit mentioned but not enforced

**Proposed State**:
- Simple credits-only system
- Credits unlock all premium features (starting with Claude)
- Clear value: $9 = 3 credits = 3 months of Claude prompts
- Easy to extend: any "Pro" action can cost credits

**Why This Works**:
- ✅ Server already enforces credits, not tier
- ✅ No Stripe subscriptions to migrate
- ✅ Simplifies user mental model
- ✅ Enables flexible pricing for new features
- ✅ Low risk, backward compatible

**Next Steps**:
1. Remove tier checks from UI (1 day)
2. Run Phase 1 migration - deprecate tier (1 hour)
3. Test thoroughly in staging (1 day)
4. Deploy to production (monitor for 1-2 weeks)
5. Run Phase 2 migration - remove tier column (optional)

**Decision Required**: Approve Phase 1 migration and UI changes?
