# Security Fix: RLS on schema_migrations Table

## Issue Summary

**Table**: `public.schema_migrations`  
**Problem**: Row Level Security (RLS) is not enabled on this table.  
**Severity**: Medium (Security Best Practice)

### Why This Matters

1. **Public Schema Exposure**: Tables in the `public` schema are automatically exposed to PostgREST (Supabase's REST API)
2. **Default Access**: Without RLS enabled, the table could be accessible to `anon` and `authenticated` roles
3. **Operational Table**: `schema_migrations` is an internal Supabase table that tracks migration history - clients should never access it
4. **Security Baseline**: Best practice is to enable RLS on all public-facing tables, even if they're operational

### Risk Assessment

- **Low Immediate Risk**: The `schema_migrations` table typically contains only migration metadata (version numbers, timestamps)
- **Medium Long-term Risk**: Without RLS, there's potential for:
  - Information disclosure (revealing migration history, deployment patterns)
  - Unauthorized access attempts
  - Compliance/audit issues

---

## Solution Implemented

### Migration File: `supabase/enable_rls_schema_migrations.sql`

**Approach**: Enable RLS + Revoke Client Access (Most Secure)

1. **Enable RLS**: `ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;`
   - Blocks all access by default until policies are defined

2. **Revoke Client Privileges**: `REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated;`
   - Prevents any access via PostgREST from client applications
   - Service role (which bypasses RLS) can still access for migration operations

3. **No Policies Created**: Since clients shouldn't access this table, no policies are needed
   - With RLS enabled and no policies, all client access is denied
   - Service role operations (migrations) continue to work

---

## Alternative Approaches (Not Used)

### Option 1: Enable RLS Only
```sql
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
```
- **Pros**: Simple, blocks access by default
- **Cons**: Still allows potential PostgREST exposure if privileges aren't revoked

### Option 2: Move to Internal Schema
```sql
ALTER TABLE public.schema_migrations SET SCHEMA internal;
```
- **Pros**: Completely removes from public exposure
- **Cons**: Requires careful handling of dependencies, may break Supabase tooling

### Option 3: Create Restrictive Policy
```sql
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all" ON public.schema_migrations FOR ALL USING (false);
```
- **Pros**: Explicit denial policy
- **Cons**: More complex, revoking privileges is cleaner

---

## Validation Steps

After running the migration:

1. **Verify RLS is Enabled**:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND tablename = 'schema_migrations';
   -- Should return rowsecurity = true
   ```

2. **Verify Privileges are Revoked**:
   ```sql
   SELECT grantee, privilege_type 
   FROM information_schema.role_table_grants 
   WHERE table_schema = 'public' 
     AND table_name = 'schema_migrations'
     AND grantee IN ('anon', 'authenticated');
   -- Should return no rows
   ```

3. **Test Client Access** (should fail):
   ```bash
   # Via Supabase REST API (should return 403 or empty)
   curl -H "apikey: YOUR_ANON_KEY" \
        https://YOUR_PROJECT.supabase.co/rest/v1/schema_migrations
   ```

4. **Verify Service Role Still Works**:
   - Run a migration to confirm service role can still access the table
   - This should work because service role bypasses RLS

5. **Re-run Security Lint**:
   - The Supabase security advisor should no longer flag this issue

---

## Impact Assessment

### ✅ What Still Works
- Supabase migration operations (service role bypasses RLS)
- Database migrations via Supabase CLI
- Internal Supabase tooling

### ❌ What's Blocked
- Client access via PostgREST (`anon` and `authenticated` roles)
- Direct queries from application code (unless using service role, which shouldn't happen)

### ⚠️ Breaking Changes
- **None**: This table should never be accessed by clients anyway
- If any code was accessing this table (which would be unusual), it will now fail

---

## Deployment Instructions

1. **Review the migration file**: `supabase/enable_rls_schema_migrations.sql`

2. **Run in Supabase SQL Editor**:
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the migration SQL
   - Execute

3. **Or via Supabase CLI** (if using migrations):
   ```bash
   # Add the migration file to your migrations directory
   # Then run:
   supabase db push
   ```

4. **Verify**: Follow validation steps above

---

## Related Tables to Check

Consider checking other operational tables for similar issues:
- `supabase_migrations.schema_migrations` (if exists)
- Any other internal/metadata tables in the `public` schema

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgREST Access Control](https://postgrest.org/en/stable/auth.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/security)

---

**Status**: ✅ Migration Created - Ready to Deploy  
**Created**: 2025-01-XX  
**Priority**: Medium (Security Best Practice)

