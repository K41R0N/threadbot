# Threadbot - Complete Codebase Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Key Components](#key-components)
6. [Database Schema](#database-schema)
7. [API Routes](#api-routes)
8. [Deployment Issues & Fixes](#deployment-issues--fixes)
9. [Environment Setup](#environment-setup)
10. [Development Workflow](#development-workflow)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Threadbot** is a SaaS application that automates the delivery of daily prompts from Notion databases to Telegram at scheduled times, and logs user replies back to Notion. It's designed for journaling, reflection, habit tracking, and personal productivity.

### Key Features

- User authentication via Clerk
- Notion workspace integration for prompt storage
- Telegram bot integration for prompt delivery
- Scheduled prompt sending (morning/evening) via Vercel Cron
- Webhook-based reply handling
- Timezone-aware scheduling
- Real-time dashboard with bot status
- Test prompt functionality

---

## Architecture

### System Flow

```
User Setup Flow:
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│   Landing   │────▶│  Clerk Auth  │────▶│  Onboarding  │────▶│  Dashboard  │
│    Page     │     │  (Sign Up)   │     │  (3 Steps)   │     │             │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                ▼
                            ┌───────────────────────────────────┐
                            │  1. Connect Notion Database       │
                            │  2. Setup Telegram Bot            │
                            │  3. Configure Schedule/Timezone   │
                            └───────────────────────────────────┘

Scheduled Prompt Flow:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Vercel Cron │────▶│  Query DB    │────▶│  Fetch from  │────▶│  Send to     │
│  (every 5m)  │     │  for Active  │     │  Notion      │     │  Telegram    │
└──────────────┘     │  Bots        │     └──────────────┘     └──────────────┘
                     └──────────────┘              │                    │
                                                   │                    ▼
                                                   │          ┌──────────────────┐
                                                   └─────────▶│  Update Bot      │
                                                              │  State (Supabase)│
                                                              └──────────────────┘

Reply Handling Flow:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User Reply  │────▶│  Telegram    │────▶│  Webhook     │────▶│  Append to   │
│  in Telegram │     │  Webhook     │     │  Handler     │     │  Notion Page │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Technology Architecture

```
Frontend (Next.js App Router)
├── React 19 Components
├── Clerk for Authentication
├── tRPC React Query Hooks
└── Tailwind CSS 4 for Styling

Backend (Next.js API Routes)
├── tRPC Server (Type-safe API)
├── Service Layer
│   ├── BotService (Business Logic)
│   ├── NotionService (Notion API)
│   └── TelegramService (Telegram API)
└── Database Layer (Supabase Client)

External Services
├── Supabase (PostgreSQL Database)
├── Clerk (Authentication)
├── Notion API (Prompt Storage)
├── Telegram Bot API (Message Delivery)
└── Vercel (Hosting + Cron Jobs)
```

---

## Tech Stack

### Frontend

- **Next.js 16.0.1** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Utility-first CSS framework
- **Bebas Neue** - Display font for branding
- **tRPC 11.7.1** - End-to-end typesafe APIs
- **React Query (TanStack)** - Data fetching and caching
- **Clerk 6.34.5** - Authentication
- **Sonner** - Toast notifications
- **date-fns & date-fns-tz** - Date manipulation with timezone support

### Backend

- **Next.js API Routes** - Serverless functions
- **tRPC Server** - Type-safe API layer
- **Supabase JS 2.80.0** - PostgreSQL client
- **Notion SDK 5.3.0** - Notion API integration
- **node-telegram-bot-api 0.66.0** - Telegram Bot API
- **Zod 4.1.12** - Schema validation
- **SuperJSON** - Enhanced JSON serialization

### Infrastructure

- **Vercel** - Hosting and serverless functions
- **Vercel Cron** - Scheduled job execution
- **Supabase** - Managed PostgreSQL database
- **Clerk** - Authentication as a service

---

## Project Structure

```
threadbot/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── cron/
│   │   │   └── route.ts          # Scheduled prompt sender (every 5 min)
│   │   ├── trpc/[trpc]/
│   │   │   └── route.ts          # tRPC endpoint handler
│   │   └── webhook/[userId]/
│   │       └── route.ts          # Telegram webhook receiver
│   ├── dashboard/
│   │   └── page.tsx              # Main dashboard (bot status, config, test)
│   ├── onboarding/
│   │   └── page.tsx              # Onboarding router
│   ├── setup/
│   │   ├── notion/page.tsx       # Step 1: Notion integration
│   │   ├── telegram/page.tsx     # Step 2: Telegram bot setup
│   │   └── schedule/page.tsx     # Step 3: Schedule configuration
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Landing page
│   ├── providers.tsx             # Clerk + tRPC + React Query providers
│   └── globals.css               # Global styles (Tailwind imports)
│
├── components/
│   └── ui/                       # Reusable UI components
│       ├── button.tsx            # Button with variants
│       └── input.tsx             # Input field
│
├── lib/                          # Utility libraries
│   ├── supabase.ts               # Supabase client (client & server)
│   ├── trpc.ts                   # tRPC client setup
│   └── utils.ts                  # Utility functions (cn helper)
│
├── server/                       # Backend server code
│   ├── trpc.ts                   # tRPC initialization & context
│   ├── routers.ts                # tRPC route definitions (all procedures)
│   └── services/                 # Business logic layer
│       ├── bot.ts                # Bot operations (send, receive, schedule)
│       ├── notion.ts             # Notion API wrapper
│       └── telegram.ts           # Telegram API wrapper
│
├── supabase/
│   └── schema.sql                # Database schema with RLS policies
│
├── middleware.ts                 # Clerk authentication middleware
├── next.config.ts                # Next.js configuration
├── vercel.json                   # Vercel deployment config (cron jobs)
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
├── .gitignore                    # Git ignore patterns
├── README.md                     # User setup instructions
├── DEPLOYMENT.md                 # Deployment guide
├── PROJECT_SUMMARY.md            # Project summary
└── todo.md                       # Implementation checklist
```

---

## Key Components

### 1. Authentication & Middleware

**File:** `middleware.ts`

```typescript
// Protects routes with Clerk authentication
// Public routes: /, /sign-in, /sign-up, /api/webhook/*, /api/cron/*
// All other routes require authentication
```

**File:** `app/providers.tsx`

- Wraps app with ClerkProvider
- Initializes tRPC client with HTTP batch link
- Sets up React Query client
- Configures SuperJSON transformer for date serialization

### 2. tRPC Setup

**Server:** `server/trpc.ts`

- Creates tRPC context with Clerk userId
- Defines `publicProcedure` and `protectedProcedure`
- Protected procedures automatically throw UNAUTHORIZED if no userId

**Client:** `lib/trpc.ts`

- Creates type-safe tRPC React hooks
- Uses AppRouter type for full type inference

**Routers:** `server/routers.ts`

All procedures are under the `bot` namespace:

- `bot.getConfig` - Fetch user's bot configuration
- `bot.getState` - Fetch bot state (last prompt info)
- `bot.createConfig` - Create new bot configuration (onboarding)
- `bot.updateConfig` - Update bot configuration (toggle active, change times)
- `bot.setupWebhook` - Configure Telegram webhook URL
- `bot.getWebhookInfo` - Get current webhook info from Telegram
- `bot.testPrompt` - Send test prompt (morning/evening)

### 3. Service Layer

**BotService** (`server/services/bot.ts`)

Core business logic for bot operations:

- `sendScheduledPrompt(config, type)` - Main prompt sending logic
  - Converts to user's timezone
  - Queries Notion for today's prompt
  - Extracts page content
  - Sends to Telegram
  - Updates bot state

- `handleReply(config, replyText)` - Reply handling logic
  - Gets last prompt page ID from state
  - Appends reply to Notion page

- `shouldSendPrompt(scheduledTime, timezone, type)` - Time checking
  - Converts current time to user's timezone
  - Returns true if within 5 minutes of scheduled time

**NotionService** (`server/services/notion.ts`)

Wrapper for Notion API:

- `queryDatabase(databaseId, date, type)` - Query for prompts
  - Filters by Date property
  - Searches for "morning" or "evening" in title

- `getPageContent(pageId)` - Extract text content
  - Handles paragraph, bulleted_list_item, numbered_list_item blocks

- `appendReply(pageId, reply)` - Append reply to page
  - Adds new paragraph block with reply text

**TelegramService** (`server/services/telegram.ts`)

Wrapper for Telegram Bot API:

- `sendMessage(chatId, text)` - Send message with Markdown formatting
- `setWebhook(webhookUrl)` - Configure webhook URL
- `getWebhookInfo()` - Get webhook status
- `deleteWebhook()` - Remove webhook

### 4. API Routes

**Cron Route** (`app/api/cron/route.ts`)

- **Path:** `/api/cron?type=morning|evening`
- **Method:** GET
- **Called by:** Vercel Cron (every 5 minutes)
- **Logic:**
  1. Validate type parameter
  2. Fetch all active bot configurations
  3. For each bot, check if it's time to send (via `BotService.shouldSendPrompt`)
  4. Send prompts for matching bots
  5. Return results summary

**Webhook Route** (`app/api/webhook/[userId]/route.ts`)

- **Path:** `/api/webhook/{userId}`
- **Method:** POST
- **Called by:** Telegram servers when user replies
- **Logic:**
  1. Parse Telegram update JSON
  2. Extract message text
  3. Fetch bot config for userId
  4. Verify chat ID matches
  5. Call `BotService.handleReply` to log to Notion
  6. Always return 200 OK to Telegram

**tRPC Route** (`app/api/trpc/[trpc]/route.ts`)

- **Path:** `/api/trpc/{procedure}`
- **Method:** GET/POST
- **Handler:** Standard Next.js tRPC adapter
- Handles all tRPC procedure calls

### 5. Database Layer

**Supabase Client** (`lib/supabase.ts`)

Two client configurations:

1. **Client-side:** Uses anon key (limited by RLS)
2. **Server-side:** Uses service role key (bypasses RLS)

All API routes use server-side client for full database access.

**Type Definitions:**

- `BotConfig` - User configuration
- `BotState` - Bot state tracking

### 6. Frontend Pages

**Landing Page** (`app/page.tsx`)

- Hero section with CTA
- Redirects authenticated users to dashboard
- Sign-up/sign-in buttons

**Onboarding** (`app/onboarding/page.tsx`)

- Routes to setup steps
- Checks if config exists, redirects to dashboard if so

**Setup Pages** (`app/setup/*`)

1. **Notion Setup** - Connect workspace, select database
2. **Telegram Setup** - Create bot, get token and chat ID
3. **Schedule Setup** - Set times and timezone, activate bot

**Dashboard** (`app/dashboard/page.tsx`)

- Bot status indicator (active/inactive)
- Toggle activation button
- Last prompt info (type, timestamp)
- Configuration display (times, timezone, IDs)
- Test prompt buttons

---

## Database Schema

**File:** `supabase/schema.sql`

### Tables

#### `bot_configs`

Stores user bot configurations (one per user):

| Column              | Type        | Description                       |
|---------------------|-------------|-----------------------------------|
| id                  | UUID        | Primary key                       |
| user_id             | TEXT        | Clerk user ID (unique)            |
| notion_token        | TEXT        | Notion integration token          |
| notion_database_id  | TEXT        | Notion database ID                |
| telegram_bot_token  | TEXT        | Telegram bot token                |
| telegram_chat_id    | TEXT        | Telegram chat ID                  |
| timezone            | TEXT        | User timezone (e.g., 'America/New_York') |
| morning_time        | TEXT        | Morning time (HH:MM format)       |
| evening_time        | TEXT        | Evening time (HH:MM format)       |
| is_active           | BOOLEAN     | Bot activation status             |
| created_at          | TIMESTAMPTZ | Creation timestamp                |
| updated_at          | TIMESTAMPTZ | Last update timestamp             |

#### `bot_state`

Tracks bot state for reply handling (one per user):

| Column               | Type        | Description                       |
|----------------------|-------------|-----------------------------------|
| id                   | UUID        | Primary key                       |
| user_id              | TEXT        | Clerk user ID (unique)            |
| last_prompt_type     | TEXT        | 'morning' or 'evening'            |
| last_prompt_sent_at  | TIMESTAMPTZ | When last prompt was sent         |
| last_prompt_page_id  | TEXT        | Notion page ID of last prompt     |
| created_at           | TIMESTAMPTZ | Creation timestamp                |
| updated_at           | TIMESTAMPTZ | Last update timestamp             |

### Indexes

- `idx_bot_configs_user_id` - Fast user lookups
- `idx_bot_configs_is_active` - Fast active bot queries
- `idx_bot_state_user_id` - Fast state lookups

### Triggers

- Auto-updates `updated_at` timestamp on row updates

### Row Level Security (RLS)

**⚠️ IMPORTANT ISSUE:** The current RLS policies use `auth.jwt() ->> 'sub'` which expects Supabase Auth JWT format. However, this app uses Clerk for authentication, not Supabase Auth.

**Current Policies:**

```sql
CREATE POLICY "Users can view own bot config" ON bot_configs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);
```

**Status:** These policies will NOT work with Clerk JWTs. However, the app works because:

1. All database queries use `getServerSupabase()` with service role key
2. Service role key bypasses RLS entirely
3. Client-side queries are not used

**Recommendation:** Since service role is used exclusively, RLS can remain as-is or be updated for Clerk compatibility if client-side queries are added in the future.

---

## API Routes

### 1. Cron Endpoint

**Endpoint:** `GET /api/cron?type={morning|evening}`

**Authentication:** Public (called by Vercel Cron)

**Parameters:**
- `type` (required): "morning" or "evening"

**Response:**

```json
{
  "message": "Processed morning prompts",
  "processed": 3,
  "results": [
    {
      "userId": "user_123",
      "success": true,
      "message": "Prompt sent successfully",
      "pageId": "notion_page_id"
    }
  ]
}
```

**Error Responses:**
- 400: Invalid type parameter
- 500: Server error

**Vercel Cron Configuration (vercel.json):**

```json
{
  "crons": [
    {
      "path": "/api/cron?type=morning",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron?type=evening",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Runs every 5 minutes. The `shouldSendPrompt` logic ensures prompts are only sent when within 5 minutes of scheduled time.

### 2. Telegram Webhook

**Endpoint:** `POST /api/webhook/{userId}`

**Authentication:** Public (called by Telegram servers)

**Request Body:** Telegram Update object

```json
{
  "message": {
    "message_id": 123,
    "text": "This is my reply",
    "chat": {
      "id": 123456789
    }
  }
}
```

**Response:**

```json
{
  "ok": true
}
```

Always returns 200 OK to prevent Telegram retries.

**Security:**
- Verifies chat ID matches bot config
- Silently ignores non-matching messages
- Logs errors but returns OK

### 3. tRPC Endpoints

**Base URL:** `/api/trpc`

**All procedures require authentication except as noted.**

#### `bot.getConfig`

Get user's bot configuration.

**Query:** No input

**Returns:** `BotConfig | null`

#### `bot.getState`

Get bot state (last prompt info).

**Query:** No input

**Returns:** `BotState | null`

#### `bot.createConfig`

Create new bot configuration (called during onboarding).

**Mutation Input:**

```typescript
{
  notionToken: string
  notionDatabaseId: string
  telegramBotToken: string
  telegramChatId: string
  timezone: string
  morningTime: string  // "HH:MM"
  eveningTime: string  // "HH:MM"
  isActive: boolean
}
```

**Returns:** `BotConfig`

**Side Effects:**
- Creates `bot_configs` row
- Creates `bot_state` row

#### `bot.updateConfig`

Update bot configuration.

**Mutation Input:** (all fields optional)

```typescript
{
  notionToken?: string
  notionDatabaseId?: string
  telegramBotToken?: string
  telegramChatId?: string
  timezone?: string
  morningTime?: string
  eveningTime?: string
  isActive?: boolean
}
```

**Returns:** `BotConfig`

#### `bot.setupWebhook`

Configure Telegram webhook URL.

**Mutation Input:**

```typescript
{
  botToken: string
  webhookUrl: string
}
```

**Returns:**

```typescript
{
  success: boolean
  message: string
}
```

#### `bot.getWebhookInfo`

Get current webhook configuration from Telegram.

**Mutation Input:**

```typescript
{
  botToken: string
}
```

**Returns:**

```typescript
{
  success: boolean
  info?: WebhookInfo
  message?: string
}
```

#### `bot.testPrompt`

Send test prompt immediately.

**Mutation Input:**

```typescript
{
  type: "morning" | "evening"
}
```

**Returns:**

```typescript
{
  success: boolean
  message?: string
  pageId?: string
}
```

---

## Deployment Issues & Fixes

### Critical Issues

#### 1. ❌ Supabase RLS Policies Incompatible with Clerk

**Issue:**

The database schema uses Supabase Auth-specific RLS policies:

```sql
CREATE POLICY "Users can view own bot config" ON bot_configs
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);
```

This expects Supabase Auth JWTs, but the app uses Clerk authentication.

**Impact:**
- Client-side database queries would fail with permission errors
- Currently not an issue because all queries use service role key (bypasses RLS)

**Fix Options:**

**Option 1: Keep as-is (Recommended)**

Since all queries use `getServerSupabase()` with service role key, RLS is effectively unused. No changes needed.

**Option 2: Disable RLS**

```sql
ALTER TABLE bot_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE bot_state DISABLE ROW LEVEL SECURITY;
```

**Option 3: Update for Clerk (if client-side queries are added later)**

Would require custom Supabase Auth integration with Clerk JWTs.

**Status:** ✅ No immediate fix needed - works as designed with service role key

---

#### 2. ❌ Missing Environment Variables Template

**Issue:**

No `.env.example` file for easy setup.

**Impact:**
- Harder for new developers to know which variables are needed
- Risk of missing required environment variables

**Fix:**

Create `.env.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Status:** ⚠️ Should be added

---

#### 3. ⚠️ Middleware Webhook Route Pattern Mismatch

**Issue:**

In `middleware.ts`, the public route pattern is:

```typescript
'/api/webhook/telegram(.*)'
```

But the actual route is:

```
/api/webhook/[userId]/route.ts
```

**Impact:**
- The middleware might not correctly exclude webhook routes from authentication
- Telegram webhooks could be blocked

**Current Pattern:**

```typescript
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook/telegram(.*)',
  '/api/cron(.*)',
]);
```

**Fix:**

Update middleware to match actual webhook route:

```typescript
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook/(.*)',  // Match all webhook routes
  '/api/cron(.*)',
]);
```

**Status:** ⚠️ Should be fixed to prevent potential auth issues

---

#### 4. ⚠️ Missing Vercel Function Configuration

**Issue:**

No `maxDuration` configuration for potentially long-running API routes.

**Impact:**
- Vercel Hobby plan: 10s timeout
- Vercel Pro plan: 15s timeout (default)
- Notion/Telegram API calls could timeout on slow responses

**Fix:**

Add to API route files:

```typescript
// app/api/cron/route.ts
export const maxDuration = 30; // seconds (requires Pro plan)

// app/api/webhook/[userId]/route.ts
export const maxDuration = 10;
```

**Status:** ⚠️ Recommended for production

---

#### 5. ⚠️ Missing Node.js Version Specification

**Issue:**

No `.nvmrc` or `engines` field in `package.json`.

**Impact:**
- Build might use unexpected Node.js version
- Potential compatibility issues

**Fix:**

Add to `package.json`:

```json
{
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

**Status:** ⚠️ Recommended

---

#### 6. ⚠️ No Build Verification

**Issue:**

No evidence that `pnpm build` has been run successfully.

**Impact:**
- TypeScript errors might exist
- Build could fail on Vercel

**Fix:**

Run build locally:

```bash
pnpm install
pnpm build
```

Check for errors in:
- TypeScript compilation
- Next.js build
- Missing dependencies

**Status:** ⚠️ Must verify before deployment

---

### Minor Issues

#### 7. ℹ️ Port Inconsistency in Documentation

**Issue:**

- README says: `http://localhost:3001`
- Default Next.js port: `3000`
- `app/providers.tsx` defaults to `3000`

**Fix:**

Update README.md to use port `3000` consistently.

**Status:** ℹ️ Documentation fix

---

#### 8. ℹ️ No Tailwind Config File

**Issue:**

No `tailwind.config.ts` file.

**Explanation:**

This is correct for Tailwind CSS v4, which uses CSS-based configuration via `@import "tailwindcss"`.

**Status:** ✅ No fix needed - using Tailwind v4 correctly

---

#### 9. ℹ️ Missing .env.local in Repository

**Issue:**

No `.env.local` file (correctly gitignored).

**Status:** ✅ Correct - should never be committed

**Action Required:**

Each developer must create their own `.env.local` from `.env.example`.

---

### Security Considerations

#### 10. ✅ Service Role Key Usage

**Current Implementation:**

All database operations use service role key:

```typescript
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl, serviceRoleKey);
}
```

**Security Implications:**
- Service role bypasses ALL security policies
- Must be kept server-side only
- Never expose to client

**Status:** ✅ Correctly implemented - only used in API routes

---

#### 11. ✅ Credentials Storage

**Current Implementation:**

Sensitive credentials (Notion token, Telegram token) are stored in database.

**Security:**
- Should be encrypted at rest (Supabase handles this)
- Service role key ensures only server can access
- Never sent to client

**Recommendation:**

For enhanced security, consider encrypting tokens before storage using a separate encryption key.

**Status:** ✅ Acceptable for MVP, encryption recommended for production

---

## Environment Setup

### Required Environment Variables

```env
# Supabase - Database
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Clerk - Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Getting API Keys

**Supabase:**

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings → API
3. Copy URL and keys
4. Run schema in SQL Editor

**Clerk:**

1. Create app at [clerk.com](https://clerk.com)
2. Go to API Keys
3. Copy publishable and secret keys

### Local Development Setup

```bash
# Install dependencies
pnpm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## Development Workflow

### Adding New Features

1. **Database Changes:**
   - Update `supabase/schema.sql`
   - Run SQL in Supabase dashboard
   - Update TypeScript types in `lib/supabase.ts`

2. **API Changes:**
   - Add procedures to `server/routers.ts`
   - Add business logic to `server/services/*.ts`
   - Update AppRouter type (automatic)

3. **Frontend Changes:**
   - Use tRPC hooks: `trpc.bot.procedureName.useQuery()`
   - Components are in `components/ui/`
   - Pages are in `app/`

### Code Style

- **TypeScript:** Strict mode enabled
- **Imports:** Use `@/` alias for absolute imports
- **Components:** Functional components with hooks
- **Styling:** Tailwind utility classes
- **Formatting:** Use Prettier (configure as needed)

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push -u origin feature/my-feature

# Create pull request
```

---

## Testing

### Manual Testing Checklist

- [ ] Sign up / Sign in flow
- [ ] Notion connection (valid token, database selection)
- [ ] Telegram bot creation (token validation, chat ID)
- [ ] Schedule configuration (timezone, times)
- [ ] Bot activation
- [ ] Test prompt sending (morning/evening)
- [ ] Telegram message receipt
- [ ] Reply handling (check Notion page updated)
- [ ] Bot deactivation
- [ ] Dashboard displays correct status

### Testing Cron Jobs Locally

Vercel Cron doesn't run locally. Test with:

```bash
# Option 1: Direct HTTP call
curl http://localhost:3000/api/cron?type=morning

# Option 2: Use test prompt button in dashboard
```

### Testing Telegram Webhook Locally

Use ngrok or similar:

```bash
# Start ngrok
ngrok http 3000

# Set webhook URL in Telegram
# Use ngrok URL: https://xxxxx.ngrok.io/api/webhook/{userId}
```

---

## Troubleshooting

### Build Errors

**Error:** `Module not found: Can't resolve '@/...'`

**Solution:** Check `tsconfig.json` has correct path alias:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

**Error:** `Type error: Cannot find module 'next/font/google'`

**Solution:** Ensure Next.js 13+ is installed:

```bash
pnpm install next@latest
```

---

### Runtime Errors

**Error:** `Missing Supabase environment variables`

**Solution:** Verify `.env.local` has all required variables:

```bash
# Check variables are loaded
pnpm dev
# Should not throw error about missing env vars
```

---

**Error:** `UNAUTHORIZED` from tRPC

**Solution:** User is not authenticated. Check:

1. Clerk is properly configured
2. User is signed in
3. Middleware is not blocking authenticated routes

---

**Error:** `Failed to fetch bot config: PGRST301`

**Solution:** Database query failed due to missing table. Run schema:

```sql
-- In Supabase SQL Editor
-- Run entire supabase/schema.sql
```

---

### Deployment Errors

**Error:** `Build failed: TypeScript errors`

**Solution:**

```bash
# Run build locally to see errors
pnpm build

# Fix TypeScript errors
# Re-deploy
```

---

**Error:** `Function timeout: 10s exceeded`

**Solution:** Add `maxDuration` export to API routes:

```typescript
export const maxDuration = 30; // Requires Vercel Pro
```

---

**Error:** `Cron jobs not running`

**Solution:**

1. Verify `vercel.json` is in repository root
2. Check Vercel dashboard → Project → Cron Jobs
3. Verify deployment is on Pro plan (cron requires Pro)
4. Use external cron service (cron-job.org) as alternative

---

### Notion Integration Issues

**Error:** `Failed to query Notion database`

**Solution:**

1. Verify Notion token has access to database
2. Check database has "Date" and "Name" properties
3. Verify database ID is correct (32-char hex string)

---

### Telegram Integration Issues

**Error:** `Failed to send Telegram message`

**Solution:**

1. Verify bot token is correct
2. User must have started chat with bot (@BotUsername)
3. Check chat ID is correct (use `getUpdates` API)

---

**Error:** `Webhook not receiving messages`

**Solution:**

1. Verify webhook URL is accessible (test with curl)
2. Check webhook is set: `bot.getWebhookInfo()`
3. Ensure userId in URL matches database user_id
4. Check middleware allows `/api/webhook/` routes

---

## Summary of Required Fixes

### Before Deployment to Vercel/Supabase

1. **✅ Create .env.example file**
2. **✅ Fix middleware webhook route pattern**
3. **✅ Add maxDuration to API routes**
4. **✅ Add engines field to package.json**
5. **✅ Run `pnpm build` to verify no errors**
6. **✅ Update README port to 3000**

### Optional Improvements

- Add error logging service (Sentry, etc.)
- Add database migrations system
- Add automated tests
- Add CI/CD pipeline
- Encrypt tokens before database storage
- Add rate limiting to API routes
- Add webhook signature verification

---

## Quick Start Commands

```bash
# Development
pnpm install          # Install dependencies
pnpm dev              # Start dev server (port 3000)
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint

# Database
# Run supabase/schema.sql in Supabase SQL Editor

# Deployment
git push origin main  # Auto-deploys to Vercel (if connected)
```

---

## Support & Resources

- **Next.js:** https://nextjs.org/docs
- **tRPC:** https://trpc.io/docs
- **Clerk:** https://clerk.com/docs
- **Supabase:** https://supabase.com/docs
- **Notion API:** https://developers.notion.com
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **Vercel:** https://vercel.com/docs

---

**Last Updated:** 2025-11-09
**Status:** Ready for deployment with fixes applied
