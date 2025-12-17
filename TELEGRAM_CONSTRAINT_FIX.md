# Telegram Config Constraint Fix - Root Cause Analysis

## Problem
When manually inputting ChatID, users get this error:
```
Failed to update: Failed to create bot configuration: new row for relation "bot_configs" violates check constraint "telegram_config_complete"
```

## Root Cause Analysis

### Current Constraint Definition
The `telegram_config_complete` constraint requires:
- **Either**: Both `telegram_bot_token` AND `telegram_chat_id` are NULL
- **Or**: Both `telegram_bot_token` AND `telegram_chat_id` are NOT NULL

```sql
CHECK (
  (telegram_bot_token IS NULL AND telegram_chat_id IS NULL)
  OR
  (telegram_bot_token IS NOT NULL AND telegram_chat_id IS NOT NULL)
)
```

## 5 Possible Causes

### 1. **Architecture Mismatch (PRIMARY CAUSE)**
- **Issue**: The constraint was designed for the **old per-user bot model** where each user had their own bot token
- **Reality**: The app now uses a **shared bot architecture** where users only need their ChatID
- **Impact**: When users manually enter ChatID without a bot token, the constraint fails
- **Evidence**: 
  - Webhook route sets `telegram_bot_token = null` (line 123 in `app/api/webhook/route.ts`)
  - Settings page only collects ChatID, not bot token
  - Shared bot token comes from `TELEGRAM_BOT_TOKEN` environment variable

### 2. **Missing Validation in updateConfig Mutation**
- **Issue**: The `updateConfig` mutation doesn't validate the constraint before inserting/updating
- **Location**: `server/routers.ts` lines 189-200 (INSERT) and 132-142 (UPDATE)
- **Impact**: Code allows partial Telegram configs that violate the database constraint
- **Fix Needed**: Add constraint-aware validation OR update the constraint

### 3. **Inconsistent State Handling**
- **Issue**: When creating a new config, if only `telegram_chat_id` is provided, `telegram_bot_token` defaults to `null`
- **Location**: `server/routers.ts` line 193: `telegram_bot_token: input.telegramBotToken || null`
- **Impact**: Creates invalid state that violates constraint
- **Evidence**: Line 194 sets `telegram_chat_id: input.telegramChatId || null` - if ChatID is set but token isn't, constraint fails

### 4. **Constraint Not Updated for Shared Bot Migration**
- **Issue**: The constraint was never updated when the app migrated from per-user bots to shared bot
- **Evidence**: 
  - `supabase/schema_migration.sql` adds the constraint (lines 11-17)
  - `supabase/consolidated_migration.sql` makes fields nullable but doesn't update constraint
  - No migration exists to modify the constraint for shared bot architecture

### 5. **Frontend Doesn't Collect Bot Token**
- **Issue**: Settings page (`app/settings/page.tsx`) only has input for ChatID, not bot token
- **Location**: Lines 600-610 - only `telegramChatId` input field
- **Impact**: Users can't provide bot token even if they wanted to (but they shouldn't need to)
- **Note**: This is actually correct behavior for shared bot, but the constraint doesn't reflect this

## Permanent Fix

### Solution: Update Constraint for Shared Bot Architecture

The constraint should allow `telegram_chat_id` to be set independently since users don't need their own bot token with the shared bot architecture.

**New Constraint Logic:**
- Allow `telegram_chat_id` to be set without `telegram_bot_token` (shared bot users)
- Still prevent partial configs where only `telegram_bot_token` is set (makes no sense)
- Allow both to be null (user hasn't set up Telegram yet)

**New Constraint:**
```sql
CHECK (
  -- Case 1: Both null (user hasn't set up Telegram)
  (telegram_bot_token IS NULL AND telegram_chat_id IS NULL)
  OR
  -- Case 2: Only chat_id is set (shared bot - most common case)
  (telegram_bot_token IS NULL AND telegram_chat_id IS NOT NULL)
  OR
  -- Case 3: Both are set (legacy per-user bot support, if needed)
  (telegram_bot_token IS NOT NULL AND telegram_chat_id IS NOT NULL)
  -- Case 4: Only bot_token is set - NOT ALLOWED (makes no sense)
)
```

**Recommended Approach**: Use the flexible constraint that supports:
- Shared bot users (chat_id only) - PRIMARY USE CASE
- Users who haven't set up Telegram yet (both null)
- Legacy per-user bot support (both set) - for backwards compatibility

## Implementation Steps

1. **Create Migration File**: `supabase/fix_telegram_constraint.sql`
2. **Update Constraint**: Drop old constraint, add new one
3. **Test**: Verify manual ChatID entry works
4. **Update Documentation**: Note that bot token is always null for shared bot

## Migration SQL

See `supabase/fix_telegram_constraint.sql` for the complete migration.
