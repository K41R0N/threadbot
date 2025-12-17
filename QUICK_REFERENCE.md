# Quick Reference Guide

## For Developers Continuing Work

This is a quick reference guide for common tasks and recent changes. For detailed documentation, see the full changelog and other docs.

---

## 🎨 Calendar UI Components

### Using the Calendar Component

```typescript
import { PromptCalendar } from '@/components/calendar/prompt-calendar';
import { PromptEditPanel } from '@/components/calendar/prompt-edit-panel';

// Basic usage
<PromptCalendar
  prompts={prompts as UserPrompt[]}
  startDate="2025-11-01"
  endDate="2025-12-01"
  onDayClick={(date, prompts) => {
    // Handle day click
    setSelectedDate(date);
    setSelectedPrompts(prompts);
    setIsPanelOpen(true);
  }}
/>

// Side panel
<PromptEditPanel
  date={selectedDate}
  prompts={selectedPrompts}
  isOpen={isPanelOpen}
  onClose={() => setIsPanelOpen(false)}
  onSave={(id, promptTexts) => {
    updatePrompt.mutate({ id, prompts: promptTexts });
  }}
  onDelete={(id) => {
    deletePrompt.mutate({ id });
  }}
/>
```

### Key Props

**PromptCalendar:**
- `prompts`: Array of `UserPrompt` objects
- `startDate`: ISO date string (YYYY-MM-DD)
- `endDate`: ISO date string (YYYY-MM-DD)
- `onDayClick`: Callback when day is clicked

**PromptEditPanel:**
- `date`: ISO date string
- `prompts`: Array of prompts for that date
- `isOpen`: Boolean visibility state
- `onClose`: Close handler
- `onSave`: Save handler (id, promptTexts[])
- `onDelete`: Delete handler (id)

---

## 📊 Dashboard Database Structure

### AgentDatabase Interface

```typescript
interface AgentDatabase {
  monthKey: string;           // For backward compatibility
  name: string;               // Display name (e.g., "Nov - Dec 2025")
  promptCount: number;
  morningCount: number;
  eveningCount: number;
  createdAt: string | undefined;
  status: 'active' | 'connected' | 'inactive';
  startDate: string;          // NEW: ISO date string
  endDate: string;            // NEW: ISO date string
}
```

### Date Range Grouping Logic

```typescript
// Groups prompts by continuous date ranges
// If gap > 2 days, starts new range
// Handles month boundaries correctly

const agentDatabases = (() => {
  const sortedPrompts = [...prompts].sort((a, b) => a.date.localeCompare(b.date));
  // ... grouping logic
})();
```

### Routing

**Old Route (deprecated):**
```typescript
router.push(`/agent/database/${monthKey}`)
// Example: /agent/database/2025-11
```

**New Route (current):**
```typescript
router.push(`/agent/database/range/${startDate}/${endDate}`)
// Example: /agent/database/range/2025-11-10/2025-12-09
```

---

## 🔒 Security: CRON Endpoint

### Authentication Logic

```typescript
// SECURE: Always validate explicitly
let secretMatches = false;
if (providedSecret && cronSecret) {
  secretMatches = providedSecret === cronSecret;
} else if (providedSecret && !cronSecret) {
  // Deny if secret provided but CRON_SECRET not configured
  secretMatches = false;
}

// Allow if: Vercel Cron OR (secret provided AND matches)
if (!isVercelCron && !secretMatches) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Access Rules

1. ✅ `x-vercel-cron: 1` header (from Vercel)
2. ✅ Secret provided AND matches `CRON_SECRET`
3. ❌ Otherwise: Denied

**Never:**
- Default `secretMatches` to `true`
- Allow access when `CRON_SECRET` not configured and secret provided

---

## 📱 Telegram Modal Logic

### Connection Modal

```typescript
// Show ONLY when Telegram not connected
if (isFreshGeneration && !botConfig?.telegram_chat_id) {
  setShowTelegramModal(true);
}
```

### Activation Banner

```typescript
// Show when connected but inactive
{botConfig?.telegram_chat_id && !botConfig?.is_active && (
  <div>Activate bot banner</div>
)}
```

**Rule:** Modal = Connect, Banner = Activate

---

## 🗂 File Structure

### New Components
```
components/
  calendar/
    prompt-calendar.tsx      # Calendar grid view
    prompt-edit-panel.tsx     # Side edit panel
```

### Modified Pages
```
app/
  agent/
    database/
      range/
        [startDate]/
          [endDate]/
            page.tsx          # Calendar view integration
  dashboard/
    page.tsx                  # Date range grouping
  api/
    cron/
      route.ts                # Security fix
```

---

## 🐛 Common Issues & Solutions

### Issue: Calendar not showing prompts
**Solution:** Ensure `prompts` array is properly typed as `UserPrompt[]`

### Issue: Side panel not opening
**Solution:** Check `isPanelOpen` state and `onDayClick` handler

### Issue: Dashboard showing wrong date ranges
**Solution:** Verify date range grouping logic handles gaps correctly

### Issue: CRON endpoint allowing unauthorized access
**Solution:** Ensure `secretMatches` never defaults to `true`

### Issue: Telegram modal showing when bot inactive
**Solution:** Check condition - should only check `!telegram_chat_id`

---

## 📚 Documentation Files

- `CHANGELOG_2025-01.md` - Complete changelog
- `CALENDAR_UI_UPDATE.md` - Calendar UI details
- `TELEGRAM_BOT_SETUP.md` - Telegram setup
- `SUPABASE_MIGRATION_GUIDE.md` - Database migrations
- `CRON_FIX_SUMMARY.md` - CRON documentation

---

## 🔄 Migration Checklist

When updating code:

1. ✅ Replace month-based routing with date range routing
2. ✅ Update `AgentDatabase` interface to include `startDate` and `endDate`
3. ✅ Remove progress indicators from dashboard
4. ✅ Use calendar components instead of table views
5. ✅ Fix CRON authentication logic
6. ✅ Fix Telegram modal conditions
7. ✅ Ensure LICENSE file is tracked

---

**Last Updated:** January 2025

