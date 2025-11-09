# Threadbot Security Audit Report

**Date:** 2025-11-09
**Status:** Production Deployment
**Auditor:** Comprehensive Security Review

---

## Executive Summary

This security audit identifies **9 security issues** across the Threadbot application, ranging from **Critical** to **Informational** severity. The most critical findings involve sensitive credential exposure to the client-side, lack of webhook verification, and plaintext credential storage.

### Severity Breakdown

- 🔴 **Critical (5)**: Immediate action required
- 🟡 **Medium (2)**: Should be addressed soon
- 🔵 **Low (2)**: Enhancement recommendations

---

## Critical Issues 🔴

### 1. Sensitive Credentials Exposed to Client-Side

**Severity:** 🔴 CRITICAL
**Location:** `server/routers.ts` (lines 10-24), `app/dashboard/page.tsx` (lines 133-142)

**Issue:**

The `bot.getConfig` tRPC procedure returns the ENTIRE `bot_configs` row to the client, including:
- `notion_token` (full Notion API key)
- `telegram_bot_token` (full Telegram bot token)
- `notion_database_id`
- `telegram_chat_id`

These sensitive credentials are:
1. Sent over the network to the browser
2. Stored in React Query cache
3. Visible in browser DevTools
4. Accessible via JavaScript in the browser

**Attack Vector:**
- XSS vulnerability in any dependency could steal these tokens
- Browser extensions could read tokens from memory
- Malicious user could extract their own tokens and abuse them elsewhere

**Evidence:**

```typescript
// server/routers.ts:10-23
getConfig: protectedProcedure.query(async ({ ctx }) => {
  const { data, error } = await supabase
    .from('bot_configs')
    .select('*')  // ← Returns ALL columns including tokens
    .eq('user_id', ctx.userId)
    .single();

  return data;  // ← Tokens sent to client
});
```

```tsx
// app/dashboard/page.tsx:133-135
<p className="font-mono text-sm bg-gray-100 p-3 break-all">
  {config.notion_database_id}  // ← Visible in DOM
</p>
```

**Recommendation:**

**Option 1: Exclude tokens from client response (Recommended)**

```typescript
getConfig: protectedProcedure.query(async ({ ctx }) => {
  const { data, error } = await supabase
    .from('bot_configs')
    .select('id, user_id, notion_database_id, telegram_chat_id, timezone, morning_time, evening_time, is_active, created_at, updated_at')
    .eq('user_id', ctx.userId)
    .single();

  return data;
});
```

**Option 2: Create separate procedures for sensitive operations**

```typescript
// Return safe config for display
getSafeConfig: protectedProcedure.query(async ({ ctx }) => {
  // Only return non-sensitive fields
});

// Use internally only
getFullConfig: async (userId: string) => {
  // Server-side only, never exposed to client
};
```

**Impact:** HIGH - Tokens could be stolen and used to access user's Notion workspace and control their Telegram bot

---

### 2. No Telegram Webhook Signature Verification

**Severity:** 🔴 CRITICAL
**Location:** `app/api/webhook/[userId]/route.ts` (lines 8-55)

**Issue:**

The Telegram webhook endpoint accepts ANY POST request without verifying it came from Telegram. Anyone who knows a user's Clerk `userId` can:
- Send fake messages to the webhook
- Inject malicious content into Notion
- Spam the bot with fake replies
- Trigger rate limits

**Attack Vector:**

```bash
# Attacker can send fake telegram messages
curl -X POST https://yourapp.vercel.app/api/webhook/user_KNOWN_ID \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "MALICIOUS CONTENT", "chat": {"id": "123456789"}}}'
```

**Current Code:**

```typescript
// app/api/webhook/[userId]/route.ts
export async function POST(request: NextRequest, { params }: ...) {
  const update = await request.json();  // ← No verification!
  // Process message...
}
```

**Recommendation:**

**Option 1: Use Telegram's Secret Token (Recommended for Telegram Bot API)**

When setting up the webhook, Telegram allows you to provide a secret token that's sent with each request:

```typescript
// server/services/telegram.ts
async setWebhook(webhookUrl: string, secretToken: string): Promise<boolean> {
  return await this.bot.setWebHook(webhookUrl, {
    secret_token: secretToken  // Telegram sends this in X-Telegram-Bot-Api-Secret-Token header
  });
}

// app/api/webhook/[userId]/route.ts
export async function POST(request: NextRequest, { params }: ...) {
  const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!secretToken || secretToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process webhook...
}
```

**Option 2: Verify the request came from Telegram IP ranges**

```typescript
const TELEGRAM_IP_RANGES = [
  '149.154.160.0/20',
  '91.108.4.0/22',
  // Add all Telegram IP ranges
];

// Verify request.headers.get('x-forwarded-for') is in allowed range
```

**Option 3: Store and verify per-user webhook secrets**

- Generate unique secret per user
- Store in `bot_configs` table
- Include in webhook URL or verify from request headers

**Impact:** HIGH - Anyone can inject fake messages into users' Notion databases

---

### 3. Credentials Stored in Plaintext

**Severity:** 🔴 CRITICAL
**Location:** `supabase/schema.sql` (lines 7-9), `server/routers.ts` (lines 62-64)

**Issue:**

Sensitive credentials are stored in plaintext in the database:
- `notion_token` - Full access to user's Notion workspace
- `telegram_bot_token` - Full control of user's Telegram bot

**Risk:**
- Database breach exposes all user credentials
- Supabase admin access = all tokens compromised
- Service role key leak = instant access to all tokens
- Database backups contain plaintext credentials

**Current Schema:**

```sql
CREATE TABLE bot_configs (
  notion_token TEXT NOT NULL,           -- ← Plaintext!
  telegram_bot_token TEXT NOT NULL,     -- ← Plaintext!
  -- ...
);
```

**Recommendation:**

**Option 1: Encrypt at application level (Recommended)**

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8');
}

// Use when storing
const encryptedToken = encrypt(input.notionToken);
await supabase.from('bot_configs').insert({ notion_token: encryptedToken });

// Use when retrieving
const decryptedToken = decrypt(config.notion_token);
```

**Option 2: Use Supabase Vault (pg_crypto)**

```sql
-- Use Supabase's built-in encryption
ALTER TABLE bot_configs
  ALTER COLUMN notion_token TYPE TEXT
  USING pgp_sym_encrypt(notion_token, 'encryption_key');
```

**Option 3: External secrets management**

- Store credentials in AWS Secrets Manager, Google Secret Manager, or HashiCorp Vault
- Only store secret IDs in database
- Retrieve secrets at runtime

**Impact:** HIGH - Database breach or insider access exposes all user credentials

---

### 4. Public Cron Endpoint

**Severity:** 🔴 CRITICAL
**Location:** `app/api/cron/route.ts` (entire file)

**Issue:**

The cron endpoint is publicly accessible without authentication. Anyone can:
- Trigger prompt sending at any time
- Cause excessive API usage (Notion + Telegram)
- Trigger rate limits on third-party APIs
- Increase costs by repeatedly calling the endpoint

**Current Code:**

```typescript
// app/api/cron/route.ts:8
export async function GET(request: NextRequest) {
  // No authentication check!
  // Process all active bots...
}
```

**Attack Vector:**

```bash
# Anyone can trigger cron job
while true; do
  curl https://yourapp.vercel.app/api/cron?type=morning
  curl https://yourapp.vercel.app/api/cron?type=evening
  sleep 1
done
```

**Recommendation:**

**Option 1: Vercel Cron Secret (Recommended)**

```typescript
// app/api/cron/route.ts
export async function GET(request: NextRequest) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Continue processing...
}
```

In Vercel, set environment variable:
```
CRON_SECRET=your-random-secret-here
```

Configure vercel.json:
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

Vercel automatically adds `Authorization: Bearer <secret>` header when configured.

**Option 2: IP Allowlist**

```typescript
const VERCEL_CRON_IP_RANGES = ['76.76.21.0/24', '...'];
const clientIP = request.headers.get('x-forwarded-for');

if (!isIPInRange(clientIP, VERCEL_CRON_IP_RANGES)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Impact:** HIGH - Abuse could cause significant cost increase and service degradation

---

### 5. Sensitive Data in Logs

**Severity:** 🔴 CRITICAL
**Location:** Multiple files (see Grep results)

**Issue:**

Console.log statements throughout the codebase may log sensitive information to Vercel logs, which are:
- Stored for 7 days (Hobby) to indefinitely (Enterprise)
- Accessible to all team members
- May be sent to external logging services
- May include full error objects with sensitive data

**Examples:**

```typescript
// app/api/webhook/[userId]/route.ts:39
console.log('Chat ID mismatch:', message.chat.id, config.telegram_chat_id);
// ← Logs chat IDs

// app/api/cron/route.ts:63
console.error('Cron job error:', error);
// ← May log full config objects with tokens in error.context

// server/services/bot.ts:69
console.error('Send prompt error:', error);
// ← May log Notion tokens if error contains config
```

**Risk:**
- Vercel logs may contain plaintext tokens
- Third-party monitoring tools see sensitive data
- Log exports expose credentials
- Error tracking services (Sentry, etc.) receive tokens

**Recommendation:**

**Create a safe logging utility:**

```typescript
// lib/logger.ts
export class SafeLogger {
  private static sanitize(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    const sanitized = { ...obj };
    const SENSITIVE_KEYS = [
      'notion_token',
      'telegram_bot_token',
      'token',
      'password',
      'secret',
      'key',
      'auth'
    ];

    for (const key in sanitized) {
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }

  static log(message: string, data?: any) {
    console.log(message, data ? this.sanitize(data) : '');
  }

  static error(message: string, error: any) {
    console.error(message, this.sanitize(error));
  }
}

// Usage
SafeLogger.error('Failed to send prompt:', error);
// Logs: 'Failed to send prompt: { notion_token: '[REDACTED]', message: 'API Error' }'
```

**Impact:** HIGH - Credentials leaked in logs could be harvested by attackers

---

## Medium Severity Issues 🟡

### 6. No Rate Limiting

**Severity:** 🟡 MEDIUM
**Location:** All API routes

**Issue:**

No rate limiting on any endpoints allows:
- Brute force attacks on webhook endpoints
- API abuse
- Cost increase from excessive API calls
- Potential DoS of third-party services (Notion, Telegram)

**Attack Scenarios:**
- Spam test prompt button → excessive Notion/Telegram API calls
- Rapidly toggle bot on/off → database thrashing
- Flood webhook endpoint → Notion API rate limits

**Recommendation:**

**Option 1: Vercel Edge Config Rate Limiting**

```typescript
// middleware.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function middleware(request: NextRequest) {
  // Apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
  }

  // Continue with Clerk auth...
}
```

**Option 2: Per-user rate limiting in tRPC**

```typescript
// server/trpc.ts
const rateLimitProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const userId = ctx.userId;
  const key = `ratelimit:${userId}`;

  // Check rate limit for this user
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  if (count > 10) { // 10 requests per minute
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS' });
  }

  return next();
});
```

**Impact:** MEDIUM - Could lead to unexpected costs and service degradation

---

### 7. No Input Sanitization

**Severity:** 🟡 MEDIUM
**Location:** `server/services/bot.ts:102`, `server/services/notion.ts:91-111`

**Issue:**

User replies from Telegram are sent directly to Notion without sanitization. While Notion's API should handle this, potential risks include:
- Injection attacks if Notion has vulnerabilities
- Malformed content causing API errors
- Excessively long messages causing issues
- Special characters breaking formatting

**Current Code:**

```typescript
// server/services/bot.ts:102
await notion.appendReply(state.last_prompt_page_id, replyText);
// ← No sanitization of replyText

// server/services/notion.ts:104
text: {
  content: `Reply: ${reply}`,  // ← Direct concatenation
}
```

**Recommendation:**

```typescript
// lib/sanitize.ts
export function sanitizeUserInput(text: string): string {
  return text
    .substring(0, 10000)  // Max length
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Remove control chars
    .trim();
}

// server/services/bot.ts
const sanitizedReply = sanitizeUserInput(replyText);
await notion.appendReply(state.last_prompt_page_id, sanitizedReply);
```

**Impact:** MEDIUM - Could cause API errors or unexpected behavior

---

## Low Severity Issues 🔵

### 8. Predictable User IDs in Webhook URLs

**Severity:** 🔵 LOW
**Location:** `app/api/webhook/[userId]/route.ts`

**Issue:**

Webhook URLs include the Clerk `userId` in the path:
```
/api/webhook/user_2abc123def456
```

While Clerk IDs are not sequential, they're not cryptographically random. If an attacker can:
1. Enumerate user IDs (e.g., from a leak or public endpoint)
2. Send crafted webhook requests

They could target specific users.

**Recommendation:**

**Option 1: Use webhook-specific secrets**

```typescript
// Generate unique webhook secret per user
const webhookSecret = crypto.randomBytes(32).toString('hex');

// Store in bot_configs
ALTER TABLE bot_configs ADD COLUMN webhook_secret TEXT;

// Webhook URL becomes:
/api/webhook/{webhookSecret}

// Look up user by secret instead of userId
```

**Option 2: Add signature verification (covered in Issue #2)**

**Impact:** LOW - Requires attacker to know user IDs and bypass chat ID verification

---

### 9. Error Messages May Leak Information

**Severity:** 🔵 LOW
**Location:** Multiple error handlers

**Issue:**

Some error messages return internal details:

```typescript
// server/routers.ts:20
throw new Error(`Failed to fetch bot config: ${error.message}`);
// ← May expose database error details

// app/api/cron/route.ts:65
return NextResponse.json({ error: error.message }, { status: 500 });
// ← Exposes error details to caller
```

**Recommendation:**

```typescript
// Generic errors for client
try {
  // operation
} catch (error) {
  logger.error('Internal error:', error);  // Log full error
  throw new Error('An error occurred');  // Generic message to client
}
```

**Impact:** LOW - May expose internal implementation details

---

## Security Best Practices Already Implemented ✅

1. ✅ **Environment Variables Properly Scoped**
   - `NEXT_PUBLIC_*` only for safe client-side values
   - Service keys kept server-side only

2. ✅ **Authentication Enforced**
   - Clerk authentication on all protected routes
   - tRPC `protectedProcedure` enforces userId check
   - Middleware blocks unauthenticated access

3. ✅ **Authorization in Database Queries**
   - All queries filter by `user_id === ctx.userId`
   - Users can only access their own data
   - No cross-user data leaks

4. ✅ **HTTPS Enforced**
   - Vercel automatically enforces HTTPS
   - All API communication encrypted in transit

5. ✅ **Webhook Chat ID Verification**
   - Verifies Telegram chat ID matches config
   - Prevents cross-user message injection

6. ✅ **SQL Injection Protected**
   - Using Supabase client with parameterized queries
   - No raw SQL with user input

7. ✅ **No Sensitive Data in URLs**
   - Tokens passed in request bodies, not query params
   - Configuration data sent via POST, not GET

---

## Priority Action Items

### Immediate (This Week) 🔴

1. **Remove tokens from client response**
   - Modify `bot.getConfig` to exclude `notion_token` and `telegram_bot_token`
   - Tokens should NEVER leave the server

2. **Add Telegram webhook verification**
   - Implement secret token verification
   - Reject unauthorized webhook requests

3. **Secure cron endpoint**
   - Add `CRON_SECRET` environment variable
   - Verify authorization header

4. **Implement safe logging**
   - Create `SafeLogger` utility
   - Replace all `console.log/error` with sanitized logging

### Short Term (This Month) 🟡

5. **Encrypt credentials in database**
   - Implement application-level encryption
   - Migrate existing tokens to encrypted format

6. **Add rate limiting**
   - Implement Upstash Redis rate limiting
   - Protect all API endpoints

7. **Sanitize user input**
   - Add input validation/sanitization
   - Protect against injection attacks

### Long Term (Next Quarter) 🔵

8. **Security headers**
   - Add CSP, HSTS, X-Frame-Options
   - Configure in `next.config.ts`

9. **Audit logging**
   - Log all security-relevant events
   - Monitor for suspicious activity

10. **Penetration testing**
    - Hire security firm for professional audit
    - Test for additional vulnerabilities

---

## Compliance Considerations

### GDPR (EU Users)

- ⚠️ Storing Telegram chat IDs = personal data
- ⚠️ Need privacy policy and data processing agreement
- ⚠️ Users must be able to export and delete their data

**Actions Required:**
- Add privacy policy
- Implement data export endpoint
- Implement account deletion workflow

### SOC 2 (If Applicable)

- ❌ Credentials not encrypted at rest
- ❌ No audit logging
- ❌ No access controls beyond authentication

---

## Security Testing Recommendations

### Automated Testing

1. **Dependency Scanning**
   ```bash
   npm audit
   pnpm audit
   ```

2. **Static Analysis**
   ```bash
   pnpm add -D eslint-plugin-security
   ```

3. **OWASP ZAP Scanning**
   - Run against deployed application
   - Check for common vulnerabilities

### Manual Testing

1. **Authentication Bypass**
   - Try accessing API routes without authentication
   - Try accessing other users' data

2. **Token Extraction**
   - Open browser DevTools
   - Check Network tab for tokens in responses
   - Check Application → Storage for cached data

3. **Webhook Spoofing**
   - Send fake webhook requests
   - Try different user IDs
   - Test with invalid signatures

---

## Incident Response Plan

### If Credentials Are Compromised

1. **Immediate Actions:**
   - Rotate all affected API keys (Notion, Telegram)
   - Revoke Supabase service role key and create new one
   - Reset CRON_SECRET
   - Notify affected users

2. **Investigation:**
   - Review Vercel logs for unauthorized access
   - Check Supabase audit logs
   - Identify scope of breach

3. **Remediation:**
   - Implement fixes for identified vulnerabilities
   - Deploy emergency patches
   - Monitor for continued abuse

4. **Communication:**
   - Notify affected users within 72 hours (GDPR requirement)
   - Provide guidance on securing their accounts
   - Offer to help reset their credentials

---

## Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **OWASP API Security Top 10:** https://owasp.org/www-project-api-security/
- **Telegram Bot Security:** https://core.telegram.org/bots/webhooks
- **Vercel Security:** https://vercel.com/docs/security
- **Supabase Security:** https://supabase.com/docs/guides/platform/security

---

## Conclusion

The Threadbot application has a solid foundation with proper authentication and authorization, but has **critical security vulnerabilities** that must be addressed before wider deployment:

1. **Credentials exposed to client** (Critical)
2. **No webhook verification** (Critical)
3. **Plaintext credential storage** (Critical)
4. **Unprotected cron endpoint** (Critical)
5. **Sensitive data in logs** (Critical)

These issues can be resolved with the recommended fixes. Once addressed, the application will have a strong security posture suitable for production use.

**Estimated remediation time:** 2-3 days for critical issues, 1 week for all high-priority items.

---

**Last Updated:** 2025-11-09
**Next Audit Recommended:** After implementing fixes (within 2 weeks)
