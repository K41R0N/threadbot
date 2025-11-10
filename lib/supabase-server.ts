/**
 * SECURITY: Server-side Supabase client with service role key
 *
 * ⚠️ WARNING: This file contains privileged access credentials
 *
 * NEVER import this file in client-side code:
 * - Not in 'use client' components
 * - Not in pages without getServerSideProps/getStaticProps
 * - Not in any code that runs in the browser
 *
 * ONLY use in:
 * - API routes (app/api/*)
 * - Server components (without 'use client')
 * - Server-side services (server/*)
 * - tRPC server procedures
 *
 * The service role key bypasses ALL Row Level Security (RLS) policies.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!serviceRoleKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

/**
 * Server-side Supabase client with service role privileges
 *
 * SECURITY: This client bypasses all RLS policies - use with caution
 * Always validate user permissions in your application logic
 *
 * Singleton client instance created at module load
 *
 * NOTE: Due to a type inference issue in @supabase/supabase-js v2.80.0,
 * the .from().insert/update operations may need type assertions.
 * Data objects should still use explicit Database types for safety.
 */
export const serverSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
