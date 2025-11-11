# Claude Context - Threadbot Development Guide

**Last Updated**: 2025-11-10
**Version**: 1.0.0

This document provides comprehensive context for AI assistants (Claude, GPT, etc.) working on the Threadbot codebase. Use this as your primary reference for understanding the architecture, patterns, and critical decisions made during development.

---

## 🎯 Project Overview

**Threadbot** is an AI-powered SaaS that generates personalized content prompts and delivers them via Telegram on a schedule. Users can:
1. Analyze their brand voice using AI
2. Generate 60 themed prompts (30 days × morning/evening)
3. Receive prompts via Telegram at scheduled times
4. Optionally log replies back to Notion

**Primary Use Cases**: Daily journaling, content creation, reflection practices, habit building

---

## 🏗 Architecture

### Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 16.0.1 | App Router with Turbopack |
| React | React | 19 | Latest stable |
| Styling | Tailwind CSS | 4 | JIT mode |
| Backend | tRPC | 11 | Type-safe API layer |
| Database | Supabase | PostgreSQL | Managed database with RLS |
| Auth | Clerk | Latest | Email/OAuth support |
| AI | Vercel AI SDK | 4.3.19 | Anthropic + DeepSeek providers |
| Schema Validation | Zod | 3.25.76 | **CRITICAL: Must be v3, not v4** |
| Deployment | Vercel | - | Includes Cron Jobs |

### Critical Dependencies

```json
{
  "ai": "^4.3.19",               // Vercel AI SDK
  "@ai-sdk/anthropic": "^1.2.12", // Claude Sonnet 4
  "@ai-sdk/deepseek": "^0.2.16",  // DeepSeek R1
  "zod": "^3.25.76",              // MUST be v3 (AI SDK v4 incompatible with Zod v4)
  "@trpc/server": "11.0.0-rc.658",
  "@trpc/client": "11.0.0-rc.658",
  "@trpc/react-query": "11.0.0-rc.658"
}
```

**⚠️ CRITICAL**: Zod must be v3.x. AI SDK v4 cannot properly convert Zod v4 schemas to JSON Schema format. Upgrading Zod to v4 will break `generateObject()` calls with schema validation errors.

---

## 📂 Project Structure

```
threadbot/
├── app/                              # Next.js App Router
│   ├── agent/                        # AI prompt generation features
│   │   ├── create/page.tsx          # 3-step generation flow
│   │   └── database/                # Prompt viewing/editing
│   │       ├── [monthYear]/page.tsx # Month-based view (legacy)
│   │       └── range/[startDate]/[endDate]/page.tsx  # Date-range view (current)
│   ├── api/
│   │   ├── cron/route.ts            # Vercel Cron handler (secured with CRON_SECRET)
│   │   ├── trpc/[trpc]/route.ts     # tRPC API endpoint
│   │   └── webhook/[userId]/route.ts # Telegram webhook handler
│   ├── dashboard/page.tsx           # Main user dashboard
│   ├── onboarding/page.tsx          # Multi-step onboarding router
│   ├── setup/                       # Bot configuration pages
│   │   ├── notion/page.tsx
│   │   ├── telegram/page.tsx
│   │   └── schedule/page.tsx
│   ├── layout.tsx                   # Root layout with Clerk + tRPC providers
│   ├── page.tsx                     # Landing page
│   └── globals.css                  # Tailwind imports + custom styles
│
├── server/                           # Backend logic
│   ├── routers/                     # tRPC router definitions
│   │   ├── agent.ts                 # AI generation endpoints
│   │   └── bot.ts                   # Bot configuration endpoints
│   ├── services/                    # Business logic services
│   │   ├── ai-agent.ts              # AI SDK integration (Claude + DeepSeek)
│   │   ├── notion.ts                # Notion API client
│   │   └── telegram.ts              # Telegram Bot API client
│   ├── routers.ts                   # Root router combining all sub-routers
│   └── trpc.ts                      # tRPC initialization + middleware
│
├── lib/                              # Shared utilities
│   ├── supabase-server.ts           # Server-side Supabase client (lazy init)
│   ├── supabase.ts                  # Client-side Supabase client (lazy init)
│   ├── supabase-agent.ts            # Type helpers for agent tables
│   ├── database.types.ts            # Generated Supabase types (MUST have .types.ts extension)
│   ├── logger.ts                    # SafeLogger for sanitized logging
│   ├── trpc.ts                      # Client-side tRPC setup
│   └── utils.ts                     # cn() helper for Tailwind classes
│
├── components/ui/                    # Reusable UI components
│   ├── button.tsx
│   ├── input.tsx
│   └── ...
│
├── supabase/                         # Database schemas
│   ├── complete_schema.sql          # Full schema (bot + agent tables)
│   ├── agent_schema.sql             # AI agent tables only
│   ├── schema.sql                   # Legacy bot tables only
│   └── schema_migration.sql         # Migration scripts
│
├── scripts/                          # Build/deploy scripts
│   ├── validate-env.sh              # Environment variable validation
│   └── generate-types.sh            # Supabase type generation
│
├── public/fonts/                     # Local fonts
│   └── BebasNeue-Regular.ttf        # Display font (loaded locally to avoid TLS issues)
│
└── docs/                             # Technical documentation
    ├── PROJECT_SUMMARY.md
    ├── RECOVERY_PLAN.md
    └── archive/                      # Historical troubleshooting docs
```

---

## 🔑 Critical Patterns & Decisions

### 1. Lazy Supabase Initialization (REQUIRED)

**Problem**: Next.js build process evaluates module-level code, causing "Missing environment variable" errors when Supabase clients were initialized at module load.

**Solution**: Use Proxy pattern for lazy initialization.

```typescript
// lib/supabase-server.ts
export const serverSupabase = new Proxy(
  {} as ReturnType<typeof createClient<Database>>,
  {
    get(target, prop) {
      if (!supabaseInstance) {
        // Initialize only when accessed
        supabaseInstance = createClient<Database>(/* ... */);
      }
      return (supabaseInstance as any)[prop];
    },
  }
);
```

**Why This Matters**:
- Allows Next.js builds without runtime credentials
- Prevents environment variable leaks during static generation
- Used in both `lib/supabase-server.ts` and `lib/supabase.ts`

**⚠️ DO NOT** revert to direct initialization or builds will fail.

### 2. Database Types File Naming (CRITICAL)

**File**: `lib/database.types.ts`

**⚠️ CRITICAL**: The file MUST be named `database.types.ts` (not `database.ts`).

**Why**: TypeScript's `isolatedModules: true` requires files with only type exports to either:
1. Have a special extension like `.types.ts`
2. Include at least one value export (e.g., `export {};`)

We use both:
- Filename: `database.types.ts`
- Empty export: `export {};` at the end of the file

**Historical Context**:
- Commit `67d78e3`: File was `database.types.ts` → ✅ Builds succeeded
- Commit `63a3ddd`: Renamed to `database.ts` → ❌ "File is not a module" error
- Commit `9d79fe0`: Reverted to `database.types.ts` → ✅ Fixed
- Commit `d906616`: Added `export {};` for lazy init pattern → ✅ Final fix

**If you modify this file**, ensure:
- Filename stays `database.types.ts`
- Keep `export {};` at the end
- Update imports: `import type { Database } from './database.types';`

### 3. Local Fonts (Required)

**Problem**: Google Fonts CDN causes TLS connection failures in restricted build environments.

**Solution**: Load Bebas Neue font locally from `/public/fonts/BebasNeue-Regular.ttf`

```typescript
// app/layout.tsx
const bebasNeue = localFont({
  src: '../public/fonts/BebasNeue-Regular.ttf',
  variable: '--font-bebas-neue',
  display: 'swap',
});
```

**⚠️ DO NOT** revert to Google Fonts CDN.

### 4. Zod v3 Requirement (CRITICAL)

**⚠️ CRITICAL**: Zod must be `v3.25.76` (not v4.x).

**Why**: AI SDK v4 (`ai@4.3.19`) has fundamental incompatibility with Zod v4. The schema-to-JSON conversion produces incorrect type representations, causing:

```
Invalid schema for function 'json': schema must be a JSON Schema of 'type: "object"', got 'type: "string"'
```

**If you see this error**:
1. Check `package.json` - zod version must be `^3.25.76`
2. Run `pnpm install` to ensure correct version
3. Restart dev server

**Historical Context**:
- User initially had Zod v4.1.12 installed
- Downgraded to v3.25.76 in commit fixing DeepSeek theme generation
- All `generateObject()` calls now work correctly

### 5. Date Range Views (Current Pattern)

**Problem**: Users generating 30 days starting from any date (e.g., Nov 10) saw prompts split across months:
- `/agent/database/2025-11` showed Nov 10-30 (42 prompts)
- `/agent/database/2025-12` showed Dec 1-9 (18 prompts)

**Solution**: Created date-range view at `/agent/database/range/[startDate]/[endDate]`

**Files**:
- View: `app/agent/database/range/[startDate]/[endDate]/page.tsx`
- Redirect: `app/agent/create/page.tsx` (line 76)

**Why**: Prompts are generated as continuous 30-day ranges. Month-based routing fragmented the view. Date-range view treats the full 30 days as a single unit.

**Legacy**: Month-based view (`[monthYear]/page.tsx`) still exists for backward compatibility but is not used in current flow.

---

## 🗄 Database Schema

### Core Bot Tables

```sql
-- User bot configuration
CREATE TABLE bot_configs (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Notion integration (optional)
  notion_database_id TEXT,
  notion_token TEXT,  -- Added for secure server-side access

  -- Telegram bot credentials
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,

  -- Scheduling
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  morning_time TIME,
  evening_time TIME,

  -- Status
  is_active BOOLEAN DEFAULT false,

  -- Webhook health tracking
  webhook_url TEXT,
  webhook_last_set_at TIMESTAMPTZ,
  webhook_last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot runtime state
CREATE TABLE bot_state (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  last_prompt_sent_at TIMESTAMPTZ,
  last_prompt_type TEXT,  -- 'morning' | 'evening'
  last_prompt_page_id TEXT,  -- For reply logging
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription/credits management
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
  claude_credits INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### AI Agent Tables

```sql
-- User-generated prompts
CREATE TABLE user_prompts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  week_theme TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('morning', 'evening')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  prompts TEXT[] NOT NULL,  -- Array of 5 prompts
  response TEXT,  -- User's Telegram reply

  UNIQUE(user_id, date, post_type)  -- One morning, one evening per day
);

-- Brand context analysis
CREATE TABLE user_generation_context (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  brand_urls TEXT[],
  competitor_urls TEXT[],
  brand_voice TEXT,
  tone_attributes JSONB,
  target_audience TEXT,
  core_themes TEXT[],
  last_analysis_at TIMESTAMPTZ
);

-- Weekly themes (4 per generation)
CREATE TABLE user_weekly_themes (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  month_year TEXT NOT NULL,  -- "2025-11" format
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  theme_title TEXT NOT NULL,
  theme_description TEXT,
  keywords TEXT[],
  approved BOOLEAN DEFAULT false,

  UNIQUE(user_id, month_year, week_number)
);

-- Background job tracking
CREATE TABLE agent_generation_jobs (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'generating_prompts', 'completed', 'failed')),
  model_used TEXT NOT NULL,  -- 'deepseek-r1' | 'claude-sonnet-4-20250514'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_prompts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Constraints**:
- `user_prompts`: Unique composite key on `(user_id, date, post_type)` ensures exactly 2 prompts per day
- `user_weekly_themes`: Unique on `(user_id, month_year, week_number)` ensures 4 themes per generation
- All tables have RLS policies enabled (users can only access their own data)

---

## 🤖 AI Integration

### Models & Providers

**DeepSeek R1** (Free Tier):
- Provider: `@ai-sdk/deepseek@0.2.16`
- Model ID: `'deepseek-chat'`
- Cost: Free, unlimited
- Quality: Good for theme/prompt generation
- Setup: `DEEPSEEK_API_KEY` env var

**Claude Sonnet 4** (Paid Tier):
- Provider: `@ai-sdk/anthropic@1.2.12`
- Model ID: `'claude-sonnet-4-20250514'`
- Cost: 1 credit per generation (user purchases 3 credits for $9)
- Quality: Best quality, nuanced understanding
- Setup: `ANTHROPIC_API_KEY` env var

### AI Service Architecture

**File**: `server/services/ai-agent.ts`

```typescript
import { generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

// Initialize providers
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! });

// Zod schemas for structured output
const ThemeSchema = z.object({
  week_number: z.number().int().min(1).max(4),
  theme_title: z.string(),
  theme_description: z.string(),
  keywords: z.array(z.string()),
});

const DailyPromptSchema = z.object({
  date: z.string(),
  name: z.string(),
  week_theme: z.string(),
  post_type: z.enum(['morning', 'evening']),
  prompts: z.array(z.string()).length(5),  // Exactly 5 prompts
});

// Generate themes
async generateWeeklyThemes(context, userPreferences, useClaude = false) {
  const model = useClaude
    ? anthropic('claude-sonnet-4-20250514')
    : deepseek('deepseek-chat');

  const { object } = await generateObject({
    model,
    schema: WeeklyThemesSchema,  // z.object({ themes: z.array(ThemeSchema).length(4) })
    prompt: `Create 4 weekly themes for a month-long content calendar...`,
    temperature: 0.8,
    maxTokens: 2000,
  });

  return object.themes;
}

// Generate daily prompts
async generateDayPrompts(date, weekTheme, context, postType, useClaude = false) {
  const model = useClaude
    ? anthropic('claude-sonnet-4-20250514')
    : deepseek('deepseek-chat');

  const { object } = await generateObject({
    model,
    schema: DailyPromptSchema,
    prompt: `Generate a ${postType} prompt set for ${date}...

    REQUIREMENTS:
    1. Create EXACTLY 5 open-ended questions in the "prompts" array
    2. Questions must be thought-starters, not statements
    3. Return the questions as an array of 5 strings in the "prompts" field.
    `,
    temperature: 0.9,
    maxTokens: 1000,
  });

  return object;
}

// Batch generation (5 at a time to avoid rate limits)
async generateAllPrompts(startDate, endDate, weeklyThemes, context, useClaude) {
  const days = this.getDaysInRange(startDate, endDate);  // 30 days
  const results = [];

  const batchSize = 5;
  for (let i = 0; i < days.length; i += batchSize) {
    const batch = days.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.flatMap((day) => {
        const weekNumber = this.getWeekNumber(day.date, startDate);
        const theme = weeklyThemes[weekNumber - 1];

        return [
          this.generateDayPrompts(day.date, theme, context, 'morning', useClaude),
          this.generateDayPrompts(day.date, theme, context, 'evening', useClaude),
        ];
      })
    );

    results.push(...batchResults);

    // Delay between batches
    if (i + batchSize < days.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;  // 60 prompts (30 days × 2)
}
```

### Model Name Formatting

**⚠️ CRITICAL**: Claude model names use dashes, not dots.

**Correct**: `'claude-sonnet-4-20250514'`
**Incorrect**: `'claude-sonnet-4.5-20250929'` (will fail with "model not found")

**Historical Issue**: Original code used dots in model name, causing:
```
model: claude-sonnet-4.5-20250929 was not found. Did you mean claude-sonnet-4-5-20250929?
```

Fixed in commit that corrected DeepSeek provider integration.

### Credit Management

**Flow**:
1. Free tier users: Unlimited DeepSeek R1 usage
2. Pro tier users: Buy credits ($9 = 3 credits)
3. Each Claude generation deducts 1 credit
4. Admins: Exempt from credit checks (see `ADMIN_USER_ID` in `server/routers/agent.ts`)

**Credit Deduction** (`server/routers/agent.ts:396-407`):
```typescript
// AFTER successful generation, BEFORE marking job complete
if (useClaude && !isAdmin(ctx.userId)) {
  const { error: creditError } = await supabase
    .rpc('decrement_claude_credits', { user_id_param: ctx.userId });

  if (creditError) {
    throw new Error('Failed to deduct credit');
  }
}

// Only mark complete after credit deduction succeeds
await supabase.from('agent_generation_jobs')
  .update({ status: 'completed', total_prompts: prompts.length })
  .eq('id', job.id);
```

**Why This Order Matters**: If credit deduction fails, job stays incomplete, preventing "free" Claude generations.

---

## 🔐 Security Patterns

### 1. Environment Variable Secrets

**Server-Only Variables** (never exposed to client):
- `SUPABASE_SERVICE_ROLE_KEY` - Full database access
- `ANTHROPIC_API_KEY` - Claude API access
- `DEEPSEEK_API_KEY` - DeepSeek API access
- `CRON_SECRET` - Protect cron endpoints
- `TELEGRAM_WEBHOOK_SECRET` - Validate webhooks
- `CLERK_SECRET_KEY` - Server-side auth

**Public Variables** (safe for client):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (limited by RLS)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

**User-Provided Secrets** (stored in database, accessed server-side only):
- `notion_token` - User's Notion integration token (stored in `bot_configs.notion_token`)
- `telegram_bot_token` - User's Telegram bot token (stored in `bot_configs.telegram_bot_token`)

**⚠️ NEVER** send these in API responses or expose in client-side code.

### 2. Cron Endpoint Protection

**File**: `app/api/cron/route.ts`

```typescript
export async function GET(req: NextRequest) {
  // Verify secret header
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process scheduled prompts
  // ...
}
```

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron?type=morning",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Vercel automatically includes correct `Authorization` header with cron requests.

### 3. Webhook Validation

**File**: `app/api/webhook/[userId]/route.ts`

```typescript
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  // Validate webhook secret (URL-based secret unique per user)
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = req.nextUrl.searchParams.get('secret');

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  }

  // Process Telegram update
  // ...
}
```

### 4. Row Level Security (RLS)

**All tables have RLS enabled** with policies like:

```sql
CREATE POLICY "Users can view own prompts" ON user_prompts
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Users can update own prompts" ON user_prompts
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);
```

**Bypass**: Service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS for server-side operations. Used in:
- `lib/supabase-server.ts` - For cron jobs and webhooks
- `server/routers/*.ts` - For tRPC mutations with user context

### 5. Sanitized Logging

**File**: `lib/logger.ts`

```typescript
export class SafeLogger {
  static error(message: string, error: any) {
    // NEVER log full error objects (may contain API keys)
    const safeError = {
      message: error?.message || String(error),
      name: error?.name,
      // NO stack traces, NO full error objects
    };
    console.error('[ERROR]', message, safeError);
  }
}
```

**⚠️ DO NOT** use `console.error(error)` directly. Use `SafeLogger.error()`.

---

## 🚀 Build & Deployment

### Build Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "bash scripts/validate-env.sh && bash scripts/generate-types.sh && next build",
    "build:skip-types": "bash scripts/validate-env.sh && next build",
    "generate-types": "bash scripts/generate-types.sh"
  }
}
```

### Environment Validation

**File**: `scripts/validate-env.sh`

```bash
#!/bin/bash
set -e

REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "CLERK_SECRET_KEY"
  "NEXT_PUBLIC_APP_URL"
  "CRON_SECRET"
  "TELEGRAM_WEBHOOK_SECRET"
  "ANTHROPIC_API_KEY"
  "DEEPSEEK_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

echo "✅ All required environment variables are set"
```

**Runs**: Automatically before every build

### Type Generation

**File**: `scripts/generate-types.sh`

```bash
#!/bin/bash
# Generate Supabase types from live database

npx supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_ID" \
  --schema public \
  > lib/database.types.ts 2>/dev/null || {
  echo "⚠️  Type generation failed (expected in some environments)"
  echo "📝 Using committed types from lib/database.types.ts"
  exit 0  # Non-blocking failure
}

# Add required module export
echo "" >> lib/database.types.ts
echo "// TypeScript requires at least one value export for isolatedModules" >> lib/database.types.ts
echo "export {};" >> lib/database.types.ts
```

**Behavior**:
- Tries to connect to Supabase and generate types
- If fails (IPv6, network, etc.), falls back to committed types
- Adds `export {};` to satisfy TypeScript module requirements
- **Non-blocking** - build continues even if type generation fails

### Vercel Deployment

**Required Environment Variables** (set in Vercel dashboard):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_APP_URL           # https://your-app.vercel.app
CRON_SECRET                   # Generate random: openssl rand -hex 32
TELEGRAM_WEBHOOK_SECRET       # Generate random: openssl rand -hex 32
ANTHROPIC_API_KEY
DEEPSEEK_API_KEY
```

**Build Command**: `pnpm build` (default)

**Cron Jobs**: Automatically configured from `vercel.json`

---

## 🎨 UI/UX Patterns

### Design System

**Theme**: Minimalist brutalism
- **Colors**: Black (`#000000`) and White (`#FFFFFF`) only
- **Borders**: Thick 2px-4px black borders
- **Font**: Bebas Neue (display), system fonts (body)
- **Spacing**: Consistent 8px grid

**Typography**:
```css
/* Display text */
.font-display {
  font-family: var(--font-bebas-neue);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Body text */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...
```

**Button Variants**:
- Primary: Black background, white text
- Outline: White background, black border, black text
- Destructive: Red text/border (limited use)

### Component Patterns

**Button** (`components/ui/button.tsx`):
```tsx
<Button variant="default">PRIMARY</Button>
<Button variant="outline">SECONDARY</Button>
<Button variant="destructive">DELETE</Button>
```

**Input** (`components/ui/input.tsx`):
```tsx
<Input
  type="text"
  placeholder="Enter value"
  className="border-2 border-black"
/>
```

**Page Layout**:
```tsx
<div className="min-h-screen bg-white">
  {/* Header with border */}
  <div className="border-b-2 border-black">
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-4xl font-display">PAGE TITLE</h1>
    </div>
  </div>

  {/* Content */}
  <div className="container mx-auto px-4 py-8">
    {/* Page content */}
  </div>
</div>
```

### Navigation Patterns

**Breadcrumbs**:
```tsx
<div className="text-sm text-gray-600">
  <span className="cursor-pointer hover:text-black" onClick={() => router.push('/dashboard')}>
    Dashboard
  </span>
  <span className="mx-2">→</span>
  <span>Current Page</span>
</div>
```

**Back Button**:
```tsx
<Button variant="outline" onClick={() => router.push('/dashboard')}>
  ← BACK
</Button>
```

---

## 🧪 Testing & Debugging

### Local Development

```bash
# Start dev server
pnpm dev

# Access at http://localhost:3000

# Hot reload enabled for:
# - App Router pages
# - Server components
# - tRPC routers
# - Tailwind styles
```

### Debug Logging

```typescript
import { SafeLogger } from '@/lib/logger';

// In server-side code
SafeLogger.info('User generated prompts', { userId, count: prompts.length });
SafeLogger.error('Generation failed', error);

// Check logs in Vercel dashboard or terminal
```

### Common Issues

**Issue**: Build fails with "File is not a module"
**Fix**: Ensure `lib/database.types.ts` has `.types.ts` extension and `export {};`

**Issue**: AI generation fails with "Invalid schema"
**Fix**: Check Zod version - must be v3.x, not v4.x

**Issue**: Prompts split across months
**Fix**: Redirect to date-range view, not month view (`/agent/database/range/[startDate]/[endDate]`)

**Issue**: Telegram webhook not receiving updates
**Fix**:
1. Check webhook is set: `https://api.telegram.org/bot<token>/getWebhookInfo`
2. Re-run setup flow to set webhook
3. Verify `TELEGRAM_WEBHOOK_SECRET` matches in code and env vars

**Issue**: Cron jobs not triggering
**Fix**:
1. Check Vercel Cron logs in dashboard
2. Verify `CRON_SECRET` is set in environment
3. Ensure users have `is_active = true` in `bot_configs`

---

## 📚 Key Files Reference

### Critical Files (DO NOT BREAK)

| File | Purpose | Critical Notes |
|------|---------|----------------|
| `lib/database.types.ts` | Generated Supabase types | **MUST** have `.types.ts` extension and `export {};` |
| `lib/supabase-server.ts` | Server-side Supabase client | **MUST** use lazy Proxy initialization |
| `lib/supabase.ts` | Client-side Supabase client | **MUST** use lazy Proxy initialization |
| `package.json` | Dependencies | Zod **MUST** be v3.x (not v4.x) |
| `app/layout.tsx` | Root layout | Bebas Neue **MUST** be loaded locally |
| `server/services/ai-agent.ts` | AI integration | Model names use dashes, not dots |

### Router Files

| File | Purpose | Key Procedures |
|------|---------|----------------|
| `server/routers/agent.ts` | AI generation endpoints | `analyzeContext`, `generateThemes`, `generatePrompts`, `getPrompts` |
| `server/routers/bot.ts` | Bot configuration | `getConfig`, `createConfig`, `updateConfig`, `testPrompt` |
| `server/routers.ts` | Root router | Combines all sub-routers |

### API Routes

| File | Purpose | Auth |
|------|---------|------|
| `app/api/cron/route.ts` | Scheduled prompt delivery | `CRON_SECRET` header |
| `app/api/webhook/[userId]/route.ts` | Telegram updates | `TELEGRAM_WEBHOOK_SECRET` query param |
| `app/api/trpc/[trpc]/route.ts` | tRPC endpoint | Clerk session |

### UI Pages

| File | Purpose | Auth |
|------|---------|------|
| `app/page.tsx` | Landing page | Public |
| `app/dashboard/page.tsx` | Main dashboard | Protected |
| `app/agent/create/page.tsx` | AI generation flow | Protected |
| `app/agent/database/range/[startDate]/[endDate]/page.tsx` | Prompt viewing | Protected |
| `app/onboarding/page.tsx` | Onboarding router | Protected |

---

## 🎯 Development Workflow

### Adding a New Feature

1. **Database Schema**: Add tables/columns to `supabase/complete_schema.sql`
2. **Types**: Run `pnpm generate-types` to update `lib/database.types.ts`
3. **Service Layer**: Add business logic to `server/services/*.ts`
4. **Router**: Add tRPC procedures to `server/routers/*.ts`
5. **UI**: Create page in `app/` with tRPC client
6. **Test**: Local testing, then deploy to Vercel preview

### Modifying AI Generation

**Files to touch**:
- `server/services/ai-agent.ts` - AI SDK calls
- `server/routers/agent.ts` - tRPC endpoints
- `app/agent/create/page.tsx` - UI flow

**Remember**:
- Use `generateObject()` with Zod schemas for structured output
- Keep temperature high (0.8-0.9) for creative prompts
- Batch API calls (5 at a time) to avoid rate limits
- Handle DeepSeek vs Claude model selection

### Changing Database Schema

1. **Update SQL**: Modify `supabase/complete_schema.sql`
2. **Create Migration**: Save changes to `supabase/migrations/*.sql`
3. **Apply in Supabase**: Run SQL in Supabase dashboard
4. **Regenerate Types**: Run `pnpm generate-types`
5. **Update Code**: Fix TypeScript errors from type changes

### Adding Environment Variables

1. **Update Validation**: Add to `scripts/validate-env.sh`
2. **Update README**: Document in environment variables section
3. **Update Vercel**: Add to Vercel project settings
4. **Update `.env.example`**: Add placeholder value

---

## 🚨 Common Pitfalls

### 1. DO NOT Upgrade Zod to v4
**Symptom**: `Invalid schema for function 'json'` errors
**Fix**: Downgrade to Zod v3.25.76

### 2. DO NOT Rename database.types.ts
**Symptom**: `File is not a module` build errors
**Fix**: Keep `.types.ts` extension

### 3. DO NOT Use Direct Supabase Initialization
**Symptom**: `Missing environment variable` build errors
**Fix**: Use lazy Proxy pattern

### 4. DO NOT Use Google Fonts CDN
**Symptom**: TLS connection errors during build
**Fix**: Load fonts locally from `/public/fonts/`

### 5. DO NOT Forget Empty Export
**Symptom**: Module resolution errors with `.types.ts` file
**Fix**: Ensure `export {};` at end of `database.types.ts`

### 6. DO NOT Use Dots in Claude Model Names
**Symptom**: `model not found` errors
**Fix**: Use dashes: `claude-sonnet-4-20250514` not `claude-sonnet-4.5-20250929`

### 7. DO NOT Redirect to Month View After Generation
**Symptom**: Only shows partial prompts (split across months)
**Fix**: Redirect to `/agent/database/range/[startDate]/[endDate]`

---

## 📖 Historical Context

### Major Refactors

**1. Lazy Supabase Initialization** (commits 38803af, 9d79fe0, d906616)
- **Problem**: Next.js builds failed with "Missing environment variable"
- **Solution**: Proxy pattern delays initialization until runtime
- **Impact**: Builds work without credentials, no env var leaks

**2. Zod v4 → v3 Downgrade** (commit with DeepSeek fixes)
- **Problem**: AI SDK v4 incompatible with Zod v4
- **Solution**: Downgrade to Zod v3.25.76
- **Impact**: All `generateObject()` calls work correctly

**3. Database Type File Rename** (commits 63a3ddd, 9d79fe0, d906616)
- **Problem**: Renamed `database.types.ts` to `database.ts` broke builds
- **Solution**: Reverted to `.types.ts` extension + added `export {}`
- **Impact**: TypeScript recognizes file as module

**4. Date Range Views** (commit a164d40)
- **Problem**: Month-based views split continuous 30-day prompts
- **Solution**: Created `/agent/database/range/[startDate]/[endDate]` view
- **Impact**: Users see full 60 prompts in single view

### Deprecated Patterns

**❌ Direct Supabase Init** (pre-38803af):
```typescript
// DON'T DO THIS
export const serverSupabase = createClient<Database>(url, key);
```

**❌ Google Fonts CDN** (pre-38803af):
```typescript
// DON'T DO THIS
import { Bebas_Neue } from 'next/font/google';
```

**❌ Month-Based Redirect** (pre-a164d40):
```typescript
// DON'T DO THIS
router.push(`/agent/database/${monthYear}`);
```

### Known Limitations

1. **IPv6 Type Generation**: Fails in some environments (Vercel), falls back to committed types
2. **Cron Frequency**: Checks every 5 minutes (can't do sub-minute precision with Vercel)
3. **Telegram Rate Limits**: 30 messages/second per bot (tracked in `telegram_rate_limit` table)
4. **Claude Credits**: Manual purchase flow (no Stripe integration yet)
5. **Notion Integration**: Only reads from database (doesn't create pages)

---

## 🎓 Learning Resources

### Recommended Reading

- **Next.js 15 App Router**: https://nextjs.org/docs/app
- **tRPC v11**: https://trpc.io/docs/v11
- **Vercel AI SDK v4**: https://sdk.vercel.ai/docs/introduction
- **Zod v3**: https://zod.dev (use v3 docs, not latest)
- **Supabase Docs**: https://supabase.com/docs
- **Clerk Auth**: https://clerk.com/docs
- **Telegram Bot API**: https://core.telegram.org/bots/api

### Code Examples

**tRPC Mutation with Supabase**:
```typescript
// server/routers/agent.ts
export const agentRouter = router({
  generatePrompts: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
      useClaude: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ctx.userId from Clerk middleware
      const prompts = await AIAgentService.generateAllPrompts(
        input.startDate,
        input.endDate,
        themes,
        context,
        input.useClaude
      );

      await supabase.from('user_prompts').insert(
        prompts.map(p => ({ user_id: ctx.userId, ...p }))
      );

      return { success: true, totalPrompts: prompts.length };
    }),
});
```

**Client-Side tRPC Usage**:
```typescript
// app/agent/create/page.tsx
const generatePrompts = trpc.agent.generatePrompts.useMutation({
  onSuccess: (data) => {
    toast.success(`Generated ${data.totalPrompts} prompts!`);
    router.push(`/agent/database/range/${startDate}/${endDate}`);
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// Call it
await generatePrompts.mutateAsync({
  startDate: '2025-11-10',
  endDate: '2025-12-09',
  useClaude: false,
});
```

---

## 🤝 Contributing Guidelines

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `pnpm format`)
- **Linting**: ESLint (run `pnpm lint`)
- **Naming**: camelCase for variables, PascalCase for components

### Commit Messages

Format: `type: description`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation update
- `refactor` - Code refactor
- `chore` - Build/tooling changes

Examples:
- `feat: Add date-range view for continuous prompt display`
- `fix: Revert database.ts to database.types.ts to resolve module error`
- `docs: Update README with AI generation features`

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with clear commits
3. Test locally (`pnpm build` succeeds)
4. Update relevant documentation
5. Submit PR with description of changes
6. Deploy preview in Vercel (automatic)
7. Merge to `main` after approval

---

## 📞 Support & Maintenance

### Logs & Monitoring

**Vercel Dashboard**:
- Build logs: Deployment → Function Logs
- Cron logs: Cron Jobs → View Logs
- Runtime logs: Functions → Logs

**Local Debugging**:
```bash
# Start dev server with verbose logging
pnpm dev

# Check Supabase logs
# Go to Supabase dashboard → Logs

# Check Clerk logs
# Go to Clerk dashboard → Logs
```

### Performance

**Build Time**: ~60-90 seconds
**Cold Start**: ~500ms (serverless functions)
**Page Load**: <2s (most pages)

**Optimizations**:
- Lazy loading for Supabase clients
- Local font loading
- tRPC for efficient data fetching
- Date-range views reduce re-renders

### Backup & Recovery

**Database**: Supabase auto-backups (daily)
**Code**: GitHub repository
**Environment**: Document all env vars in Vercel and `.env.example`

**Recovery Process**:
1. Restore Supabase backup if needed
2. Redeploy from known-good commit
3. Verify environment variables
4. Test critical flows (auth, generation, delivery)

---

## ✅ Final Checklist

When working on this codebase, always verify:

- [ ] Zod is v3.25.76 (not v4.x)
- [ ] `lib/database.types.ts` has `.types.ts` extension
- [ ] Supabase clients use lazy Proxy initialization
- [ ] Fonts loaded locally (not Google CDN)
- [ ] Claude model names use dashes (not dots)
- [ ] Date-range redirects (not month-based)
- [ ] Environment variables validated before build
- [ ] RLS policies enabled on all tables
- [ ] Secrets never exposed to client
- [ ] Logging uses `SafeLogger`, not `console.error`

---

**This document is comprehensive but not exhaustive. When in doubt, check the code and commit history. The git log tells the story of what works and what doesn't.**

**Good luck building! 🚀**
