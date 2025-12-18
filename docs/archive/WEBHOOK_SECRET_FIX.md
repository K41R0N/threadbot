# Telegram Webhook Secret Token Fix

**Created**: 2025-11-17
**Issue**: "ETELEGRAM: 400 Bad Request: secret token contains unallowed characters"

---

## **Problem**

Your `TELEGRAM_WEBHOOK_SECRET` environment variable contains characters that Telegram API doesn't allow.

**Error Message:**
```
Failed to set webhook: ETELEGRAM: 400 Bad Request: secret token contains unallowed characters
```

**Location:**
- `server/routers.ts:215` - reads `process.env.TELEGRAM_WEBHOOK_SECRET`
- `server/services/telegram.ts:69` - sends to Telegram API

---

## **Telegram API Requirements**

According to [Telegram Bot API documentation](https://core.telegram.org/bots/api#setwebhook):

**`secret_token` parameter:**
- **Length**: 1-256 characters
- **Allowed characters**: `A-Z`, `a-z`, `0-9`, `_` (underscore), `-` (hyphen)
- **NOT allowed**: Spaces, special characters (`!@#$%^&*()+={}[]|:;"'<>,.?/~\`)

---

## **Quick Fix**

### **Step 1: Generate Valid Secret Token**

Use one of these methods to generate a valid token:

#### **Method 1: Random alphanumeric (recommended)**
```bash
# Generate 64-character token (letters, numbers, underscores, hyphens)
openssl rand -base64 48 | tr '+/' '_-' | head -c 64
```

**Example output:**
```
Xj9kL2mP4nQ7rT8sW1vY5zB6cD3fG0hJ9kL2mP4nQ7rT8sW1vY5zB6cD3fG0hJ
```

#### **Method 2: Using Node.js**
```javascript
// Generate 64-character token
const crypto = require('crypto');
const token = crypto.randomBytes(48)
  .toString('base64')
  .replace(/\+/g, '_')
  .replace(/\//g, '-')
  .replace(/=/g, '')
  .substring(0, 64);
console.log(token);
```

#### **Method 3: Manual (for testing)**
```
threadbot_webhook_secret_2025_production_v1
```

---

### **Step 2: Update Environment Variable**

#### **In Vercel Dashboard:**

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Find `TELEGRAM_WEBHOOK_SECRET`

3. Click **Edit** or **Delete** + **Add New**

4. Set the new value (generated from Step 1)

5. **Important**: Select which environments to apply:
   - ✅ Production
   - ✅ Preview (optional)
   - ✅ Development (optional)

6. Click **Save**

7. **Redeploy** your application:
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on latest deployment
   - Click **Redeploy**

---

### **Step 3: Verify Secret Token**

After redeploying, test the webhook setup:

#### **Method 1: Use Settings Test Button**

1. Go to `/settings` page
2. Scroll to "Telegram Configuration"
3. Click **🧪 TEST NOW** button
4. Check logs for webhook errors

**Expected logs:**
```
✅ Bot config found
✅ Telegram token: bot123...
✅ Chat ID: 1234567890
📊 Bot active: Yes
📡 Prompt source: agent
✅ Message sent successfully!
```

#### **Method 2: Check Webhook Manually**

Use Telegram API to verify webhook is set correctly:

```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

Replace `<YOUR_BOT_TOKEN>` with your actual bot token from Settings.

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://threadbot.dev/api/webhook/YOUR_USER_ID",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null,
    "max_connections": 40
  }
}
```

**If webhook setup failed:**
```json
{
  "ok": true,
  "result": {
    "url": "",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_message": "Wrong secret token",
    "last_error_date": 1700000000,
    "max_connections": 40
  }
}
```

---

## **Code Validation (Recommended)**

To prevent this issue in the future, the code should validate the secret token format before sending to Telegram. The fix has been applied to `server/services/telegram.ts`.

---

## **Common Invalid Tokens**

These are **NOT ALLOWED**:

❌ `my-secret-token!@#` (special characters)
❌ `webhook secret 2025` (spaces)
❌ `token+base64==` (plus sign and equals)
❌ (empty string)
❌ (token longer than 256 characters)

These **ARE ALLOWED**:

✅ `webhook_secret_2025`
✅ `Xj9kL2mP4nQ7rT8sW1vY5zB6cD3fG0hJ`
✅ `threadbot-webhook-v1`
✅ `ABC123_def456-GHI789`

---

## **Security Best Practices**

1. **Use long random tokens** (32-64 characters minimum)
2. **Never commit secrets** to git (use `.env` files in `.gitignore`)
3. **Use different tokens** for production vs development
4. **Rotate tokens periodically** (every 6-12 months)
5. **Store in environment variables** (Vercel, not in code)

---

## **Troubleshooting**

### **Still Getting "unallowed characters" Error**

1. **Check for hidden characters:**
   ```bash
   # In your terminal, check the actual value
   echo "$TELEGRAM_WEBHOOK_SECRET" | xxd
   ```

2. **Regenerate token** using Method 1 above

3. **Clear Vercel cache:**
   - Delete the old environment variable
   - Create a new one with a fresh token
   - Redeploy

### **Webhook Not Updating**

If you updated the token but webhook still shows old error:

1. **Delete webhook first:**
   ```bash
   curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
   ```

2. **Wait 30 seconds**

3. **Trigger webhook setup again** via Settings → Save Changes

---

**Last Updated**: 2025-11-17
**Status**: Fix Required
