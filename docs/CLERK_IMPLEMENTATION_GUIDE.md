# ThreadBot: Clerk Authentication Implementation Guide

**Author**: AI Analysis
**Date**: 2025-11-13
**Purpose**: Complete technical overview of Clerk authentication setup for replication

---

## **Table of Contents**

1. [Architecture Overview](#1-architecture-overview)
2. [Setup & Configuration](#2-setup--configuration)
3. [Middleware Setup](#3-middleware-setup)
4. [tRPC Integration](#4-trpc-integration)
5. [Client-Side Usage](#5-client-side-usage)
6. [Authentication Flow](#6-authentication-flow)
7. [Security Patterns](#7-security-patterns)
8. [Environment Setup](#8-environment-setup)
9. [Setup Checklist](#9-setup-checklist)

---

## **1. Architecture Overview**

Clerk provides **JWT-based authentication** integrated with Next.js middleware and tRPC context.

```
┌─────────────┐
│    User     │
│  Visits App │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│   Clerk Middleware      │
│  - Check JWT in cookies │
│  - Route: /dashboard    │
└──────┬──────────────────┘
       │
       ├─ Authenticated ──────────────────────┐
       │                                      │
       ▼                                      ▼
┌─────────────────────┐           ┌─────────────────────┐
│   Allow Access      │           │  Protected Page     │
│  JWT → tRPC Context │           │   Loads             │
└──────┬──────────────┘           └─────────────────────┘
       │
       │ tRPC Call: getSubscription()
       │
       ▼
┌───────────────────────────────┐
│     tRPC createContext()      │
│  - auth() extracts userId     │
│  - Returns { userId: "..." }  │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│   protectedProcedure checks   │
│  - if (!userId) → UNAUTHORIZED│
│  - else → proceed             │
└────────┬──────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│    Database Query             │
│  - .eq('user_id', ctx.userId) │
│  - Returns only user's data   │
└───────────────────────────────┘
```

### **Key Components:**
1. **Clerk Provider** - Wraps entire app, provides auth context
2. **Middleware** - Validates JWT, protects routes
3. **tRPC Context** - Extracts `userId` from JWT
4. **Protected Procedures** - Require authentication
5. **Database Queries** - Filter by `ctx.userId`

---

## **2. Setup & Configuration**

### **A. Dependencies**

```json
{
  "dependencies": {
    "@clerk/nextjs": "^6.34.5",
    "@tanstack/react-query": "^5.90.7",
    "@trpc/client": "^11.7.1",
    "@trpc/server": "^11.7.1",
    "@trpc/react-query": "^11.7.1",
    "@trpc/next": "^11.7.1",
    "superjson": "^2.2.5"
  }
}
```

### **Installation:**
```bash
pnpm add @clerk/nextjs @tanstack/react-query @trpc/client @trpc/server @trpc/react-query @trpc/next superjson
# or
npm install @clerk/nextjs @tanstack/react-query @trpc/client @trpc/server @trpc/react-query @trpc/next superjson
```

---

### **B. Environment Variables**

```bash
# Clerk Authentication (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Optional (for production)
CLERK_WEBHOOK_SECRET=whsec_...
```

**Where to Find:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **API Keys**
4. Copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`

---

### **C. Root Layout** (`app/layout.tsx`)

Wrap the entire app with providers:

```typescript
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const bebasNeue = localFont({
  src: "../public/fonts/BebasNeue-Regular.ttf",
  variable: "--font-bebas",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Threadbot - AI Prompt Automation",
  description: "Automated AI-powered prompts delivered via Telegram",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bebasNeue.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
```

---

### **D. Providers Component** (`app/providers.tsx`)

Combines **Clerk + tRPC + React Query**:

```typescript
'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import superjson from 'superjson';

export function Providers({ children }: { children: React.ReactNode }) {
  // React Query client (caching layer)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,  // Cache for 5 seconds
      },
    },
  }));

  // tRPC client (type-safe API)
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          // Use relative URL in browser, absolute URL in SSR
          url: typeof window !== 'undefined'
            ? '/api/trpc'  // Browser: relative URL
            : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/trpc`,  // SSR: absolute
          transformer: superjson,  // Handles Date, Map, Set, etc.
        }),
      ],
    })
  );

  return (
    <ClerkProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </ClerkProvider>
  );
}
```

#### **Provider Order (Critical!):**
1. **ClerkProvider** (outermost) - Provides auth context
2. **trpc.Provider** - Provides tRPC client
3. **QueryClientProvider** - Provides React Query cache

**Why this order?**
- Clerk must wrap everything (provides JWT)
- tRPC needs Clerk context (accesses JWT)
- React Query caches tRPC responses

---

## **3. Middleware Setup** (`middleware.ts`)

Protect routes with Clerk middleware:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  '/',                      // Landing page
  '/sign-in(.*)',          // Sign in + all sub-routes
  '/sign-up(.*)',          // Sign up + all sub-routes
  '/api/webhook/(.*)',     // Telegram webhooks
  '/api/cron(.*)',         // Vercel cron jobs
]);

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    await auth.protect();  // Redirects to sign-in if not authenticated
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

### **Key Points:**
- ✅ `auth.protect()` automatically redirects unauthenticated users to `/sign-in`
- ✅ Public routes bypass protection
- ✅ API routes can have their own auth logic
- ✅ Matcher excludes static assets for performance

### **Route Protection Examples:**

```typescript
// Public routes
'/'                    // ✅ Anyone can access
'/sign-in'            // ✅ Anyone can access
'/api/webhook/xyz'    // ✅ Anyone can access (for external services)

// Protected routes (auth.protect() runs)
'/dashboard'          // ❌ Redirects to /sign-in if not authenticated
'/agent/create'       // ❌ Redirects to /sign-in if not authenticated
'/settings'           // ❌ Redirects to /sign-in if not authenticated
```

---

## **4. tRPC Integration**

### **A. tRPC Context** (`server/trpc.ts`)

Extract user ID from Clerk JWT:

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@clerk/nextjs/server';
import superjson from 'superjson';

// Create context from Clerk auth
export async function createContext() {
  const { userId } = await auth();  // Extract from JWT

  return {
    userId,  // null if not authenticated
  };
}

type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  transformer: superjson,  // Serialize complex types (Date, Map, Set)
});

// Export reusable helpers
export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - requires authentication
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,  // Now guaranteed non-null
    },
  });
});
```

### **Context Flow:**
1. `auth()` extracts JWT from cookies
2. Returns `{ userId }` (or `null` if not authenticated)
3. Context available in ALL tRPC procedures
4. `protectedProcedure` validates `userId` exists

### **Why SuperJSON?**
```typescript
// Without SuperJSON
{ date: "2025-11-13T12:00:00.000Z" }  // String

// With SuperJSON
{ date: Date('2025-11-13T12:00:00.000Z') }  // Actual Date object

// Supports: Date, Map, Set, RegExp, BigInt, undefined, NaN, Infinity
```

---

### **B. tRPC Router** (`server/routers/agent.ts`)

Use context in procedures:

```typescript
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { serverSupabase } from '@/lib/supabase-server';

export const agentRouter = router({
  // Protected: requires authentication
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    // ctx.userId is guaranteed to exist (checked by protectedProcedure)
    const { data } = await serverSupabase
      .from('user_subscriptions')
      .select('claude_credits, tier')
      .eq('user_id', ctx.userId)  // Filter by authenticated user
      .single();

    return data || { claude_credits: 0, tier: 'free' };
  }),

  // Protected mutation with input validation
  updateConfig: protectedProcedure
    .input(z.object({
      timezone: z.string(),
      morning_time: z.string(),
      evening_time: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await serverSupabase
        .from('bot_configs')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .update({
          timezone: input.timezone,
          morning_time: input.morning_time,
          evening_time: input.evening_time,
        })
        .eq('user_id', ctx.userId);  // Only update own config

      if (error) throw new Error('Update failed');
      return { success: true };
    }),

  // Public procedure (no auth required)
  getPublicStats: publicProcedure.query(async () => {
    // No ctx.userId available (could be null)
    const { count } = await serverSupabase
      .from('user_prompts')
      .select('*', { count: 'exact', head: true });

    return { totalPrompts: count };
  }),
});
```

### **Security Pattern:**
- ✅ `ctx.userId` from Clerk (trusted source)
- ✅ ALL queries filter by `ctx.userId`
- ✅ Users can only access their own data
- ✅ No way to access another user's data

---

### **C. API Route Handler** (`app/api/trpc/[trpc]/route.ts`)

Connect tRPC to Next.js API routes:

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers';
import { createContext } from '@/server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,  // Injects Clerk userId into context
  });

export { handler as GET, handler as POST };
```

**How it works:**
1. Request hits `/api/trpc/procedure.name`
2. `fetchRequestHandler` calls `createContext()` (extracts JWT)
3. Context passed to procedure
4. Procedure accesses `ctx.userId`

---

### **D. Combining Routers** (`server/routers/index.ts`)

```typescript
import { router } from '../trpc';
import { agentRouter } from './agent';
import { botRouter } from './bot';

export const appRouter = router({
  agent: agentRouter,
  bot: botRouter,
  // Add more routers as needed
});

export type AppRouter = typeof appRouter;
```

**Usage in client:**
```typescript
trpc.agent.getSubscription.useQuery();
trpc.bot.updateConfig.useMutation();
```

---

## **5. Client-Side Usage**

### **A. tRPC Client Setup** (`lib/trpc.ts`)

```typescript
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers';

export const trpc = createTRPCReact<AppRouter>();
```

---

### **B. Using tRPC in Components**

```typescript
'use client';

import { trpc } from '@/lib/trpc';

export function Dashboard() {
  // Query (auto-refetches, cached)
  const { data: subscription, isLoading } = trpc.agent.getSubscription.useQuery();

  // Mutation (optimistic updates, invalidation)
  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      // Refetch subscription after update
      trpc.useContext().agent.getSubscription.invalidate();
    },
  });

  const handleUpdate = () => {
    updateConfig.mutate({
      timezone: 'America/New_York',
      morning_time: '08:00',
      evening_time: '20:00',
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>Credits: {subscription?.claude_credits}</p>
      <button onClick={handleUpdate}>Update Schedule</button>
    </div>
  );
}
```

### **Benefits:**
- ✅ **Type-safe**: Auto-complete for all procedures
- ✅ **Auto-caching**: React Query manages cache
- ✅ **Optimistic updates**: UI updates before server response
- ✅ **Error handling**: Built-in error states
- ✅ **Refetching**: Automatic invalidation

---

### **C. Advanced Usage Patterns**

#### **Dependent Queries:**
```typescript
const { data: user } = trpc.auth.getUser.useQuery();
const { data: subscription } = trpc.agent.getSubscription.useQuery(
  undefined,
  { enabled: !!user }  // Only run if user exists
);
```

#### **Optimistic Updates:**
```typescript
const utils = trpc.useContext();

const updateConfig = trpc.bot.updateConfig.useMutation({
  onMutate: async (newConfig) => {
    // Cancel outgoing refetches
    await utils.bot.getConfig.cancel();

    // Snapshot previous value
    const previous = utils.bot.getConfig.getData();

    // Optimistically update
    utils.bot.getConfig.setData(undefined, (old) => ({
      ...old,
      ...newConfig,
    }));

    return { previous };
  },
  onError: (err, newConfig, context) => {
    // Rollback on error
    utils.bot.getConfig.setData(undefined, context?.previous);
  },
  onSettled: () => {
    // Refetch to ensure consistency
    utils.bot.getConfig.invalidate();
  },
});
```

#### **Infinite Queries:**
```typescript
const { data, fetchNextPage, hasNextPage } = trpc.agent.getPrompts.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

---

## **6. Authentication Flow**

### **Complete Flow Diagram:**

```
1. User visits /dashboard
   │
   ▼
2. Middleware checks JWT in cookies
   │
   ├─ No JWT → Redirect to /sign-in
   │
   ├─ Invalid JWT → Redirect to /sign-in
   │
   └─ Valid JWT → Allow access
      │
      ▼
3. Page loads, calls tRPC query
   │
   ▼
4. tRPC createContext() extracts userId from JWT
   │
   ▼
5. protectedProcedure checks if userId exists
   │
   ├─ No userId → UNAUTHORIZED error
   │
   └─ Has userId → Proceed
      │
      ▼
6. Database query filters by ctx.userId
   │
   ▼
7. Response sent to client
   │
   ▼
8. React Query caches response
   │
   ▼
9. Component renders with data
```

---

## **7. Security Patterns**

### **A. Always Filter by `ctx.userId`**

```typescript
// ❌ BAD: Returns ALL users' data (if using service role)
const { data } = await serverSupabase
  .from('user_prompts')
  .select('*');

// ✅ GOOD: Returns only authenticated user's data
const { data } = await serverSupabase
  .from('user_prompts')
  .select('*')
  .eq('user_id', ctx.userId);
```

---

### **B. Never Trust Client Input for User Identity**

```typescript
// ❌ BAD: Client can spoof userId
updateConfig: protectedProcedure
  .input(z.object({
    userId: z.string(),  // ❌ Client can send ANY userId
    timezone: z.string(),
  }))
  .mutation(async ({ input }) => {
    await serverSupabase
      .from('bot_configs')
      .update({ timezone: input.timezone })
      .eq('user_id', input.userId);  // ❌ User can update anyone's config!
  });

// ✅ GOOD: Use ctx.userId from JWT (trusted)
updateConfig: protectedProcedure
  .input(z.object({
    timezone: z.string(),  // ✅ No userId in input
  }))
  .mutation(async ({ ctx, input }) => {
    await serverSupabase
      .from('bot_configs')
      .update({ timezone: input.timezone })
      .eq('user_id', ctx.userId);  // ✅ Uses JWT userId
  });
```

---

### **C. Use Protected Procedures for Sensitive Data**

```typescript
// ❌ BAD: Sensitive data in public procedure
getUserCredits: publicProcedure.query(async ({ ctx }) => {
  // ctx.userId could be null!
  const { data } = await serverSupabase
    .from('user_subscriptions')
    .select('claude_credits')
    .eq('user_id', ctx.userId)  // ❌ Could be null
    .single();

  return data;
});

// ✅ GOOD: Sensitive data in protected procedure
getUserCredits: protectedProcedure.query(async ({ ctx }) => {
  // ctx.userId is guaranteed non-null
  const { data } = await serverSupabase
    .from('user_subscriptions')
    .select('claude_credits')
    .eq('user_id', ctx.userId)  // ✅ Guaranteed non-null
    .single();

  return data;
});
```

---

### **D. Validate All Inputs with Zod**

```typescript
updateConfig: protectedProcedure
  .input(z.object({
    timezone: z.string().min(1).max(100),
    morning_time: z.string().regex(/^\d{2}:\d{2}$/),  // HH:MM format
    evening_time: z.string().regex(/^\d{2}:\d{2}$/),
  }))
  .mutation(async ({ ctx, input }) => {
    // Input is validated and type-safe
    await serverSupabase
      .from('bot_configs')
      .update(input)
      .eq('user_id', ctx.userId);

    return { success: true };
  });
```

---

## **8. Environment Setup**

### **Environment Variables**

```bash
# Clerk (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# App URL (required for tRPC SSR)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## **9. Setup Checklist**

### **Clerk Setup**
- [ ] Create account at [clerk.com](https://clerk.com)
- [ ] Create new application
- [ ] Enable email/password authentication (or social providers)
- [ ] Copy publishable key and secret key
- [ ] Add to `.env.local`
- [ ] Configure redirect URLs in Clerk Dashboard:
  - Sign-in URL: `/sign-in`
  - Sign-up URL: `/sign-up`
  - After sign-in: `/dashboard`
  - After sign-up: `/onboarding`
  - After sign-out: `/`

### **Next.js Integration**
- [ ] Install `@clerk/nextjs`
- [ ] Create `app/providers.tsx` with ClerkProvider
- [ ] Create `middleware.ts` with route protection
- [ ] Wrap layout with Providers
- [ ] Create sign-in page (or use Clerk component)
- [ ] Create sign-up page (or use Clerk component)

### **tRPC Integration**
- [ ] Install tRPC packages
- [ ] Create `server/trpc.ts` with context extraction
- [ ] Create protected procedures
- [ ] Create API route handler (`app/api/trpc/[trpc]/route.ts`)
- [ ] Create client setup (`lib/trpc.ts`)
- [ ] Test authentication flow
- [ ] Verify userId in database queries

### **Testing**
- [ ] Test sign-up flow
- [ ] Test sign-in flow
- [ ] Test protected routes redirect correctly
- [ ] Test tRPC queries with authentication
- [ ] Test `protectedProcedure` blocks unauthenticated requests
- [ ] Test database queries filter by `userId`
- [ ] Test sign-out flow

---

## **10. Best Practices**

### ✅ **DO:**
1. **Always filter by `ctx.userId`** in database queries
2. **Use `protectedProcedure`** for all user-specific endpoints
3. **Extract userId from Clerk context**, never trust client input
4. **Use RLS policies** as defense-in-depth
5. **Validate all inputs** with Zod schemas
6. **Use service role key** only server-side
7. **Check auth in middleware** before page renders
8. **Handle errors gracefully** (show user-friendly messages)
9. **Log authentication events** for security monitoring
10. **Test edge cases** (expired JWT, invalid token, etc.)

### ❌ **DON'T:**
1. Don't trust `userId` from client-side (can be spoofed)
2. Don't skip `ctx.userId` filtering in queries
3. Don't expose service role key to client
4. Don't use `publicProcedure` for sensitive data
5. Don't store JWT manually (Clerk handles it)
6. Don't bypass RLS in client queries
7. Don't hardcode user IDs in code
8. Don't forget to invalidate cache after mutations

---

## **11. Troubleshooting**

### **Issue: Infinite redirect loop**
```
/dashboard → /sign-in → /dashboard → /sign-in → ...
```
**Solution:** Check if middleware is configured correctly. Ensure `/sign-in` is in public routes list.

---

### **Issue: `ctx.userId` is null in protected procedure**
```typescript
Error: UNAUTHORIZED
```
**Solution:**
1. Check if JWT cookie is present (browser dev tools)
2. Verify Clerk keys are correct in `.env.local`
3. Check if user is signed in
4. Verify middleware is running on the route

---

### **Issue: Type errors with `ctx.userId`**
```typescript
Type 'string | null' is not assignable to type 'string'
```
**Solution:** Use `protectedProcedure` instead of `publicProcedure`. It guarantees `userId` is non-null.

---

### **Issue: tRPC not batching requests**
**Solution:** Ensure `httpBatchLink` is used (not `httpLink`) in `app/providers.tsx`.

---

## **12. Production Deployment**

### **Clerk Production Setup**
1. Create production application in Clerk Dashboard
2. Add production domain to allowed domains
3. Update environment variables in Vercel/hosting platform
4. Test sign-in/sign-up flows on production domain
5. Configure production redirect URLs

### **Vercel Environment Variables**
```bash
# Set in Vercel Dashboard → Settings → Environment Variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

### **Security Checklist**
- [ ] Use `pk_live_*` and `sk_live_*` keys in production
- [ ] Enable MFA for Clerk account
- [ ] Configure session timeout
- [ ] Enable rate limiting
- [ ] Monitor authentication logs
- [ ] Set up alerts for suspicious activity

---

## **13. Additional Resources**

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk + Next.js](https://clerk.com/docs/quickstarts/nextjs)
- [tRPC Documentation](https://trpc.io/docs)
- [tRPC + Next.js App Router](https://trpc.io/docs/client/nextjs/setup)

---

**This implementation provides production-ready, type-safe, secure authentication with seamless integration between Clerk, tRPC, and Supabase.**

---

**Last Updated**: 2025-11-13
**Status**: Production-Ready
**Version**: 1.0.0
