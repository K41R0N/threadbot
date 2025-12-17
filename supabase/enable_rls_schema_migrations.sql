-- Enable RLS on schema_migrations table for security compliance
-- This table tracks Supabase migration history and should not be accessible via PostgREST

-- Step 1: Enable Row Level Security
ALTER TABLE IF EXISTS public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- Step 2: Revoke all privileges from anon and authenticated roles
-- This prevents any client access via PostgREST, which is appropriate for operational tables
REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated;

-- Step 3: Add a comment explaining the security posture
COMMENT ON TABLE public.schema_migrations IS 
  'Operational table for tracking Supabase migrations. RLS enabled and client access revoked for security.';

-- Note: No policies are created because this table should not be accessible via PostgREST.
-- Service role (which bypasses RLS) can still access it for migration operations.

