# Threadbot - Project Summary

## What This Is

Threadbot is a fully functional SaaS application that automates sending Notion database prompts to Telegram at scheduled times and logs replies back to Notion. Perfect for daily journaling, reflection, and habit tracking.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes, tRPC 11
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Clerk
- **Deployment:** Vercel (with Cron Jobs)
- **Integrations:** Notion API, Telegram Bot API

## Project Structure

```
threadbot-saas/
├── app/
│   ├── api/
│   │   ├── cron/route.ts          # Scheduled prompt endpoint
│   │   ├── trpc/[trpc]/route.ts   # tRPC API handler
│   │   └── webhook/[userId]/route.ts  # Telegram webhook
│   ├── dashboard/page.tsx         # Main dashboard
│   ├── onboarding/page.tsx        # Onboarding router
│   ├── setup/
│   │   ├── notion/page.tsx        # Notion setup
│   │   ├── telegram/page.tsx      # Telegram setup
│   │   └── schedule/page.tsx      # Schedule setup
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Landing page
│   ├── providers.tsx              # Clerk + tRPC providers
│   └── globals.css                # Global styles
├── components/
│   └── ui/
│       ├── button.tsx             # Button component
│       └── input.tsx              # Input component
├── lib/
│   ├── supabase.ts                # Supabase client
│   ├── trpc.ts                    # tRPC client
│   └── utils.ts                   # Utility functions
├── server/
│   ├── routers.ts                 # tRPC routers
│   ├── trpc.ts                    # tRPC initialization
│   └── services/
│       ├── bot.ts                 # Bot operations
│       ├── notion.ts              # Notion integration
│       └── telegram.ts            # Telegram integration
├── supabase/
│   └── schema.sql                 # Database schema
├── .env.local                     # Environment variables (not committed)
├── middleware.ts                  # Clerk authentication
├── vercel.json                    # Vercel cron configuration
├── README.md                      # Setup instructions
├── DEPLOYMENT.md                  # Deployment guide
└── todo.md                        # Implementation checklist
```

## Features Implemented

### ✅ Authentication
- Clerk-based user authentication
- Protected routes with middleware
- Sign in/sign up modals

### ✅ Onboarding Flow
- Step 1: Connect Notion workspace
- Step 2: Set up Telegram bot
- Step 3: Configure schedule and timezone
- Automatic webhook setup

### ✅ Dashboard
- Bot status (active/inactive)
- Configuration display
- Last prompt information
- Test prompt buttons (morning/evening)
- Toggle bot activation

### ✅ Bot Operations
- Query Notion database for daily prompts
- Send prompts to Telegram at scheduled times
- Receive replies via webhook
- Log replies back to Notion pages
- Timezone support

### ✅ API Routes
- `/api/cron?type=morning|evening` - Scheduled prompt sender
- `/api/webhook/[userId]` - Telegram webhook handler
- `/api/trpc/[trpc]` - tRPC API endpoint

### ✅ tRPC Procedures
- `bot.getConfig` - Get user's bot configuration
- `bot.getState` - Get bot state (last prompt, etc.)
- `bot.createConfig` - Create initial configuration
- `bot.updateConfig` - Update configuration
- `bot.setupWebhook` - Set Telegram webhook
- `bot.getWebhookInfo` - Get webhook status
- `bot.testPrompt` - Send test prompt

### ✅ Design
- Minimalist black/white theme
- Bebas Neue display font
- Responsive layout
- Clean, professional UI

## How It Works

### 1. User Onboarding
1. User signs up with Clerk
2. Connects Notion workspace and selects database
3. Creates Telegram bot and provides credentials
4. Sets schedule times and timezone
5. Bot is activated automatically

### 2. Scheduled Prompts
1. Vercel Cron hits `/api/cron?type=morning` every 5 minutes
2. Endpoint checks all active bot configurations
3. For each bot, checks if current time matches scheduled time
4. Queries Notion database for today's prompt
5. Sends prompt to user's Telegram chat
6. Updates bot state with last sent prompt

### 3. Reply Handling
1. User replies in Telegram
2. Telegram sends update to `/api/webhook/[userId]`
3. Endpoint extracts message text
4. Appends reply to the Notion page
5. User can see reply in their Notion database

## Database Schema

### bot_configs
- Stores user's Notion and Telegram credentials
- Schedule times and timezone
- Active/inactive status

### bot_state
- Tracks last sent prompt
- Stores page ID for reply logging
- Timestamp of last prompt

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

## Deployment Checklist

- [ ] Create Supabase project and run schema
- [ ] Create Clerk application
- [ ] Push code to GitHub
- [ ] Deploy to Vercel
- [ ] Add environment variables in Vercel
- [ ] Update NEXT_PUBLIC_APP_URL with Vercel URL
- [ ] Add Vercel domain to Clerk
- [ ] Enable Vercel Cron (Pro plan) or use external cron service
- [ ] Test complete flow

## Testing Locally

1. Set up environment variables in `.env.local`
2. Run `pnpm install`
3. Run `pnpm dev`
4. Visit `http://localhost:3001`
5. Sign up and complete onboarding
6. Test prompt sending from dashboard

## Known Limitations

- Cron jobs run every 5 minutes (checks if it's time to send)
- Requires Vercel Pro for built-in cron (or use external service)
- Notion database must have "Date" and "Name" properties
- Telegram bot must be started by user before receiving messages

## Future Enhancements

- [ ] Custom cron schedules per user
- [ ] Multiple prompts per day
- [ ] Reply confirmation in Telegram
- [ ] Analytics dashboard
- [ ] Email notifications
- [ ] Multiple Notion databases
- [ ] Prompt templates
- [ ] Reply history view

## Support

See DEPLOYMENT.md for detailed deployment instructions.
See README.md for setup and usage instructions.

---

**Status:** ✅ Fully functional and ready to deploy
**Last Updated:** 2025-01-08
