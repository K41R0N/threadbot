# Supabase Database Setup Instructions

## Overview
This guide will help you fix two critical database issues:
1. **Telegram constraint error** - Allows ChatID without bot token (shared bot architecture)
2. **Missing timezone column** - Adds timezone column to verification codes table

## Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **"SQL Editor"** in the left sidebar
4. Click **"New query"** to create a new SQL query

### Step 2: Run the Complete Database Fix

1. Open the file: `supabase/complete_database_fix.sql`
2. **Copy the entire contents** of that file
3. **Paste it into the Supabase SQL Editor**
4. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Step 3: Verify the Fixes

After running the migration, verify both fixes worked:

#### Verify Fix 1: Constraint Update
Run this query in SQL Editor:
```sql
SELECT 
  constraint_name, 
  check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'telegram_config_complete';
```

**Expected Result**: You should see the constraint with the new check clause that allows `telegram_chat_id` without `telegram_bot_token`.

#### Verify Fix 2: Timezone Column
Run this query in SQL Editor:
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'telegram_verification_codes' 
AND column_name = 'timezone';
```

**Expected Result**: You should see a row with:
- `column_name`: `timezone`
- `data_type`: `text`
- `is_nullable`: `YES`

### Step 4: Test the Application

1. **Test Manual ChatID Entry**:
   - Go to Settings page
   - Try manually entering a ChatID
   - Should work without constraint error

2. **Test Verification Code Generation**:
   - Go to Settings or Calendar view
   - Click "Generate Verification Code"
   - Should work without timezone column error

## What the Fix Does

### Fix 1: Telegram Constraint
- **Before**: Required both `telegram_bot_token` AND `telegram_chat_id` to be set together
- **After**: Allows `telegram_chat_id` to be set independently (for shared bot architecture)
- **Why**: Your app uses a shared bot, so users only need their ChatID, not a bot token

### Fix 2: Timezone Column
- **Before**: `telegram_verification_codes` table was missing the `timezone` column
- **After**: Adds `timezone` column to store user's detected timezone
- **Why**: Code tries to insert/select timezone when generating verification codes

## Troubleshooting

### If you get "constraint already exists" error:
- The migration is idempotent and should handle this automatically
- If it still fails, manually drop the constraint first:
  ```sql
  ALTER TABLE bot_configs DROP CONSTRAINT IF EXISTS telegram_config_complete;
  ```
- Then run the migration again

### If you get "column already exists" error:
- The migration checks if the column exists before adding it
- If you still get this error, the column might already exist - verify with the check query above

### If verification still doesn't work:
1. Check that the `telegram_verification_codes` table exists:
   ```sql
   SELECT * FROM telegram_verification_codes LIMIT 1;
   ```
2. Check RLS policies are set correctly:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'telegram_verification_codes';
   ```

## Next Steps

After running the migration:
1. ✅ Manual ChatID entry should work
2. ✅ Verification code generation should work
3. ✅ Webhook linking should work
4. ✅ All existing functionality should continue to work

## Files Reference

- **Migration File**: `supabase/complete_database_fix.sql` - Run this in Supabase
- **Analysis Document**: `TELEGRAM_CONSTRAINT_FIX.md` - Detailed root cause analysis
- **Original Constraint Fix**: `supabase/fix_telegram_constraint.sql` - Just the constraint fix (included in complete fix)
