# Threadbot Deployment Guide

## Prerequisites

Before deploying, you need to set up:

1. **Supabase Account** (database)
2. **Clerk Account** (authentication)
3. **Vercel Account** (hosting)
4. **GitHub Account** (code repository)

---

## Step 1: Set Up Supabase

### Create Project

1. Go to [supabase.com](https://supabase.com) and create an account
2. Click "New Project"
3. Choose a name, database password, and region
4. Wait for the project to be created

### Run Database Schema

1. In your Supabase dashboard, go to "SQL Editor"
2. Click "New Query"
3. Copy the entire contents of `supabase/schema.sql` from this project
4. Paste and click "Run"
5. Verify tables were created in "Table Editor"

### Get API Keys

1. Go to "Project Settings" → "API"
2. Copy these values:
   - **Project URL** (starts with `https://...supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

---

## Step 2: Set Up Clerk

### Create Application

1. Go to [clerk.com](https://clerk.com) and create an account
2. Click "Add Application"
3. Name it "Threadbot"
4. Choose authentication methods (Email, Google, etc.)
5. Click "Create Application"

### Get API Keys

1. In your Clerk dashboard, go to "API Keys"
2. Copy these values:
   - **Publishable Key** (starts with `pk_...`)
   - **Secret Key** (starts with `sk_...`)

### Configure Domains (After Deployment)

1. Go to "Domains" in Clerk dashboard
2. Add your Vercel domain (e.g., `threadbot.vercel.app`)
3. This allows authentication to work in production

---

## Step 3: Push to GitHub

### Create Repository

```bash
cd threadbot-saas
git init
git add .
git commit -m "Initial commit"
```

### Push to GitHub

1. Create a new repository on [github.com](https://github.com)
2. Don't initialize with README (your project already has one)
3. Copy the commands GitHub provides:

```bash
git remote add origin https://github.com/YOUR_USERNAME/threadbot.git
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Vercel

### Import Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect it's a Next.js project

### Configure Environment Variables

In the Vercel deployment settings, add these environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# App
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

**Important:** For `NEXT_PUBLIC_APP_URL`, use your actual Vercel deployment URL (you'll get this after first deployment).

### Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Copy your deployment URL (e.g., `https://threadbot-abc123.vercel.app`)

### Update Environment Variable

1. Go back to Vercel project settings
2. Update `NEXT_PUBLIC_APP_URL` with your actual deployment URL
3. Redeploy (Vercel → Deployments → click "..." → Redeploy)

---

## Step 5: Enable Cron Jobs

### Vercel Cron (Recommended)

The `vercel.json` file already configures cron jobs. They will:
- Run every 5 minutes
- Check all active bots
- Send prompts if it's the scheduled time

**Note:** Vercel Cron is available on Pro plans. For free tier, see alternatives below.

### Alternative: External Cron Service

If you're on Vercel's free tier, use [cron-job.org](https://cron-job.org):

1. Create a free account
2. Add two cron jobs:
   - **Morning prompts:** `https://your-app.vercel.app/api/cron?type=morning` (every 5 minutes)
   - **Evening prompts:** `https://your-app.vercel.app/api/cron?type=evening` (every 5 minutes)

---

## Step 6: Update Clerk Domain

1. Go back to Clerk dashboard
2. Navigate to "Domains"
3. Add your Vercel deployment URL
4. This ensures authentication works in production

---

## Step 7: Test Your Deployment

1. Visit your Vercel URL
2. Sign up for an account
3. Complete the onboarding flow:
   - Connect Notion
   - Set up Telegram bot
   - Configure schedule
4. Send a test prompt from the dashboard
5. Reply in Telegram and verify it logs to Notion

---

## Troubleshooting

### Authentication Not Working

- Verify Clerk domain is added in Clerk dashboard
- Check `NEXT_PUBLIC_APP_URL` matches your Vercel URL
- Ensure all Clerk environment variables are correct

### Database Connection Failed

- Verify Supabase credentials are correct
- Check that schema was run successfully
- Ensure Row Level Security policies are active

### Cron Jobs Not Running

- Verify `vercel.json` is in the root directory
- Check Vercel project settings → Cron Jobs
- For free tier, use external cron service

### Telegram Webhook Not Working

- Verify bot token is correct
- Check that you've started a chat with your bot
- Ensure webhook URL is accessible (test with `curl`)

---

## Monitoring

### Vercel Logs

1. Go to Vercel dashboard
2. Click on your project
3. Navigate to "Logs" tab
4. Filter by function (e.g., `/api/cron`)

### Supabase Logs

1. Go to Supabase dashboard
2. Navigate to "Logs" → "Postgres Logs"
3. Check for any database errors

---

## Updating Your App

### Make Changes Locally

```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push
```

### Auto-Deploy

Vercel automatically deploys when you push to your main branch.

---

## Cost Estimate

- **Supabase:** Free tier (up to 500MB database)
- **Clerk:** Free tier (up to 10,000 monthly active users)
- **Vercel:** Free tier (hobby projects) or $20/month (Pro with Cron)
- **External Cron:** Free (if using cron-job.org)

**Total:** $0-20/month depending on your needs

---

## Security Notes

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **Keep service role key secret** - Only use server-side
3. **Use environment variables** - Never hardcode credentials
4. **Enable RLS in Supabase** - Already configured in schema
5. **Rotate keys if compromised** - Both Clerk and Supabase allow this

---

## Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check Supabase database logs
3. Verify all environment variables are set correctly
4. Test API endpoints individually
5. Check Telegram bot token and chat ID

---

## Next Steps

Once deployed:

1. Set up custom domain (optional)
2. Configure email notifications (optional)
3. Add analytics (Vercel Analytics)
4. Monitor usage and costs
5. Scale as needed

Enjoy your automated Notion → Telegram bot!
