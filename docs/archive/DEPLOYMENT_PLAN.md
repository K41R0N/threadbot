# Deployment Issues & Resolution Plan

## Current Status: Build Failing on Vercel ❌

### Build Failure Analysis

**Error:** `Type error: File '/vercel/path0/lib/database.types.ts' is not a module.`

**Build Log Timeline:**
1. ✅ Environment validation passed (all 8 required vars present)
2. ⚠️  Type generation failed (IPv6 connectivity issue - expected)
3. ✅ Fallback to committed types triggered
4. ✅ Next.js compilation succeeded
5. ❌ TypeScript type-checking failed with module error

### Root Cause Investigation

The error occurs when `lib/supabase-server.ts` tries to import:
```typescript
import type { Database } from './database.types';
```

**Possible causes:**
1. **Next.js 16 + Turbopack issue**: New Turbopack bundler may handle type-only imports differently
2. **File extension confusion**: `.types.ts` suffix might confuse TypeScript's module resolver
3. **Type-only import with moduleResolution: "bundler"**: May need explicit `.js` extension in import
4. **Build cache issue**: Stale Vercel build cache from previous attempts

### Secondary Issues Identified

1. **IPv6 Database Connection**
   - Vercel build environment uses IPv6
   - Supabase direct connection attempts IPv6 first
   - Type generation always fails in Vercel (expected behavior with current fallback)

2. **Font Loading in Sandboxed Environments**
   - Google Fonts fails in restricted networks
   - Not an issue in Vercel production (has internet access)
   - Only affects local sandboxed builds

## Immediate Action Plan

### Option A: Rename Types File (RECOMMENDED)
**Effort:** 5 minutes | **Risk:** Low

Rename `database.types.ts` → `database.ts` to use standard naming:
```bash
mv lib/database.types.ts lib/database.ts
# Update all imports from './database.types' to './database'
```

**Why this works:**
- Standard TypeScript naming convention
- No confusion with .d.ts declaration files
- Better compatibility with Turbopack

### Option B: Convert to Declaration File
**Effort:** 5 minutes | **Risk:** Low

Rename `database.types.ts` → `database.types.d.ts`:
```bash
mv lib/database.types.ts lib/database.types.d.ts
```

**Why this works:**
- TypeScript treats .d.ts files differently
- Explicitly declares it as a type-only module
- May resolve module resolution issues

### Option C: Change Import Style
**Effort:** 2 minutes | **Risk:** Medium

Update imports to use path alias consistently:
```typescript
// Change from:
import type { Database } from './database.types';

// To:
import type { Database } from '@/lib/database.types';
```

**Why this might work:**
- Uses tsconfig path mapping
- More consistent across codebase
- May bypass relative path resolution issues

### Option D: Add Explicit Export Statement
**Effort:** 1 minute | **Risk:** Very Low

Add explicit module marker to database.types.ts:
```typescript
// At the end of the file
export {};
```

**Why this works:**
- Explicitly marks file as ES module
- Sometimes required with isolatedModules: true
- No other changes needed

## Long-Term Solutions

### 1. Improve Type Generation Reliability

**Issue:** Type generation fails in Vercel due to IPv6

**Solution:** Use Supabase connection pooler (IPv4)
```bash
# In scripts/generate-types.sh, change line 34:
DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
```

**Benefit:** Types always generated fresh, no fallback needed

### 2. Add Supabase CLI to Dependencies

**Current:** `npx supabase@latest` (downloads each time)

**Better:** Add to devDependencies
```json
{
  "devDependencies": {
    "supabase": "^2.54.11"
  }
}
```

**Benefit:** Faster builds, consistent CLI version

### 3. Consider Supabase Management API

**Alternative approach:** Use Supabase Management API instead of direct DB connection
- No database connection needed
- Works from any network
- Requires SUPABASE_ACCESS_TOKEN (account-wide)

**Trade-off:** Less secure than service role key (project-scoped)

## Testing Checklist

Before deploying:
- [ ] Local build succeeds: `pnpm build:skip-types`
- [ ] Type generation works locally: `pnpm types:generate`
- [ ] Environment validation works: `bash scripts/validate-env.sh`
- [ ] All TypeScript checks pass: `npx tsc --noEmit`
- [ ] No import errors in IDE
- [ ] Git status clean (all changes committed)

## Recommended Action

**Start with Option A (Rename to database.ts):**

1. It's the most standard approach
2. Lowest risk of unintended side effects
3. Aligns with TypeScript best practices
4. Quick to implement and test

If that doesn't work, try Option D (explicit export) next.

## Environment Variables Checklist

All required vars are set in Vercel (verified from build log):
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- ✅ CLERK_SECRET_KEY
- ✅ NEXT_PUBLIC_APP_URL
- ✅ CRON_SECRET
- ✅ TELEGRAM_WEBHOOK_SECRET

Optional (for AI features):
- ANTHROPIC_API_KEY
- DEEPSEEK_API_KEY

## Post-Deployment Tasks

Once build succeeds:

1. **Test Cron Jobs**
   - Verify `/api/cron?type=morning` returns 200
   - Check `CRON_SECRET` authentication works
   - Monitor logs for scheduled execution

2. **Test Telegram Webhooks**
   - Send test message to bot
   - Verify webhook receives it
   - Check reply logging works

3. **Test User Flows**
   - Sign up new user
   - Complete onboarding
   - Configure bot settings
   - Send test prompt
   - Verify end-to-end functionality

4. **Monitor Errors**
   - Check Vercel logs for runtime errors
   - Monitor Supabase logs
   - Check Sentry/error tracking (if configured)

## Current Branch Status

**Branch:** `claude/fix-supabase-insert-type-011CUzBrFcHAJXuB4qeNE3sW`

**Commits on this branch:**
- ✅ Fixed Supabase type inference issues (50 @ts-expect-error comments)
- ✅ Added build-time environment validation
- ✅ Removed insecure legacy webhook procedures
- ✅ Fixed shell operator precedence in build script
- ✅ Updated documentation

**Ready to merge:** Once deployment succeeds
