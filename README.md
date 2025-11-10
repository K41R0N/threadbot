# Threadbot - Notion to Telegram Automation SaaS

Automate sending Notion database prompts to Telegram at scheduled times and log replies back to Notion.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes, tRPC
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Clerk
- **Deployment:** Vercel (with Cron)
- **Integrations:** Notion API, Telegram Bot API

## Setup Instructions

### 1. Clone and Install

```bash
pnpm install
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Run the SQL schema (see `supabase/schema.sql`)

### 3. Set Up Clerk

1. Create an application at [clerk.com](https://clerk.com)
2. Copy your publishable key and secret key

### 4. Configure Environment Variables

Copy `.env.local` and fill in your values:

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

### 5. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables (see below)
4. Deploy

#### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

> **Note**: Database types are auto-generated from your Supabase schema on every build using your existing credentials.

### Set Up Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/prompts?type=morning",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/prompts?type=evening",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Features

- ✅ User authentication with Clerk
- ✅ Notion workspace integration
- ✅ Telegram bot setup
- ✅ Scheduled prompts (morning/evening)
- ✅ Reply logging to Notion
- ✅ Dashboard with bot status
- ✅ Test prompt functionality
- ✅ Timezone support

## License

MIT
