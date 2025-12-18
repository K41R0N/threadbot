# Calendar UI Update

## Overview

Reworked the prompt database UI from a table view to a calendar view (similar to Sprout Social), with a side panel for editing prompts. This fixes the issue where prompts spanning months showed incomplete percentages.

---

## Changes Made

### 1. New Calendar Component (`components/calendar/prompt-calendar.tsx`)

**Features:**
- Monthly calendar grid view
- Shows prompts as colored badges on each day
  - 🌅 Yellow badges for morning prompts
  - 🌆 Blue badges for evening prompts
- Month navigation (previous/next/today)
- Highlights today's date
- Only shows prompts within the date range
- Clickable days with prompts open the edit panel

**Visual Design:**
- Black borders matching app aesthetic
- Responsive grid layout
- Hover effects on clickable days
- Grayed out dates outside the prompt range

### 2. Side Edit Panel (`components/calendar/prompt-edit-panel.tsx`)

**Features:**
- Slides in from the right when clicking a calendar day
- Shows all prompts for the selected date (morning + evening)
- Edit prompts inline with textarea inputs
- Delete individual prompts
- Shows week theme and post type badges
- Displays user responses if they exist
- Overlay backdrop when open

**UX:**
- Click outside or X button to close
- Individual prompt editing (not all at once)
- Save/Cancel buttons for each prompt
- Clean, focused editing experience

### 3. Updated Database Range Page

**Changes:**
- Replaced table view with calendar view
- Removed inline editing from table rows
- Added side panel integration
- Maintained all existing functionality (export CSV, stats, etc.)

**Route:** `/agent/database/range/[startDate]/[endDate]`

### 4. Updated Dashboard (`app/dashboard/page.tsx`)

**Key Changes:**
- **Removed progress indicator** - No more "X of 60 prompts" that made spanning databases look incomplete
- **Date range grouping** - Groups prompts by continuous date ranges instead of just months
- **Smart date range detection** - Detects when prompts span multiple months and groups them together
- **Updated routing** - Routes to calendar view (`/agent/database/range/[startDate]/[endDate]`) instead of month view
- **Better naming** - Shows date ranges like "Nov - Dec 2025" for spanning databases

**Before:**
- Grouped by month only
- Showed "42 of 60 prompts" (incomplete)
- Progress bar showing 70%
- Route: `/agent/database/2025-11`

**After:**
- Groups by continuous date ranges
- Shows "42 prompts • 21 morning • 21 evening • Nov 10 - Dec 9"
- No progress indicator (no false "incomplete" status)
- Route: `/agent/database/range/2025-11-10/2025-12-09`

---

## User Flow

### Viewing Prompts
1. User clicks on a database from dashboard
2. Calendar view opens showing the month(s) containing prompts
3. Prompts appear as colored badges on each day
4. User can navigate between months using arrows

### Editing Prompts
1. User clicks on a day with prompts
2. Side panel slides in from the right
3. Shows all prompts for that day (morning + evening)
4. User clicks "EDIT PROMPTS" on a specific prompt
5. Textareas appear for editing
6. User clicks "SAVE" or "CANCEL"
7. Panel stays open for editing other prompts on the same day

### Closing Panel
- Click X button in header
- Click outside panel (on overlay)
- Panel closes and returns to calendar view

---

## Technical Details

### Calendar Component Logic

**Date Range Handling:**
- Only shows prompts within `startDate` and `endDate`
- Dates outside range are grayed out and non-clickable
- Calendar shows full months (including days before/after range)

**Month Navigation:**
- Starts at the month containing `startDate`
- Can navigate to any month
- "TODAY" button jumps to current month

**Prompt Display:**
- Groups prompts by date
- Shows count: "X prompts"
- Color-coded by type (morning/evening)
- Truncated tooltip on hover

### Side Panel Logic

**State Management:**
- Tracks which prompt is being edited (`editingId`)
- Maintains editing state per prompt (`editingPrompts`)
- Resets on panel close/open

**Editing Flow:**
- Click "EDIT PROMPTS" → Enter edit mode for that prompt
- Modify textareas → Changes stored in state
- Click "SAVE" → Calls `onSave` mutation
- Click "CANCEL" → Resets to original values

---

## Benefits

### ✅ Fixed Issues
1. **No more false "incomplete" status** - Removed progress indicator that showed incomplete when prompts spanned months
2. **Better date range handling** - Properly groups prompts that cross month boundaries
3. **Cleaner UI** - Calendar view is more intuitive than table view

### ✅ Improved UX
1. **Visual calendar** - See all prompts at a glance
2. **Focused editing** - Side panel provides distraction-free editing
3. **Better navigation** - Easy month navigation
4. **Responsive** - Works on mobile and desktop

### ✅ Maintained Features
- Export CSV still works
- Stats display still shows
- Telegram connection banners still appear
- All existing functionality preserved

---

## Files Created/Modified

### New Files
- `components/calendar/prompt-calendar.tsx` - Calendar component
- `components/calendar/prompt-edit-panel.tsx` - Side edit panel

### Modified Files
- `app/agent/database/range/[startDate]/[endDate]/page.tsx` - Replaced table with calendar
- `app/dashboard/page.tsx` - Updated database grouping and routing

---

## Future Enhancements (Optional)

1. **Week/List View Toggle** - Add view switcher like Sprout Social
2. **Bulk Editing** - Select multiple days to edit
3. **Drag & Drop** - Move prompts between days
4. **Filtering** - Filter by week theme, post type
5. **Search** - Search prompts by content
6. **Keyboard Shortcuts** - Arrow keys for navigation, Escape to close panel

---

**Status:** ✅ Complete - Ready for Testing

---

## Related Documentation

- `CHANGELOG_2025-01.md` - Complete changelog of all changes in this batch
- `TELEGRAM_BOT_SETUP.md` - Telegram bot setup guide
- `SUPABASE_MIGRATION_GUIDE.md` - Database migration guide

