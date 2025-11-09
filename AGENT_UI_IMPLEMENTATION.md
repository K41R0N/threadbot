# Agentic Prompt Generation - Frontend Implementation Guide

## Overview

This document outlines the UI components needed to complete the agentic prompt generation feature. All backend (tRPC, AI services, database) is complete and ready.

## Design System

Follow the existing project design:
- **Font**: Bebas Neue for headings/labels (already configured)
- **Style**: Minimalist, black borders, bold text
- **Layout**: White background, 2px black borders, clean sections
- **Buttons**: Existing Button component from `components/ui/button.tsx`
- **Forms**: Existing Input component from `components/ui/input.tsx`

---

## Required Pages & Components

### 1. New Tab in Navigation

**File**: `app/layout.tsx` or dashboard header

Add "Agent" tab alongside existing tabs:

```tsx
<nav className="border-b-2 border-black">
  <div className="container mx-auto px-4">
    <div className="flex gap-8">
      <Link href="/dashboard" className="font-display">DASHBOARD</Link>
      <Link href="/settings" className="font-display">SETTINGS</Link>
      <Link href="/agent" className="font-display">AGENT</Link>
    </div>
  </div>
</nav>
```

---

### 2. Agent Landing Page

**File**: `app/agent/page.tsx`

**Purpose**: Entry point - show subscription tier and start wizard

**Layout**:
```
┌────────────────────────────────────────────┐
│  AGENTIC PROMPT GENERATION                 │
├────────────────────────────────────────────┤
│  Your Tier: FREE / PRO                     │
│                                            │
│  ┌────────────────┐  ┌──────────────────┐ │
│  │  DeepSeek R1   │  │  Claude Sonnet   │ │
│  │  (Free)        │  │  (Pro Only)      │ │
│  │                │  │  [UPGRADE] →     │ │
│  └────────────────┘  └──────────────────┘ │
│                                            │
│  [START NEW GENERATION] →                  │
│                                            │
│  Recent Jobs:                              │
│  - Nov 2025: 60 prompts (Completed)       │
│  - Oct 2025: 60 prompts (Completed)       │
└────────────────────────────────────────────┘
```

**Key Features**:
- Show current subscription tier
- Model comparison (DeepSeek vs Claude)
- Upgrade prompt for free users wanting Claude
- List recent generation jobs
- "Start New Generation" button → wizard

**tRPC Calls**:
```tsx
const { data: subscription } = trpc.agent.getSubscription.useQuery();
const { data: jobs } = trpc.agent.getJobStatus.useQuery();
```

---

### 3. Generation Wizard - Step 1: Context

**File**: `app/agent/generate/page.tsx` (with step state)

**Layout**:
```
┌────────────────────────────────────────────┐
│  STEP 1 OF 4: PROVIDE CONTEXT             │
├────────────────────────────────────────────┤
│                                            │
│  Brand URLs                                │
│  [https://yoursite.com           ] [+]     │
│  [https://yoursubstack.com       ] [×]     │
│                                            │
│  Competitor/Inspiration URLs               │
│  [https://competitor.com         ] [+]     │
│                                            │
│  Additional Context (optional)             │
│  [Text area: themes, voice, notes...]      │
│                                            │
│  [ANALYZE CONTEXT] →                       │
└────────────────────────────────────────────┘
```

**State Management**:
```tsx
const [brandUrls, setBrandUrls] = useState<string[]>([]);
const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);
const [additionalContext, setAdditionalContext] = useState('');

const analyzeContext = trpc.agent.analyzeContext.useMutation({
  onSuccess: (data) => {
    // Show analysis results
    setStep(2);
  }
});
```

**Features**:
- Dynamic URL input (add/remove)
- Validate URLs before submission
- Show loading state while analyzing
- Display analysis results before proceeding

---

### 4. Generation Wizard - Step 2: Review Analysis

**File**: Same as Step 1 (multi-step component)

**Layout**:
```
┌────────────────────────────────────────────┐
│  STEP 2 OF 4: REVIEW ANALYSIS             │
├────────────────────────────────────────────┤
│                                            │
│  Core Themes                               │
│  • Digital sovereignty                     │
│  • Creator economy                         │
│  • Platform power dynamics                 │
│  [Edit]                                    │
│                                            │
│  Brand Voice                               │
│  Critical but constructive, empowering...  │
│  [Edit]                                    │
│                                            │
│  Target Audience                           │
│  Independent creators, digital natives...  │
│  [Edit]                                    │
│                                            │
│  [← BACK]  [CONTINUE TO THEMES] →          │
└────────────────────────────────────────────┘
```

**Features**:
- Display AI-generated analysis
- Allow inline editing of each field
- Save edited context
- Proceed to theme generation

---

### 5. Generation Wizard - Step 3: Generate Themes

**File**: Same as above

**Layout**:
```
┌────────────────────────────────────────────┐
│  STEP 3 OF 4: WEEKLY THEMES               │
├────────────────────────────────────────────┤
│                                            │
│  Choose Your Model:                        │
│  ○ DeepSeek Chat (Free)                    │
│  ● Claude Sonnet 4.5 (Pro) [i]             │
│                                            │
│  Theme Preferences (optional):             │
│  [Text area: tone, focus areas...]         │
│                                            │
│  [GENERATE THEMES] →                       │
│                                            │
│  ─── OR ───                                │
│                                            │
│  Week 1: The Problem                       │
│  Identify core issues in creator economy   │
│  [Edit] [Regenerate]                       │
│                                            │
│  Week 2: The Consequences                  │
│  Explore platform extraction...            │
│  [Edit] [Regenerate]                       │
│                                            │
│  [... Weeks 3-4 ...]                       │
│                                            │
│  [← BACK]  [APPROVE THEMES] →              │
└────────────────────────────────────────────┘
```

**Key Features**:
- **Model Selection with Tier Check**:
  ```tsx
  const [useClaude, setUseClaude] = useState(false);

  const handleModelChange = (model: 'deepseek' | 'claude') => {
    if (model === 'claude' && subscription?.tier === 'free') {
      // Show upgrade modal
      setShowUpgradeModal(true);
    } else {
      setUseClaude(model === 'claude');
    }
  };
  ```

- **Upgrade Modal** (for free users selecting Claude):
  ```tsx
  <UpgradeModal>
    <h3>Upgrade to Pro for Claude Sonnet 4.5</h3>
    <ul>
      - Better theme generation
      - Higher quality prompts
      - More nuanced understanding
    </ul>
    <Button>Upgrade to Pro ($9/mo)</Button>
  </UpgradeModal>
  ```

- Editable themes
- Regenerate individual themes
- Approve before proceeding

---

### 6. Generation Wizard - Step 4: Generate Prompts

**File**: Same as above

**Layout**:
```
┌────────────────────────────────────────────┐
│  STEP 4 OF 4: GENERATE PROMPTS            │
├────────────────────────────────────────────┤
│                                            │
│  Date Range:                               │
│  Start: [2025-11-01] End: [2025-11-30]     │
│                                            │
│  Model: Claude Sonnet 4.5                  │
│  Total Prompts: ~60 (30 days × 2)          │
│                                            │
│  [GENERATE ALL PROMPTS] →                  │
│                                            │
│  ─── Progress ───                          │
│                                            │
│  ████████░░░░░░░░  45% (27/60)             │
│                                            │
│  Generating: Nov 14 - Evening              │
│  Week 3: The Alternative                   │
│                                            │
│  [View in Calendar] →                      │
└────────────────────────────────────────────┘
```

**Features**:
- Date picker for range
- Show estimated count
- Real-time progress bar
- Stream status updates
- Link to calendar view when complete

**Implementation**:
```tsx
const generatePrompts = trpc.agent.generatePrompts.useMutation({
  onSuccess: (data) => {
    // Redirect to calendar
    router.push(`/agent/calendar?month=${monthYear}`);
  }
});

// Poll job status for progress
const { data: jobStatus } = trpc.agent.getJobStatus.useQuery(
  { jobId },
  {
    enabled: !!jobId,
    refetchInterval: 2000 // Poll every 2s
  }
);
```

---

### 7. Calendar View

**File**: `app/agent/calendar/page.tsx`

**Layout**:
```
┌────────────────────────────────────────────────────────────┐
│  PROMPT CALENDAR - November 2025                           │
├────────────────────────────────────────────────────────────┤
│  [◀ Oct] [Nov 2025] [Dec ▶]                                │
│                                                            │
│  Sun   Mon   Tue   Wed   Thu   Fri   Sat                  │
│  ┌───┬───┬───┬───┬───┬───┬───┐                            │
│  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │                            │
│  │ M │ M │ M │ M │ M │ M │ M │                            │
│  │ E │ E │ E │ E │ E │ E │ E │                            │
│  └───┴───┴───┴───┴───┴───┴───┘                            │
│  ┌───┬───┬───┬───┬───┬───┬───┐                            │
│  │ 8 │ 9 │...                                              │
│  │ M │ [SELECTED]                                          │
│  │ E │                                                     │
│  └───┴───┴───                                              │
│                                                            │
│  ─── Nov 9 Morning ───                                     │
│  Week 2: The Consequences                                  │
│                                                            │
│  1. Does the algorithm care about your best work?          │
│  2. What's the difference between engagement and value?    │
│  3. Are you 'going viral' or being 'extracted'?            │
│  4. Who needs who more: platforms or creators?             │
│  5. What would you create if there was no algorithm?       │
│                                                            │
│  [Edit] [Delete] [Send to Telegram]                        │
│                                                            │
│  [Export Month] [Regenerate All]                           │
└────────────────────────────────────────────────────────────┘
```

**Features**:
- Month view with M/E indicators (Morning/Evening)
- Click day to see prompts
- Edit individual prompts
- Delete prompts
- Export to CSV
- Send to Telegram (integrate with existing bot)
- Regenerate entire month

**Data Loading**:
```tsx
const monthYear = '2025-11';
const startDate = `${monthYear}-01`;
const endDate = `${monthYear}-30`;

const { data: prompts } = trpc.agent.getPrompts.useQuery({
  startDate,
  endDate
});

const groupedByDate = prompts?.reduce((acc, prompt) => {
  if (!acc[prompt.date]) acc[prompt.date] = [];
  acc[prompt.date].push(prompt);
  return acc;
}, {});
```

---

### 8. Prompt Editor Modal

**Component**: `components/agent/PromptEditor.tsx`

**Layout**:
```
┌────────────────────────────────────────────┐
│  EDIT PROMPT - Nov 9 Morning               │
├────────────────────────────────────────────┤
│                                            │
│  Week Theme: Week 2: The Consequences      │
│                                            │
│  Prompt 1:                                 │
│  [Does the algorithm care...]              │
│                                            │
│  Prompt 2:                                 │
│  [What's the difference...]                │
│                                            │
│  [...prompts 3-5...]                       │
│                                            │
│  [Regenerate All] [Save] [Cancel]          │
└────────────────────────────────────────────┘
```

**Features**:
- Edit each of 5 prompts
- Regenerate all 5 prompts
- Save changes

---

## Component Hierarchy

```
app/
├── agent/
│   ├── page.tsx              # Landing/overview
│   ├── generate/
│   │   └── page.tsx          # Multi-step wizard
│   ├── calendar/
│   │   └── page.tsx          # Calendar view
│   └── layout.tsx            # Agent-specific layout
│
components/
└── agent/
    ├── ModelSelector.tsx     # DeepSeek vs Claude selector
    ├── UpgradeModal.tsx      # Prompt to upgrade for Claude
    ├── ThemeCard.tsx         # Display/edit weekly theme
    ├── PromptCard.tsx        # Display/edit daily prompts
    ├── PromptEditor.tsx      # Modal for editing
    ├── ProgressBar.tsx       # Generation progress
    └── CalendarGrid.tsx      # Month calendar view
```

---

## State Management Patterns

### 1. Wizard State

```tsx
const [step, setStep] = useState(1);
const [contextData, setContextData] = useState(null);
const [analysis, setAnalysis] = useState(null);
const [themes, setThemes] = useState(null);

// Step progression
const steps = [
  { number: 1, title: 'Provide Context', component: <ContextStep /> },
  { number: 2, title: 'Review Analysis', component: <AnalysisStep /> },
  { number: 3, title: 'Generate Themes', component: <ThemesStep /> },
  { number: 4, title: 'Generate Prompts', component: <PromptsStep /> },
];
```

### 2. Model Selection

```tsx
const ModelSelector = ({ onSelect }: { onSelect: (model: string) => void }) => {
  const { data: subscription } = trpc.agent.getSubscription.useQuery();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleSelectClaude = () => {
    if (subscription?.tier === 'free') {
      setShowUpgrade(true);
    } else {
      onSelect('claude');
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <ModelCard
          name="DeepSeek R1"
          description="Fast, free, good quality"
          price="Free"
          onClick={() => onSelect('deepseek')}
        />
        <ModelCard
          name="Claude Sonnet 4.5"
          description="Best quality, nuanced"
          price="Pro Only"
          onClick={handleSelectClaude}
          locked={subscription?.tier === 'free'}
        />
      </div>

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}
    </>
  );
};
```

---

## Integration with Existing Bot

### Send Prompts to Telegram

**Option 1**: Use agent-generated prompts instead of Notion

```tsx
// In bot configuration, add source selection
const [promptSource, setPromptSource] = useState<'notion' | 'agent'>('notion');

// Modify bot service to fetch from user_prompts table
if (config.prompt_source === 'agent') {
  // Fetch from user_prompts
  const prompt = await supabase
    .from('user_prompts')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .eq('post_type', type)
    .single();
} else {
  // Fetch from Notion (existing logic)
}
```

---

## Next Steps to Implement

1. **Install packages**: `pnpm install` (AI SDK packages added)
2. **Run schema**: Execute `supabase/agent_schema.sql` in Supabase SQL Editor
3. **Add API keys**: Get DeepSeek and Anthropic keys, add to `.env.local`
4. **Build UI**: Create components following this guide
5. **Test flow**: Test each step of the wizard
6. **Add Stripe**: Implement subscription tiers (optional)

---

## Security Checklist

✅ API keys never exposed to client
✅ Tier checking on every paid model call
✅ User can only access own prompts (RLS)
✅ Input validation on all forms
✅ Sanitize user-provided URLs before fetching

---

## Styling Example (Following Project Design)

```tsx
// Wizard Container
<div className="min-h-screen bg-white">
  <div className="border-b-2 border-black">
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-4xl font-display">AGENTIC GENERATION</h1>
    </div>
  </div>

  <div className="container mx-auto px-4 py-12 max-w-4xl">
    <div className="border-2 border-black p-8 mb-8">
      <h2 className="text-3xl font-display mb-6">STEP {step} OF 4</h2>
      {/* Step content */}
    </div>
  </div>
</div>

// Model Card
<div className="border-2 border-black p-6 hover:bg-gray-50 cursor-pointer">
  <h3 className="font-display text-2xl mb-2">DEEPSEEK R1</h3>
  <p className="text-gray-600 mb-4">Fast, free, good quality</p>
  <span className="font-display text-xl">FREE</span>
</div>
```

---

## Questions to Address

1. **Subscription Implementation**: Use Stripe? Other payment provider?
2. **Free Tier Limits**: Limit free users to X generations per month?
3. **Export Format**: CSV? JSON? Direct Notion import?
4. **Editing Flow**: Can users re-run analysis mid-month?

---

This guide provides everything needed to complete the UI. Backend is production-ready!
