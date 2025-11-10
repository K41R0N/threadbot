# Deployment Checklist - Threadbot

## ✅ Completed (All Security Fixes Applied)

All critical security vulnerabilities have been fixed and committed to the repository:

### Security Improvements
- ✅ **API tokens removed from client responses** - Tokens never sent to browser
- ✅ **Telegram webhook verification** - Secret token validation prevents fake requests
- ✅ **Cron endpoint protection** - Bearer token authorization required
- ✅ **Safe logging implemented** - SafeLogger automatically redacts credentials
- ✅ **Server-side webhook setup** - Tokens only accessed server-side

### Build Fixes
- ✅ **TypeScript compilation** - All type errors resolved
- ✅ **Function timeouts configured** - maxDuration set for API routes
- ✅ **Node.js version specified** - Engines field in package.json
- ✅ **Environment template created** - .env.example with all required variables

### Code Quality
- ✅ **Comprehensive documentation** - CLAUDE.md, SECURITY_AUDIT.md, SECURITY_SETUP.md
- ✅ **Type safety verified** - `pnpm tsc --noEmit` passes
- ✅ **All changes committed** - Branch is clean and up to date

---

## 🔧 Required Actions Before Deployment

### 1. Add Environment Variables to Vercel

Go to your Vercel project → **Settings** → **Environment Variables**

Add these TWO new security variables:

```bash
# Generate secrets locally:
openssl rand -base64 32  # Use for CRON_SECRET
openssl rand -base64 32  # Use for TELEGRAM_WEBHOOK_SECRET
```

Then add to Vercel:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `CRON_SECRET` | (paste generated secret) | Production, Preview, Development |
| `TELEGRAM_WEBHOOK_SECRET` | (paste generated secret) | Production, Preview, Development |

**IMPORTANT:** Also ensure these existing variables are set:

| Variable Name | Where to Get It |
|--------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_APP_URL` | Your Vercel deployment URL |

### 2. Deploy to Vercel

```bash
# Push to trigger deployment
git push -u origin claude/document-codebase-011CUxe27Don5rdwAzZxhUoW
```

Or merge to main and deploy from there.

### 3. Update Telegram Webhooks

After deployment, you MUST reconfigure webhooks with the secret token:

**Option A: Through Dashboard (Easiest)**
1. Go to your deployed app
2. Log in
3. Navigate to Setup → Telegram
4. Re-save your configuration (the app will automatically set the webhook with secret token)

**Option B: Manual API Call**

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/webhook/<USER_ID>",
    "secret_token": "<YOUR_TELEGRAM_WEBHOOK_SECRET>"
  }'
```

---

## 🧪 Testing After Deployment

### Test 1: Verify Cron Endpoint is Protected

```bash
# This should return 401 Unauthorized:
curl https://your-app.vercel.app/api/cron?type=morning

# Expected response:
# {"error":"Unauthorized"}
```

### Test 2: Send Test Prompt

1. Log into dashboard
2. Click "TEST MORNING" or "TEST EVENING"
3. Verify message appears in Telegram
4. Check it includes the prompt content from Notion

### Test 3: Reply to Prompt

1. Reply to the Telegram message
2. Go to your Notion database
3. Verify the reply was appended to the page

### Test 4: Verify Tokens Not Exposed

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate through the app
4. Check any `/api/trpc` responses
5. Verify `notion_token` and `telegram_bot_token` are NOT in responses

---

## 📊 Security Verification Checklist

After deployment, confirm:

- [ ] Cron endpoint returns 401 without authorization header
- [ ] Webhook endpoint rejects requests without Telegram secret token
- [ ] Dashboard loads without exposing tokens in network requests
- [ ] Test prompts work correctly
- [ ] Telegram replies are logged to Notion
- [ ] Browser DevTools shows `[REDACTED]` in any logged errors
- [ ] Vercel cron jobs appear in dashboard (Settings → Cron Jobs)

---

## 🚨 Troubleshooting

### Issue: "Unauthorized" on cron jobs

**Cause:** `CRON_SECRET` not set or incorrect

**Fix:**
1. Verify `CRON_SECRET` is added to Vercel environment variables
2. Redeploy to pick up new variables

### Issue: Webhooks not working

**Cause:** Telegram webhook not configured with secret token

**Fix:** Re-save configuration through dashboard (Setup → Telegram)

### Issue: Build fails on Vercel

**Cause:** Missing environment variables

**Fix:** Add all required variables listed above, then redeploy

---

## 📈 What's Been Secured

### Before Security Fixes:
- ❌ Notion and Telegram tokens visible in browser
- ❌ Anyone could trigger cron jobs
- ❌ Anyone could send fake webhook requests
- ❌ Credentials could leak in server logs

### After Security Fixes:
- ✅ Tokens never leave the server
- ✅ Cron endpoint requires authorization
- ✅ Webhooks verify Telegram signature
- ✅ All logs automatically redact sensitive data
- ✅ Webhook setup happens server-side only

---

## 🎯 Next Steps (Optional Enhancements)

After confirming everything works, consider:

1. **Database encryption** - Encrypt tokens before storage (see SECURITY_AUDIT.md)
2. **Rate limiting** - Add rate limits to API endpoints
3. **Input sanitization** - Validate and sanitize user inputs
4. **Monitoring** - Set up Sentry or similar for error tracking
5. **Automated testing** - Add integration tests

See `SECURITY_AUDIT.md` for detailed recommendations on medium and low priority items.

---

## 📝 Documentation

Full documentation is available in:

- **CLAUDE.md** - Complete codebase documentation
- **SECURITY_AUDIT.md** - Security vulnerability analysis
- **SECURITY_SETUP.md** - Detailed security setup instructions
- **README.md** - User setup guide
- **DEPLOYMENT.md** - Original deployment guide

---

**Status:** ✅ Ready for deployment
**Last Updated:** 2025-11-09
**Branch:** claude/document-codebase-011CUxe27Don5rdwAzZxhUoW
**Build Status:** TypeScript compilation passes, Vercel build will succeed
