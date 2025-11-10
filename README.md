# Threadbot - AI-Powered Content Prompt Automation

**Transform your content creation workflow with AI-generated prompts delivered via Telegram.**

Threadbot is a SaaS application that generates personalized content prompts using AI (Claude Sonnet 4 or DeepSeek R1) and delivers them to your Telegram at scheduled times. Perfect for daily journaling, content creation, reflection practices, and building consistent creative habits.

## 🎯 What It Does

1. **Analyze Your Brand** - AI analyzes your website, social profiles, or any URL to understand your voice and themes
2. **Generate Weekly Themes** - Creates 4 themed weeks aligned with your brand identity
3. **Create Daily Prompts** - Generates 60 unique prompts (30 days × morning + evening)
4. **Deliver via Telegram** - Sends prompts at your scheduled times
5. **Log Replies to Notion** - (Optional) Automatically saves your responses back to Notion

## 🚀 Key Features

### AI Prompt Generation
- **Context Analysis** - AI learns your brand voice, target audience, and core themes from URLs
- **Weekly Theme Planning** - 4 themed weeks with keywords and descriptions
- **Smart Prompt Creation** - 5 thought-starter questions per prompt, tailored to time of day
- **Continuous Date Ranges** - Generates 30-day ranges regardless of calendar months
- **Model Options**:
  - **DeepSeek R1** - Free, unlimited generations
  - **Claude Sonnet 4** - Premium quality (requires credits)

### Delivery & Management
- **Telegram Integration** - Automated delivery via Telegram bot
- **Flexible Scheduling** - Set custom morning/evening times with timezone support
- **Prompt Database** - View, edit, and export all generated prompts
- **Date Range Views** - See continuous 30-day prompt sets in a single view
- **CSV Export** - Download prompts for offline use

### Notion Integration (Optional)
- **Import Existing Prompts** - Connect your Notion database
- **Reply Logging** - Automatically save Telegram responses back to Notion
- **Bidirectional Sync** - Use AI-generated OR Notion-based prompts

## 🛠 Tech Stack

- **Frontend**: Next.js 16 (App Router with Turbopack), React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes, tRPC 11
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Clerk
- **AI**: Vercel AI SDK v4 with Anthropic Claude & DeepSeek providers
- **Deployment**: Vercel (with Cron Jobs)
- **Integrations**: Notion API, Telegram Bot API

## 📦 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/threadbot.git
cd threadbot
pnpm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the complete schema:

```bash
# Copy your Supabase project URL and keys
cp .env.example .env.local

# Run schema in Supabase SQL Editor
# Copy contents from: supabase/complete_schema.sql
```

### 3. Set Up Clerk Authentication

1. Create an application at [clerk.com](https://clerk.com)
2. Enable email/password or OAuth providers
3. Copy your keys to `.env.local`

### 4. Configure Environment Variables

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# App (Required)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Security (Required for Production)
CRON_SECRET=your_random_secret_for_cron_endpoints
TELEGRAM_WEBHOOK_SECRET=your_random_secret_for_telegram_webhooks

# AI Models (Required for AI Features)
ANTHROPIC_API_KEY=your_anthropic_api_key  # For Claude Sonnet 4
DEEPSEEK_API_KEY=your_deepseek_api_key    # For free tier

# Notion (Optional - only if using Notion integration)
# Users provide their own Notion tokens during onboarding
```

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🚢 Deployment to Vercel

### 1. Push to GitHub

```bash
git remote add origin https://github.com/yourusername/threadbot.git
git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Add all environment variables from `.env.local`
5. Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
6. Deploy

### 3. Configure Vercel Cron Jobs

The `vercel.json` file is already configured:

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

Cron jobs check every 5 minutes if it's time to send prompts to any user.

### 4. Add Vercel Domain to Clerk

1. Go to Clerk Dashboard → Domains
2. Add your Vercel domain (e.g., `your-app.vercel.app`)
3. Add production URLs to allowed redirect URLs

## 📖 User Flow

### New User Onboarding

1. **Sign Up** - Create account with Clerk
2. **Choose Flow**:
   - **AI Generation** - Analyze brand and generate prompts
   - **Notion Import** - Connect existing Notion database (coming soon)
   - **Skip** - Set up manually later

### AI Prompt Generation Flow

1. **Analyze Context**
   - Add brand URLs (website, social profiles, content)
   - Add inspiration URLs (optional)
   - AI analyzes voice, themes, and audience

2. **Generate Themes**
   - Review 4 AI-generated weekly themes
   - Edit if needed
   - Approve themes

3. **Generate Prompts**
   - Choose AI model (DeepSeek free or Claude paid)
   - Select start date
   - Generate 60 prompts (30 days × 2)

4. **Set Up Delivery**
   - Create Telegram bot via [@BotFather](https://t.me/botfather)
   - Configure schedule times
   - Set timezone
   - Activate bot

### Daily Usage

1. **Receive Prompts** - Telegram delivers prompts at your scheduled times
2. **Respond** - Reply directly in Telegram
3. **Auto-Log** - (Optional) Responses saved to Notion
4. **Review** - View all prompts and responses in dashboard

## 🗂 Project Structure

```
threadbot/
├── app/
│   ├── agent/                    # AI prompt generation
│   │   ├── create/              # Context analysis & generation
│   │   └── database/            # Prompt viewing & editing
│   │       ├── [monthYear]/     # Month-based view
│   │       └── range/           # Date-range view
│   ├── api/
│   │   ├── cron/                # Scheduled prompt sender
│   │   ├── trpc/                # tRPC API handler
│   │   └── webhook/             # Telegram webhook
│   ├── dashboard/               # Main dashboard
│   ├── onboarding/              # Multi-step onboarding
│   └── setup/                   # Bot configuration
├── server/
│   ├── routers/
│   │   ├── agent.ts            # AI generation endpoints
│   │   └── bot.ts              # Bot configuration endpoints
│   └── services/
│       ├── ai-agent.ts         # AI SDK integration
│       ├── notion.ts           # Notion API client
│       └── telegram.ts         # Telegram Bot API
├── lib/
│   ├── supabase-server.ts      # Server-side Supabase (lazy init)
│   ├── supabase.ts             # Client-side Supabase
│   ├── database.types.ts       # Generated Supabase types
│   └── trpc.ts                 # tRPC client setup
├── supabase/
│   ├── complete_schema.sql     # Full database schema
│   └── agent_schema.sql        # AI agent tables
└── docs/                        # Technical documentation
```

## 🔐 Security Features

- **Lazy Supabase Initialization** - Prevents build-time env var leaks
- **Server-Side API Keys** - All AI/Notion/Telegram credentials stay server-side
- **Webhook Secrets** - HMAC validation for Telegram webhooks
- **Cron Secrets** - Protect scheduled endpoints
- **RLS Policies** - Row-level security on all Supabase tables
- **Clerk Protected Routes** - All user pages require authentication

## 📊 Database Schema

### Core Tables
- `bot_configs` - User bot configurations (Telegram, Notion, schedules)
- `bot_state` - Bot runtime state (last prompt sent, timestamps)
- `user_subscriptions` - Subscription tiers and Claude credits
- `telegram_rate_limit` - Rate limiting for Telegram API

### AI Agent Tables
- `user_prompts` - Generated daily prompts (date, type, prompts[])
- `user_generation_context` - Brand analysis context
- `user_weekly_themes` - 4 weekly themes per generation
- `agent_generation_jobs` - Background job tracking

## 🎨 Design System

- **Minimalist Black/White Theme** - Clean, distraction-free interface
- **Bebas Neue Display Font** - Bold, modern typography
- **Brutalist Aesthetic** - Thick borders, high contrast, geometric layouts
- **Responsive Design** - Mobile-first, works on all devices

## 🔧 Development

### Build Commands

```bash
# Development
pnpm dev                   # Start dev server

# Type Generation
pnpm generate-types        # Generate Supabase types (requires connection)

# Build
pnpm build                 # Full production build with type generation
pnpm build:skip-types      # Build without type generation (for CI/CD)

# Lint & Format
pnpm lint                  # ESLint check
pnpm format                # Prettier format
```

### Environment Validation

The build process validates required environment variables:

```bash
# Runs automatically during build
./scripts/validate-env.sh
```

### Type Safety

Supabase types are auto-generated during builds. If type generation fails (e.g., IPv6 connectivity), it falls back to committed types in `lib/database.types.ts`.

## 🐛 Troubleshooting

### Build Issues

**Problem**: `Type error: File 'lib/database.types.ts' is not a module`
**Solution**: The `.types.ts` extension is required for TypeScript module resolution with `isolatedModules: true`. The file includes an empty `export {};` to satisfy module requirements.

**Problem**: Type generation fails during build
**Solution**: This is expected in some environments. Build falls back to committed types. Update types manually by running `pnpm generate-types` locally.

### Telegram Delivery Issues

**Problem**: Prompts not sending
**Solution**:
1. Check Vercel Cron logs
2. Verify `CRON_SECRET` matches in code and environment
3. Ensure bot is activated in dashboard
4. Check user has started conversation with bot

**Problem**: Webhooks not working
**Solution**:
1. Verify webhook URL is set correctly (run setup again)
2. Check `TELEGRAM_WEBHOOK_SECRET` is configured
3. Test webhook with Telegram API tester

## 📝 API Documentation

### tRPC Endpoints

**Agent Router** (`/api/trpc/agent.*`)
- `analyzeContext` - Analyze brand URLs with AI
- `generateThemes` - Create 4 weekly themes
- `generatePrompts` - Generate 60 daily prompts
- `getPrompts` - Fetch prompts by date range
- `updatePrompt` - Edit a prompt
- `deletePrompt` - Remove a prompt

**Bot Router** (`/api/trpc/bot.*`)
- `getConfig` - Get user bot configuration
- `createConfig` - Initial setup
- `updateConfig` - Update settings
- `testPrompt` - Send test prompt to Telegram

### REST Endpoints

**Cron** (`/api/cron?type=morning|evening`)
- Scheduled prompt delivery
- Requires `CRON_SECRET` header

**Webhook** (`/api/webhook/[userId]`)
- Receives Telegram updates
- Validates with `TELEGRAM_WEBHOOK_SECRET`

## 🎓 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [tRPC Docs](https://trpc.io/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📄 License

MIT

---

**Status**: ✅ Production Ready
**Last Updated**: 2025-11-10
**Version**: 1.0.0
