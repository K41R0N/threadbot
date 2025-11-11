# Stripe Integration & Danger Zone Logic

## Overview

This document outlines the logic for handling Stripe subscriptions when implementing the DANGER ZONE account deletion and data purge features after Stripe integration is complete.

**Current Status**: Stripe NOT integrated (all `stripe_customer_id` and `stripe_subscription_id` fields are NULL)

**When to implement**: Before launching real credit purchases via Stripe

---

## 1. Stripe Data Model

### 1.1 Database Fields

```sql
-- user_subscriptions table
stripe_customer_id TEXT,           -- Stripe customer ID (e.g., "cus_...")
stripe_subscription_id TEXT,       -- Stripe subscription ID (e.g., "sub_...") - ONLY if recurring
current_period_end TIMESTAMPTZ     -- Subscription end date (if applicable)
```

### 1.2 Payment Types

**One-Time Purchases** (Current Model):
- User buys credits: $9 = 3 generation credits
- Creates Stripe Payment Intent
- NO subscription created
- `stripe_subscription_id` remains NULL
- `stripe_customer_id` stored for payment history

**Recurring Subscriptions** (Future):
- Monthly subscription: $X/month = Y credits/month
- Creates Stripe Subscription
- Both `stripe_customer_id` AND `stripe_subscription_id` populated
- `current_period_end` tracks billing cycle

---

## 2. Current deleteAccount Flow

### 2.1 What It Does Now

```typescript
// server/routers.ts:605-669
deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
  // Deletes from ALL database tables including user_subscriptions
  const tables = [
    'bot_configs',
    'bot_state',
    'user_prompts',
    'user_generation_context',
    'user_weekly_themes',
    'agent_generation_jobs',
    'user_subscriptions', // <-- Deletes subscription record
  ];

  // Loop through and delete from each table
  // Returns success/failure with failed table list
});
```

### 2.2 The Problem

**Issue**: Deletes `user_subscriptions` row (containing `stripe_subscription_id`) WITHOUT canceling the active Stripe subscription.

**Impact**:
- User's Stripe subscription remains active
- User continues to be billed monthly
- No local record exists to track the subscription
- User believes account is deleted but is still charged

**Security/Legal Risk**: HIGH - violates user expectations, potential GDPR issues, billing fraud claims

---

## 3. Required Changes After Stripe Integration

### 3.1 Updated deleteAccount Flow

```typescript
deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
  const supabase = serverSupabase;

  SafeLogger.info('=== ACCOUNT DELETION REQUEST ===', { userId: ctx.userId });

  try {
    // STEP 1: Fetch user's subscription data BEFORE deletion
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, claude_credits')
      .eq('user_id', ctx.userId)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      SafeLogger.error('Failed to fetch subscription', { userId: ctx.userId, error: subError });
      return {
        success: false,
        message: 'Failed to fetch subscription data. Please contact support.',
      };
    }

    // STEP 2: Cancel Stripe subscription if exists
    if (subscription?.stripe_subscription_id) {
      SafeLogger.info('Canceling Stripe subscription', {
        userId: ctx.userId,
        subscriptionId: subscription.stripe_subscription_id,
      });

      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
          apiVersion: '2024-11-20.acacia', // Use latest version when implementing
        });

        // POLICY DECISION: Cancel immediately vs cancel_at_period_end
        // Option A: Immediate cancellation (recommended for deletion)
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

        // Option B: Cancel at period end (let them use remaining time)
        // await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        //   cancel_at_period_end: true,
        // });

        SafeLogger.info('Stripe subscription canceled', {
          userId: ctx.userId,
          subscriptionId: subscription.stripe_subscription_id,
        });
      } catch (stripeError: unknown) {
        const message = stripeError instanceof Error ? stripeError.message : String(stripeError);
        SafeLogger.error('Failed to cancel Stripe subscription', {
          userId: ctx.userId,
          subscriptionId: subscription.stripe_subscription_id,
          error: stripeError,
        });

        // CRITICAL: Do NOT proceed with deletion if Stripe cancellation fails
        return {
          success: false,
          message: `Failed to cancel your subscription. Please contact support with reference: ${subscription.stripe_subscription_id}. Error: ${message}`,
        };
      }
    }

    // STEP 3: Log credits being forfeited
    if (subscription?.claude_credits && subscription.claude_credits > 0) {
      SafeLogger.warn('User forfeiting credits on deletion', {
        userId: ctx.userId,
        creditsForfeited: subscription.claude_credits,
      });
    }

    // STEP 4: Delete from all tables (existing logic)
    const tables = [
      'bot_configs',
      'bot_state',
      'user_prompts',
      'user_generation_context',
      'user_weekly_themes',
      'agent_generation_jobs',
      'user_subscriptions',
    ];

    const failedTables: string[] = [];
    const successTables: string[] = [];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', ctx.userId);

      if (error) {
        SafeLogger.error(`Failed to delete from ${table}`, { userId: ctx.userId, error });
        failedTables.push(table);
      } else {
        SafeLogger.info(`Deleted from ${table}`, { userId: ctx.userId });
        successTables.push(table);
      }
    }

    // Report failure if ANY table failed to delete
    if (failedTables.length > 0) {
      SafeLogger.error('Account deletion incomplete - some tables failed', {
        userId: ctx.userId,
        failedTables,
        successTables,
      });

      return {
        success: false,
        message: `Account deletion incomplete. Failed to delete from: ${failedTables.join(', ')}. Successfully deleted from: ${successTables.join(', ')}. Your subscription has been canceled. Please contact support for manual cleanup.`,
      };
    }

    SafeLogger.info('Account deletion completed successfully', { userId: ctx.userId });

    return {
      success: true,
      message: 'Your account data has been deleted and subscription canceled. You can now delete your account from Clerk if desired.',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    SafeLogger.error('Account deletion failed', { userId: ctx.userId, error });
    return {
      success: false,
      message: `Failed to delete account: ${message}`,
    };
  }
}),
```

### 3.2 Updated purgeData Flow

**Current Behavior**: Preserves `user_subscriptions` (including credits and subscription IDs)

**After Stripe Integration**: Same behavior, but add warning if user has active subscription

```typescript
purgeData: protectedProcedure.mutation(async ({ ctx }) => {
  const supabase = serverSupabase;

  SafeLogger.info('=== DATA PURGE REQUEST ===', { userId: ctx.userId });

  try {
    // STEP 1: Check for active subscription
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, claude_credits')
      .eq('user_id', ctx.userId)
      .single();

    // Warn if user has active subscription (they might want to cancel it first)
    if (subscription?.stripe_subscription_id) {
      SafeLogger.info('User purging data with active subscription', {
        userId: ctx.userId,
        subscriptionId: subscription.stripe_subscription_id,
      });
    }

    // STEP 2: Purge all data tables (preserve user_subscriptions)
    const tables = [
      'bot_configs',
      'bot_state',
      'user_prompts',
      'user_generation_context',
      'user_weekly_themes',
      'agent_generation_jobs',
      // NOTE: user_subscriptions NOT included - preserves credits and subscription
    ];

    // ... existing purge logic ...

    return {
      success: true,
      message: `All data has been purged. Your subscription${subscription?.stripe_subscription_id ? ', active subscription,' : ''} and ${subscription?.claude_credits || 0} generation credits are preserved.`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    SafeLogger.error('Data purge failed', { userId: ctx.userId, error });
    return {
      success: false,
      message: `Failed to purge data: ${message}`,
    };
  }
}),
```

---

## 4. Stripe Configuration Setup

### 4.1 Environment Variables

Add to `.env.local`:
```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_... # or sk_live_... for production
STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_... for production
STRIPE_WEBHOOK_SECRET=whsec_... # For webhook signature verification

# Stripe Product IDs (create in Stripe Dashboard)
STRIPE_CREDITS_PRICE_ID=price_... # $9 = 3 credits product
```

### 4.2 Stripe Client Initialization

Create `/lib/stripe.ts`:
```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia', // Update to latest when implementing
  typescript: true,
});
```

### 4.3 Import in routers.ts

```typescript
import { stripe } from '@/lib/stripe';

// Use in deleteAccount mutation
await stripe.subscriptions.cancel(subscriptionId);
```

---

## 5. Policy Decisions Required

### 5.1 Subscription Cancellation Policy

**Question**: When user deletes account, should subscription cancel immediately or at period end?

**Option A: Immediate Cancellation** (Recommended)
- Pros: Clean break, aligns with user intent to delete
- Cons: User loses remaining time they paid for
- Implementation: `stripe.subscriptions.cancel(id)`

**Option B: Cancel at Period End**
- Pros: User gets value for remaining billing cycle
- Cons: Data remains until subscription expires (complicates deletion)
- Implementation: `stripe.subscriptions.update(id, { cancel_at_period_end: true })`

**Recommendation**: Option A (immediate) for account deletion, but inform user of forfeiture

### 5.2 Credit Forfeiture

**Question**: Should unused credits be refunded on account deletion?

**Option A: No Refunds** (Recommended)
- State clearly in ToS: "Credits are non-refundable"
- Warn user before deletion: "You will forfeit X credits"
- Simpler, standard practice

**Option B: Partial Refund**
- Calculate value of unused credits
- Issue Stripe refund
- More complex, operational overhead
- May be required by law in some jurisdictions (check with legal)

**Recommendation**: Option A, but check legal requirements for your jurisdiction

### 5.3 Failed Cancellation Handling

**Question**: If Stripe cancellation fails, should we still delete data?

**Answer**: NO - This is the core issue!

**Logic**:
1. Try to cancel Stripe subscription
2. If cancellation fails → ABORT deletion, return error
3. Only proceed with data deletion if cancellation succeeds
4. Log all failures for manual intervention

**User Message**: "Failed to cancel your subscription. Please contact support with reference: [subscription_id]"

---

## 6. UI Updates for Danger Zone

### 6.1 Delete Account Button

**Current**:
```tsx
<Button onClick={() => {
  const firstConfirm = window.confirm('⚠️ DELETE ACCOUNT - FIRST CONFIRMATION...');
  if (firstConfirm) {
    const secondConfirm = window.confirm('⚠️ FINAL CONFIRMATION...');
    if (secondConfirm) {
      const typeConfirm = window.prompt('Type DELETE...');
      if (typeConfirm === 'DELETE') {
        deleteAccount.mutate();
      }
    }
  }
}}>
  DELETE ACCOUNT
</Button>
```

**After Stripe Integration**:
```tsx
<Button onClick={() => {
  // Show subscription and credit info
  const hasSubscription = subscription?.stripe_subscription_id;
  const credits = subscription?.claude_credits || 0;

  let warningMessage = '⚠️ DELETE ACCOUNT - FIRST CONFIRMATION\n\n';
  warningMessage += 'This will permanently delete:\n';
  warningMessage += '• All your prompts and databases\n';
  warningMessage += '• All bot configurations\n';
  warningMessage += '• Your generation context and themes\n\n';

  if (hasSubscription) {
    warningMessage += '🔴 Your active subscription will be CANCELED immediately.\n\n';
  }

  if (credits > 0) {
    warningMessage += `💰 You will FORFEIT ${credits} unused credits (non-refundable).\n\n`;
  }

  warningMessage += 'This action CANNOT be undone. Continue?';

  const firstConfirm = window.confirm(warningMessage);

  // ... rest of confirmation flow
}}>
  DELETE ACCOUNT
</Button>
```

### 6.2 Purge Data Button

**Update Message**:
```tsx
<p className="text-sm text-gray-700 mb-4">
  Remove all your configurations, prompts, and bot data.
  Your subscription {subscription?.stripe_subscription_id ? '(ACTIVE)' : ''},
  credits ({subscription?.claude_credits || 0}), and billing info will be preserved.
</p>
```

---

## 7. Testing Checklist

### 7.1 Before Production

- [ ] Test deletion with NO subscription (current behavior)
- [ ] Test deletion with one-time purchase (customer_id but no subscription_id)
- [ ] Test deletion with ACTIVE subscription (must cancel successfully)
- [ ] Test deletion when Stripe API fails (should abort)
- [ ] Test purge with active subscription (should preserve)
- [ ] Verify Stripe webhook receives cancellation event
- [ ] Check Stripe Dashboard shows subscription as canceled
- [ ] Test with expired subscription (already canceled)

### 7.2 Error Scenarios

- [ ] Stripe API timeout → User sees error, data NOT deleted
- [ ] Stripe subscription already canceled → Deletion proceeds
- [ ] Stripe subscription doesn't exist → Deletion proceeds
- [ ] Invalid subscription ID → Log error, seek manual intervention
- [ ] Partial table deletion failure → User sees which tables failed

### 7.3 Logging Verification

- [ ] All Stripe calls logged with SafeLogger
- [ ] Credit forfeiture logged with amount
- [ ] Subscription cancellation success/failure logged
- [ ] No sensitive Stripe data in logs (use SafeLogger auto-redaction)

---

## 8. Stripe Webhook Handling (Optional Enhancement)

### 8.1 Why Webhooks?

**Problem**: User might cancel subscription directly in Stripe Dashboard

**Solution**: Listen for `customer.subscription.deleted` webhook to update local state

### 8.2 Implementation

Create `/app/api/webhooks/stripe/route.ts`:
```typescript
import { stripe } from '@/lib/stripe';
import { serverSupabase } from '@/lib/supabase-server';
import { SafeLogger } from '@/lib/logger';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing signature', { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;

      SafeLogger.info('Stripe subscription canceled via webhook', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });

      // Update local database
      const { error } = await serverSupabase
        .from('user_subscriptions')
        .update({
          stripe_subscription_id: null,
          current_period_end: null,
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        SafeLogger.error('Failed to update subscription status', { error });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    SafeLogger.error('Webhook error', { error });
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }
}
```

---

## 9. Implementation Timeline

### Phase 1: Stripe Integration (Separate Sprint)
1. Set up Stripe account and products
2. Implement credit purchase flow
3. Add webhook handling
4. Test payment flow end-to-end

### Phase 2: Danger Zone Updates (This Sprint)
1. Update deleteAccount with Stripe cancellation logic
2. Add subscription/credit warnings to UI
3. Test all deletion scenarios
4. Deploy with monitoring

### Phase 3: Monitoring (Ongoing)
1. Monitor deletion logs for failures
2. Track Stripe cancellation success rate
3. Handle edge cases as they arise

---

## 10. Legal & Compliance Notes

### 10.1 Terms of Service

Add clauses:
- Credits are non-refundable upon account deletion
- Subscriptions cancel immediately upon account deletion
- No prorated refunds for unused subscription time
- User responsible for canceling subscription before deletion if they want refund

### 10.2 GDPR Compliance

- Account deletion must remove all personal data
- Stripe customer data might be retained by Stripe (out of your control)
- Inform user in deletion flow: "Payment history may be retained by Stripe per their policy"
- Consider adding: "Request Stripe data deletion" link to Stripe's GDPR form

### 10.3 Recommended Deletion Flow Message

```
⚠️ ACCOUNT DELETION WARNING

This action will permanently:
✓ Delete all your data from our servers
✓ Cancel your active subscription (if any)
✓ Forfeit unused credits (non-refundable)

⚠️ Payment history may be retained by Stripe per their privacy policy.
If you want to request deletion of payment data, contact Stripe support.

This cannot be undone. Type DELETE to confirm.
```

---

## Summary

**Key Takeaway**: Before deleting user_subscriptions record, ALWAYS:
1. Fetch stripe_subscription_id from database
2. Call Stripe API to cancel subscription
3. If Stripe cancellation fails → ABORT deletion
4. Only proceed with data deletion after successful Stripe cancellation

**Files to Update**:
- `/server/routers.ts` - Add Stripe cancellation logic to deleteAccount
- `/lib/stripe.ts` - Create Stripe client (new file)
- `/app/settings/page.tsx` - Update deletion warnings with subscription/credit info
- `.env.local` - Add Stripe API keys
- `/app/api/webhooks/stripe/route.ts` - Handle subscription cancellation webhooks (optional)

**Priority**: CRITICAL - Implement before launching real credit purchases

**Estimated Effort**: 4-6 hours (with testing)
