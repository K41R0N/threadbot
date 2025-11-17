# ThreadBot: Supabase Implementation Guide

**Author**: AI Analysis
**Date**: 2025-11-13
**Purpose**: Complete technical overview of Supabase setup and architecture for replication

---

## **Table of Contents**

1. [Architecture Overview](#1-architecture-overview)
2. [Client Setup](#2-client-setup)
3. [Database Schema](#3-database-schema)
4. [Row Level Security (RLS)](#4-row-level-security-rls)
5. [PostgreSQL Functions](#5-postgresql-functions)
6. [Type Safety](#6-type-safety)
7. [Usage Patterns](#7-usage-patterns)
8. [Environment Setup](#8-environment-setup)
9. [Setup Checklist](#9-setup-checklist)

---

## **1. Architecture Overview**

ThreadBot uses a **dual-client architecture** to separate privileged operations from client-side queries:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT-SIDE (Browser)                │
│  - Uses ANON_KEY (limited permissions)                  │
│  - Subject to Row Level Security (RLS)                  │
│  - Read-only queries in components                      │
│  - File: lib/supabase.ts                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ tRPC API calls
                     │
┌────────────────────▼────────────────────────────────────┐
│                 SERVER-SIDE (API Routes)                │
│  - Uses SERVICE_ROLE_KEY (full permissions)             │
│  - BYPASSES all RLS policies                            │
│  - All mutations and sensitive queries                  │
│  - File: lib/supabase-server.ts                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ PostgreSQL
                     │
┌────────────────────▼────────────────────────────────────┐
│                   SUPABASE DATABASE                     │
│  - PostgreSQL with extensions                           │
│  - Row Level Security (RLS) enabled                     │
│  - Functions, triggers, indexes                         │
│  - Schema: supabase/complete_schema.sql                 │
└─────────────────────────────────────────────────────────┘
```

### Key Principle: **Separation of Privilege**
- **Client-side**: Limited permissions (RLS enforced)
- **Server-side**: Full permissions (RLS bypassed, manual filtering required)

---

## **2. Client Setup**

### **A. Server-Side Client** (`lib/supabase-server.ts`)

This is the **privileged client** used in API routes, tRPC procedures, and server components.

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * SECURITY: Service role key bypasses ALL RLS policies
 * NEVER import in client-side code
 */
let serverSupabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getServerSupabase() {
  if (!serverSupabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    serverSupabaseInstance = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,  // No auth needed (service role)
        persistSession: false,     // No session persistence
      },
    });
  }
  return serverSupabaseInstance;
}

// Lazy initialization via Proxy pattern
export const serverSupabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get: (_, prop) => {
    const client = getServerSupabase();
    return client[prop as keyof typeof client];
  }
});
```

#### **Key Features:**
- ✅ **Lazy initialization**: Only creates client on first use (prevents build-time errors)
- ✅ **Singleton pattern**: One instance across all requests
- ✅ **Proxy pattern**: Allows typing while deferring initialization
- ✅ **No auth config**: Service role doesn't need sessions
- ✅ **Type-safe**: Uses generated `Database` type

#### **Why Lazy Init + Proxy?**
```typescript
// ❌ PROBLEM: Immediate initialization
export const serverSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,  // Throws during build!
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ SOLUTION: Lazy init via Proxy
export const serverSupabase = new Proxy(...);
// Only accesses env vars when actually used at runtime
```

---

### **B. Client-Side Client** (`lib/supabase.ts`)

This is the **limited client** for browser/client components.

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get: (_, prop) => {
    const client = getSupabaseClient();
    return client[prop as keyof typeof client];
  }
});
```

#### **Key Differences from Server Client:**
- ✅ Uses `ANON_KEY` (limited permissions)
- ✅ Subject to RLS policies
- ✅ Default auth config (supports sessions)
- ✅ Safe to import in client components

---

## **3. Database Schema**

### **Schema Structure** (`supabase/complete_schema.sql`)

```sql
-- 1. CORE BOT CONFIGURATION
bot_configs         -- Telegram/Notion settings (timezone, schedule, tokens)
bot_state           -- Runtime state (last prompt sent, idempotency)

-- 2. AI AGENT SYSTEM
user_prompts               -- Generated prompt calendar (60 prompts per generation)
user_generation_context    -- Brand analysis (voice, themes, audience)
user_weekly_themes         -- 4 weekly themes per month
agent_generation_jobs      -- Job tracking (pending/completed/failed)

-- 3. SUBSCRIPTION & CREDITS
user_subscriptions  -- Credits, tier, onboarding status, Stripe IDs
```

### **Key Tables Deep Dive**

#### **user_subscriptions** (Monetization)
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,  -- Clerk user ID

  -- Credits-only system
  tier TEXT NOT NULL DEFAULT 'free',  -- DEPRECATED (kept for compatibility)
  claude_credits INTEGER NOT NULL DEFAULT 0,  -- Generation credits
  last_free_generation_at TIMESTAMPTZ,  -- Weekly cooldown tracking

  -- Stripe integration (future)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_skipped BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **user_prompts** (AI-Generated Content)
```sql
CREATE TABLE user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  date DATE NOT NULL,
  name TEXT NOT NULL,
  week_theme TEXT NOT NULL,
  post_type TEXT CHECK (post_type IN ('morning', 'evening')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),

  prompts TEXT[] NOT NULL,  -- Array of 5 questions
  response TEXT,            -- User's reply from Telegram

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, post_type)  -- One morning + one evening per day
);
```

#### **bot_configs** (Telegram/Notion Setup)
```sql
CREATE TABLE bot_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Notion integration
  notion_token TEXT,
  notion_database_id TEXT,

  -- Telegram integration
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,

  -- Schedule
  timezone TEXT DEFAULT 'America/New_York',
  morning_time TEXT DEFAULT '08:00',
  evening_time TEXT DEFAULT '20:00',

  -- Settings
  is_active BOOLEAN DEFAULT false,
  prompt_source TEXT DEFAULT 'agent' CHECK (prompt_source IN ('notion', 'agent')),

  -- Webhook health tracking
  last_webhook_setup_at TIMESTAMPTZ,
  last_webhook_status TEXT CHECK (last_webhook_status IN ('success', 'failed')),
  last_webhook_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## **4. Row Level Security (RLS)**

### **RLS Policy Pattern**

All tables use the **same RLS pattern**: Users can only access their own data.

```sql
-- Enable RLS on all tables
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Policy: Users can only view their own data
CREATE POLICY "Users can manage own prompts" ON user_prompts
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can view own bot config" ON bot_configs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own bot config" ON bot_configs
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);
```

### **How RLS Works:**
1. **Clerk JWT** contains `sub` claim (user ID)
2. **Supabase extracts** `sub` from JWT: `auth.jwt() ->> 'sub'`
3. **Policy checks**: `auth.jwt() ->> 'sub' = user_id`
4. **Query filters** automatically - only returns matching rows

### **Important:**
- ✅ RLS is **active** for anon key (client-side)
- ❌ RLS is **bypassed** by service role key (server-side)
- ✅ Server-side code manually filters by `user_id` from Clerk context

### **Example: RLS in Action**

**Client-Side Query** (RLS enforced):
```typescript
// User is authenticated via Clerk
// JWT has { sub: "user_123" }

const { data } = await supabase
  .from('user_prompts')
  .select('*');

// Supabase automatically adds WHERE user_id = 'user_123'
// User can ONLY see their own prompts
```

**Server-Side Query** (RLS bypassed):
```typescript
// Service role bypasses RLS
// MUST manually filter by user_id

const { data } = await serverSupabase
  .from('user_prompts')
  .select('*')
  .eq('user_id', ctx.userId);  // Manual filtering required!

// Without .eq('user_id', ...) this would return ALL users' data!
```

---

## **5. PostgreSQL Functions**

### **A. Atomic Credit Decrement**

```sql
CREATE OR REPLACE FUNCTION decrement_claude_credits(user_id_param TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with elevated privileges
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  -- Ensure subscription row exists
  INSERT INTO user_subscriptions (user_id, tier, claude_credits)
  VALUES (user_id_param, 'free', 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Atomic decrement (only if credits > 0)
  UPDATE user_subscriptions
  SET claude_credits = claude_credits - 1
  WHERE user_id = user_id_param AND claude_credits > 0;

  -- Check if update succeeded
  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Insufficient credits: User % has no credits', user_id_param;
  END IF;
END;
$$;
```

#### **Why Atomic?**
- ✅ **Race condition safe**: Two concurrent requests can't both succeed
- ✅ **Check + update in one query**: No time window for errors
- ✅ **Transaction-safe**: Rolls back on exception
- ✅ **Prevents negative credits**: `WHERE claude_credits > 0` guard

#### **Usage in tRPC:**
```typescript
const { error } = await serverSupabase
  .rpc('decrement_claude_credits', { user_id_param: ctx.userId });

if (error) {
  throw new Error('Credit deduction failed: ' + error.message);
}
```

---

### **B. Auto-Update Timestamp Trigger**

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_user_prompts_updated_at
  BEFORE UPDATE ON user_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_configs_updated_at
  BEFORE UPDATE ON bot_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... (all tables with updated_at)
```

#### **Benefits:**
- ✅ **Automatic**: Never forget to update timestamp
- ✅ **Consistent**: All tables use same logic
- ✅ **Database-enforced**: Can't be bypassed by application code

---

## **6. Type Safety**

### **Auto-Generated TypeScript Types** (`lib/database.types.ts`)

```typescript
export type Database = {
  public: {
    Tables: {
      bot_configs: {
        Row: {           // SELECT queries return this
          id: string;
          user_id: string;
          telegram_bot_token: string | null;
          is_active: boolean;
          created_at: string;
          // ... all columns
        };
        Insert: {        // INSERT queries use this
          id?: string;   // Optional (has default)
          user_id: string;
          telegram_bot_token?: string | null;
          is_active?: boolean;
          // ... all columns (mostly optional)
        };
        Update: {        // UPDATE queries use this
          id?: string;
          user_id?: string;
          telegram_bot_token?: string | null;
          // ... all columns optional
        };
      };
      user_prompts: {
        Row: { /* ... */ };
        Insert: { /* ... */ };
        Update: { /* ... */ };
      };
      // ... all other tables
    };
    Functions: {
      decrement_claude_credits: {
        Args: { user_id_param: string };
        Returns: void;
      };
    };
  };
};
```

### **Benefits:**
- ✅ **Full type safety** for all queries
- ✅ **Auto-complete** in IDE
- ✅ **Compile-time errors** for schema mismatches
- ✅ **Three types per table** (Row/Insert/Update)
- ✅ **Function signatures** included

### **Type Generation Commands:**

```bash
# Auto-generate from live database
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/database.types.ts

# Or use Supabase CLI (if linked)
supabase gen types typescript --linked > lib/database.types.ts

# Or via Supabase Dashboard
# Settings → API → Generate Types
```

---

## **7. Usage Patterns**

### **A. Server-Side Queries** (tRPC Procedure)

```typescript
import { serverSupabase } from '@/lib/supabase-server';

// SELECT
const { data, error } = await serverSupabase
  .from('user_prompts')
  .select('*')
  .eq('user_id', ctx.userId)  // Manual filtering (RLS bypassed)
  .single();

// INSERT
const { data, error } = await serverSupabase
  .from('bot_configs')
  // @ts-expect-error Supabase v2.80.0 type inference issue
  .insert({
    user_id: ctx.userId,
    telegram_bot_token: token,
    is_active: true,
  })
  .select()
  .single();

// UPDATE
const { error } = await serverSupabase
  .from('user_subscriptions')
  // @ts-expect-error Supabase v2.80.0 type inference issue
  .update({ claude_credits: 10 })
  .eq('user_id', ctx.userId);

// DELETE
const { error } = await serverSupabase
  .from('user_prompts')
  .delete()
  .eq('user_id', ctx.userId)
  .eq('id', promptId);

// RPC Function
const { error } = await serverSupabase
  .rpc('decrement_claude_credits', { user_id_param: ctx.userId });
```

#### **Note on `@ts-expect-error`:**
- Supabase v2.80.0 has a type inference bug on `.insert()` and `.update()`
- ThreadBot uses these suppressions with comments
- Data is still type-safe (just the method signature isn't inferred correctly)

---

### **B. Client-Side Queries** (React Component)

```typescript
'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export function MyComponent() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function fetchConfig() {
      // RLS automatically filters by authenticated user
      const { data } = await supabase
        .from('bot_configs')
        .select('*')
        .single();

      setConfig(data);
    }
    fetchConfig();
  }, []);

  return <div>{config?.telegram_bot_token}</div>;
}
```

#### **RLS in Action:**
- ✅ Client query uses `ANON_KEY`
- ✅ RLS policy checks JWT `sub` claim
- ✅ Only returns rows where `user_id` matches authenticated user
- ✅ No manual filtering needed

---

### **C. Advanced Queries**

#### **Array Queries:**
```typescript
// Query array columns
const { data } = await serverSupabase
  .from('user_prompts')
  .select('prompts')  // TEXT[] column
  .eq('user_id', userId);

// Insert array data
await serverSupabase
  .from('user_weekly_themes')
  .insert({
    user_id: userId,
    keywords: ['productivity', 'focus', 'goals'],  // TEXT[]
  });
```

#### **JSONB Queries:**
```typescript
// Query JSONB columns
const { data } = await serverSupabase
  .from('user_generation_context')
  .select('tone_attributes')  // JSONB column
  .eq('user_id', userId);

// Insert JSONB data
await serverSupabase
  .from('user_generation_context')
  .insert({
    user_id: userId,
    tone_attributes: { professional: true, casual: false },  // JSONB
  });
```

#### **Date Range Queries:**
```typescript
const { data } = await serverSupabase
  .from('user_prompts')
  .select('*')
  .eq('user_id', userId)
  .gte('date', '2025-11-01')
  .lte('date', '2025-11-30')
  .order('date', { ascending: true });
```

---

## **8. Environment Setup**

### **Environment Variables**

```bash
# Required for both client and server
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Required for server only (NEVER expose to client!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Security Rules:**
- ✅ `NEXT_PUBLIC_*` vars are safe to expose (anon key is public)
- ❌ **NEVER** expose `SERVICE_ROLE_KEY` to client
- ✅ Service role key should ONLY be in server-side code
- ✅ Use Vercel environment variables for secrets

### **Where to Find Keys:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## **9. Setup Checklist**

### **Initial Setup**
- [ ] Create Supabase project at [supabase.com](https://supabase.com)
- [ ] Copy project URL and keys to `.env.local`
- [ ] Install dependencies: `pnpm add @supabase/supabase-js`
- [ ] Create `lib/supabase-server.ts` (server client)
- [ ] Create `lib/supabase.ts` (client client)

### **Database Setup**
- [ ] Run `supabase/complete_schema.sql` in SQL Editor
- [ ] Verify all tables created (9 tables total in ThreadBot)
- [ ] Verify RLS enabled on all tables
- [ ] Verify functions created (`decrement_claude_credits`, `update_updated_at_column`)
- [ ] Verify triggers applied to all tables
- [ ] Verify indexes created

### **Type Generation**
- [ ] Generate types: `supabase gen types typescript`
- [ ] Copy types to `lib/database.types.ts`
- [ ] Update imports to use generated types
- [ ] Verify TypeScript compilation passes

### **Testing**
- [ ] Test connection with `pnpm dev`
- [ ] Test server-side queries (tRPC)
- [ ] Test client-side queries (React components)
- [ ] Test RLS policies (try accessing other user's data)
- [ ] Test PostgreSQL functions
- [ ] Test triggers (verify `updated_at` auto-updates)

---

## **10. Common Patterns**

### **Upsert (Insert or Update)**
```typescript
const { data, error } = await serverSupabase
  .from('user_generation_context')
  .upsert({
    user_id: ctx.userId,
    brand_voice: 'Professional and engaging',
    core_themes: ['productivity', 'growth'],
  })
  .select()
  .single();
```

### **Conditional Insert**
```typescript
const { data, error } = await serverSupabase
  .from('user_subscriptions')
  .insert({
    user_id: ctx.userId,
    tier: 'free',
    claude_credits: 0,
  })
  .select()
  .single();

// Handle unique constraint violation
if (error?.code === '23505') {
  // User already has subscription
}
```

### **Batch Insert**
```typescript
const prompts = [ /* array of 60 prompts */ ];

const { error } = await serverSupabase
  .from('user_prompts')
  .insert(prompts);  // Inserts all at once
```

### **Transaction Pattern**
```typescript
// Supabase doesn't support manual transactions
// Use RPC functions for atomic operations

// Example: Deduct credit + insert job
CREATE OR REPLACE FUNCTION create_job_and_deduct(
  user_id_param TEXT,
  model_used TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  job_id UUID;
BEGIN
  -- Deduct credit first
  PERFORM decrement_claude_credits(user_id_param);

  -- Insert job
  INSERT INTO agent_generation_jobs (user_id, model_used, status)
  VALUES (user_id_param, model_used, 'pending')
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$;
```

---

## **11. Troubleshooting**

### **Build-Time Errors**
```
Error: Missing environment variable NEXT_PUBLIC_SUPABASE_URL
```
**Solution**: Use lazy initialization (Proxy pattern) as shown in Section 2.

---

### **Type Inference Issues**
```typescript
// Error: Type 'unknown' is not assignable to type 'BotConfig'
const { data } = await serverSupabase.from('bot_configs').insert(...);
```
**Solution**: Use `@ts-expect-error` with comment (Supabase v2.80.0 issue):
```typescript
// @ts-expect-error Supabase v2.80.0 type inference issue
const { data } = await serverSupabase.from('bot_configs').insert(...);
```

---

### **RLS Policy Issues**
```
Error: new row violates row-level security policy
```
**Solution**:
1. Check if using correct client (server vs client)
2. Verify JWT token is valid
3. Check policy conditions match data
4. Use service role key for server-side operations

---

### **Connection Issues**
```
Error: Failed to connect to Supabase
```
**Solution**:
1. Verify project URL is correct
2. Check API keys are valid
3. Ensure project is not paused
4. Check network/firewall settings

---

## **12. Best Practices**

### ✅ **DO:**
1. **Use server client for mutations** (safer, bypasses RLS)
2. **Always filter by `user_id`** in server queries
3. **Use RLS policies** as defense-in-depth
4. **Generate types regularly** (after schema changes)
5. **Use transactions** (via RPC functions) for atomic operations
6. **Add indexes** for frequently queried columns
7. **Use `UNIQUE` constraints** to prevent duplicates
8. **Add `CHECK` constraints** for data validation
9. **Comment your schema** with `COMMENT ON`
10. **Test RLS policies** thoroughly

### ❌ **DON'T:**
1. Don't expose service role key to client
2. Don't trust client-side data without validation
3. Don't skip RLS on sensitive tables
4. Don't forget to filter by `user_id` in server queries
5. Don't use `SELECT *` in production (specify columns)
6. Don't store sensitive data unencrypted
7. Don't skip migration testing
8. Don't hardcode database values

---

## **13. Performance Optimization**

### **Indexes**
```sql
-- Single column
CREATE INDEX idx_user_prompts_date ON user_prompts(date);

-- Composite index
CREATE INDEX idx_user_prompts_user_date ON user_prompts(user_id, date);

-- Partial index
CREATE INDEX idx_active_configs ON bot_configs(user_id)
WHERE is_active = true;
```

### **Query Optimization**
```typescript
// ❌ BAD: Fetches all columns
const { data } = await supabase.from('user_prompts').select('*');

// ✅ GOOD: Fetches only needed columns
const { data } = await supabase
  .from('user_prompts')
  .select('id, date, prompts');

// ✅ BEST: Add limit + filter
const { data } = await supabase
  .from('user_prompts')
  .select('id, date, prompts')
  .eq('user_id', userId)
  .limit(30);
```

---

## **14. Migration Strategy**

### **Schema Changes**
```sql
-- Always use IF EXISTS for safety
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS last_free_generation_at TIMESTAMPTZ;

-- Always use IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_user_subs_credits
  ON user_subscriptions(user_id, claude_credits);

-- Use DO blocks for conditional logic
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_configs' AND column_name = 'notion_token')
  THEN
    ALTER TABLE bot_configs ADD COLUMN notion_token TEXT;
  END IF;
END $$;
```

### **Data Migration**
```sql
-- Use UPDATE with WHERE to avoid full table lock
UPDATE user_subscriptions
SET tier = 'free'
WHERE tier IS DISTINCT FROM 'free';  -- NULL-safe comparison

-- Log results
DO $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE user_subscriptions SET tier = 'free';
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated % rows', rows_updated;
END $$;
```

---

## **15. Additional Resources**

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Supabase Type Generation](https://supabase.com/docs/guides/api/generating-types)

---

**This implementation provides production-ready, type-safe, secure database access with proper separation of privilege and defense-in-depth security.**

---

**Last Updated**: 2025-11-13
**Status**: Production-Ready
**Version**: 1.0.0
