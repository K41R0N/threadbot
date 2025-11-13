# ThreadBot LLM Implementation - Complete Technical Guide

**Author**: AI Analysis
**Date**: 2025-11-13
**Purpose**: Comprehensive breakdown of LLM implementation for replication in other projects

---

## **1. Technology Stack**

### Core AI Dependencies
```json
{
  "ai": "^4.3.19",                    // Vercel AI SDK - Core orchestration
  "@ai-sdk/anthropic": "^1.2.12",    // Claude Sonnet provider
  "@ai-sdk/deepseek": "^0.2.16",     // DeepSeek R1 provider
  "zod": "^3.25.76"                   // Schema validation (must be v3.x)
}
```

### Why Vercel AI SDK?
- **Model-agnostic**: Switch between providers without code changes
- **Type-safe**: Full TypeScript support
- **Structured output**: Native JSON schema validation via Zod
- **Streaming**: Built-in support for streaming responses
- **Unified API**: Same interface for all LLM providers

---

## **2. Architecture Overview**

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Layer (React/Next.js)                │
│  - User inputs (URLs, preferences, dates)                   │
│  - Progress tracking                                        │
│  - Results display                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ tRPC (Type-safe API calls)
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Business Logic Layer (tRPC Router)             │
│  - Credit checks & monetization                             │
│  - User authentication                                      │
│  - Database operations                                      │
│  - Job tracking                                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Service calls
                     │
┌────────────────────▼────────────────────────────────────────┐
│                AI Service Layer (AIAgentService)            │
│  - Model selection (Claude vs DeepSeek)                     │
│  - Prompt engineering                                       │
│  - Structured output parsing                                │
│  - Batch processing & rate limiting                         │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
┌─────────▼──────────┐  ┌──────▼──────────┐
│  Anthropic API     │  │  DeepSeek API   │
│  (Claude 4.5)      │  │  (R1 Reasoner)  │
└────────────────────┘  └─────────────────┘
```

---

## **3. Implementation Details**

### **A. Service Layer Setup** (`server/services/ai-agent.ts`)

#### 1. Provider Initialization
```typescript
import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

// SECURITY: API keys from environment (server-side only)
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY!,
});
```

**Key Points:**
- ✅ Initialize providers once at module load
- ✅ Never expose API keys to client
- ✅ Use environment variables
- ✅ Server-side only (never import in client components)

---

#### 2. Zod Schemas for Structured Output

ThreadBot uses Zod to enforce strict JSON schemas from LLMs:

```typescript
// Define expected output structure
const ThemeSchema = z.object({
  week_number: z.number().int().min(1).max(4),
  theme_title: z.string(),
  theme_description: z.string(),
  keywords: z.array(z.string()),
});

const WeeklyThemesSchema = z.object({
  themes: z.array(ThemeSchema).length(4),  // Exactly 4 themes
});

const DailyPromptSchema = z.object({
  date: z.string(),
  name: z.string(),
  week_theme: z.string(),
  post_type: z.enum(['morning', 'evening']),
  prompts: z.array(z.string()).length(5),  // Exactly 5 prompts
});
```

**Benefits:**
- ✅ Runtime validation of LLM outputs
- ✅ Type safety (TypeScript infers types from schemas)
- ✅ Automatic error handling for malformed responses
- ✅ No manual JSON parsing needed

---

#### 3. Multi-Step Generation Pipeline

ThreadBot uses a **3-step pipeline**:

##### **Step 1: Context Analysis** (Free for all users)
```typescript
static async analyzeContext(
  brandUrls: string[],
  competitorUrls: string[] = [],
  additionalContext?: string
): Promise<ContextAnalysis> {
  const { text } = await generateText({
    model: deepseek('deepseek-reasoner'),  // R1 reasoning model
    prompt: `Analyze these URLs and extract:
      1. Core Themes (5-7 topics)
      2. Brand Voice (tone, style)
      3. Target Audience
      4. Key Topics

      Brand URLs: ${brandUrls.join('\n')}
      ${competitorUrls.length > 0 ? `Competitors: ${competitorUrls.join('\n')}` : ''}

      Return JSON: { "coreThemes": [...], "brandVoice": "...", ... }`,
    maxTokens: 4000,
  });

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch[0]);
}
```

**Why this approach?**
- Uses `generateText` (not `generateObject`) for DeepSeek R1's reasoning mode
- Manual JSON extraction (more flexible for reasoning models)
- Free tier = DeepSeek only

---

##### **Step 2: Theme Generation** (Paid/Free based on tier)
```typescript
static async generateWeeklyThemes(
  contextAnalysis: ContextAnalysis,
  userPreferences: string,
  useClaude: boolean = false
): Promise<WeeklyTheme[]> {
  // Model selection based on user tier
  const model = useClaude
    ? anthropic('claude-sonnet-4-20250514')
    : deepseek('deepseek-chat');

  const { object } = await generateObject({
    model,
    schema: WeeklyThemesSchema,  // Zod schema validation
    prompt: `Create 4 weekly themes for a month.

      Context: ${contextAnalysis.coreThemes.join(', ')}
      Brand Voice: ${contextAnalysis.brandVoice}
      User Preferences: ${userPreferences}

      REQUIREMENTS:
      1. 4 distinct, sequential themes
      2. Narrative arc: Problem → Consequences → Alternative → Action
      3. Each has title, description, 3-5 keywords

      Example:
      Week 1: "The Problem" - Identify core issue
      Week 2: "Consequences" - Explore impact
      Week 3: "Alternative" - Present better way
      Week 4: "Action Plan" - Concrete steps`,
    temperature: 0.8,
    maxTokens: 2000,
  });

  return object.themes;  // Type-safe, validated output
}
```

**Key Features:**
- ✅ `generateObject` ensures structured JSON output
- ✅ Automatic Zod validation (throws error if schema mismatch)
- ✅ Model switching via simple conditional
- ✅ Higher temperature (0.8) for creative content

---

##### **Step 3: Daily Prompt Generation** (Batched)
```typescript
static async generateDayPrompts(
  date: string,
  weekTheme: WeeklyTheme,
  contextAnalysis: ContextAnalysis,
  postType: 'morning' | 'evening',
  useClaude: boolean = false
): Promise<DailyPrompt> {
  const model = useClaude
    ? anthropic('claude-sonnet-4-20250514')
    : deepseek('deepseek-chat');

  const timeOfDay = postType === 'morning'
    ? 'morning reflection'
    : 'evening reflection';

  const { object } = await generateObject({
    model,
    schema: DailyPromptSchema,
    prompt: `Generate ${postType} prompts for ${date}.

      Weekly Theme: ${weekTheme.theme_title}
      Theme Description: ${weekTheme.theme_description}
      Keywords: ${weekTheme.keywords.join(', ')}
      Brand Voice: ${contextAnalysis.brandVoice}

      REQUIREMENTS:
      1. Create EXACTLY 5 open-ended questions
      2. Thought-starters, not statements
      3. Align with weekly theme
      4. Appropriate for ${timeOfDay}
      5. Inspire personal takes
      6. Vary question styles (why, what, how)

      DO NOT:
      - Write statements
      - Create yes/no questions
      - Repeat previous questions`,
    temperature: 0.9,  // Higher for diverse prompts
    maxTokens: 1000,
  });

  return object;
}
```

**Batch Processing** (prevents rate limits):
```typescript
static async generateAllPrompts(
  startDate: string,
  endDate: string,
  weeklyThemes: WeeklyTheme[],
  contextAnalysis: ContextAnalysis,
  useClaude: boolean = false
): Promise<DailyPrompt[]> {
  const days = this.getDaysInRange(startDate, endDate);
  const results: DailyPrompt[] = [];

  // Process in batches of 5 (10 API calls per batch: morning + evening)
  const batchSize = 5;
  for (let i = 0; i < days.length; i += batchSize) {
    const batch = days.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.flatMap((day) => {
        const weekNumber = this.getWeekNumber(day.date, startDate);
        const theme = weeklyThemes[weekNumber - 1];

        return [
          this.generateDayPrompts(day.date, theme, contextAnalysis, 'morning', useClaude),
          this.generateDayPrompts(day.date, theme, contextAnalysis, 'evening', useClaude),
        ];
      })
    );

    results.push(...batchResults);

    // 1-second delay between batches (rate limit protection)
    if (i + batchSize < days.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
```

**Batch Strategy:**
- ✅ 5 days per batch = 10 API calls (morning + evening)
- ✅ Parallel processing within batches (`Promise.all`)
- ✅ 1-second delay between batches
- ✅ Total time: ~12 seconds for 60 prompts (30 days)

---

### **B. Business Logic Layer** (`server/routers/agent.ts`)

#### Credit System Integration

```typescript
// Check credits BEFORE generation
async function checkCredits(
  userId: string,
  useClaude: boolean,
  bypassWeeklyLimit: boolean = false
) {
  // Admin bypass
  if (isAdmin(userId)) {
    return { allowed: true };
  }

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('claude_credits, last_free_generation_at')
    .eq('user_id', userId)
    .single();

  const credits = subscription?.claude_credits || 0;

  // CLAUDE: Always requires 1 credit
  if (useClaude) {
    if (credits <= 0) {
      return {
        allowed: false,
        error: 'No credits. Purchase more to use Claude Sonnet 4.5.',
        needsCredits: true,
      };
    }
    return { allowed: true, credits };
  }

  // DEEPSEEK: Weekly cooldown or 1 credit bypass
  if (bypassWeeklyLimit) {
    if (credits <= 0) {
      return { allowed: false, error: 'No credits to bypass cooldown.' };
    }
    return { allowed: true, credits, bypassedLimit: true };
  }

  // Check 7-day cooldown
  const lastGeneration = subscription?.last_free_generation_at;
  if (lastGeneration) {
    const daysSince = (Date.now() - new Date(lastGeneration).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      return {
        allowed: false,
        canBypass: true,
        daysRemaining: Math.ceil(7 - daysSince),
        error: `Free DeepSeek in ${Math.ceil(7 - daysSince)} days. Spend 1 credit to bypass.`,
      };
    }
  }

  return { allowed: true };  // Free generation allowed
}
```

---

#### tRPC Endpoint with Credit Deduction

```typescript
generatePrompts: protectedProcedure
  .input(z.object({
    startDate: z.string(),
    endDate: z.string(),
    useClaude: z.boolean().default(false),
    bypassWeeklyLimit: z.boolean().default(false),
  }))
  .mutation(async ({ ctx, input }) => {
    // 1. CHECK CREDITS
    const creditCheck = await checkCredits(
      ctx.userId,
      input.useClaude,
      input.bypassWeeklyLimit
    );
    if (!creditCheck.allowed) {
      return {
        success: false,
        error: creditCheck.error,
        canBypass: creditCheck.canBypass,
      };
    }

    // 2. CREATE JOB RECORD
    const { data: job } = await supabase
      .from('agent_generation_jobs')
      .insert({
        user_id: ctx.userId,
        status: 'pending',
        model_used: input.useClaude ? 'claude-sonnet-4.5' : 'deepseek-r1',
        start_date: input.startDate,
        end_date: input.endDate,
      })
      .select()
      .single();

    // 3. DEDUCT CREDIT (BEFORE GENERATION - CRITICAL!)
    const shouldDeductCredit = input.useClaude || input.bypassWeeklyLimit;
    if (shouldDeductCredit && !isAdmin(ctx.userId)) {
      const { error: creditError } = await supabase
        .rpc('decrement_claude_credits', { user_id_param: ctx.userId });

      if (creditError) {
        // Mark job as failed
        await supabase
          .from('agent_generation_jobs')
          .update({ status: 'failed', error_message: creditError.message })
          .eq('id', job.id);

        throw new Error('Failed to deduct credit: ' + creditError.message);
      }
    }

    // 4. UPDATE TIMESTAMP (for weekly tracking)
    if (!input.useClaude && !isAdmin(ctx.userId)) {
      await supabase
        .from('user_subscriptions')
        .update({ last_free_generation_at: new Date().toISOString() })
        .eq('user_id', ctx.userId);
    }

    // 5. GENERATE PROMPTS (after payment confirmed)
    const prompts = await AIAgentService.generateAllPrompts(
      input.startDate,
      input.endDate,
      themes,
      contextAnalysis,
      input.useClaude
    );

    // 6. SAVE TO DATABASE
    await supabase.from('user_prompts').insert(prompts);

    // 7. MARK JOB COMPLETE
    await supabase
      .from('agent_generation_jobs')
      .update({ status: 'completed', total_prompts: prompts.length })
      .eq('id', job.id);

    return { success: true, prompts };
  })
```

**Critical Pattern: Credit Deduction BEFORE Generation**
- ✅ Prevents race conditions (two concurrent requests)
- ✅ Prevents free content if deduction fails
- ✅ Atomic via PostgreSQL function (`decrement_claude_credits`)

---

## **4. Model Selection Strategy**

### Two-Model Approach

| Feature | DeepSeek R1 | Claude Sonnet 4.5 |
|---------|------------|-------------------|
| **Cost** | FREE (unlimited API) | Paid (Anthropic charges) |
| **User Cost** | Free weekly, or 1 credit | 1 credit per generation |
| **Quality** | Good (90% of Claude) | Excellent (best quality) |
| **Speed** | Fast | Moderate |
| **Use Case** | Context analysis, free tier | Premium tier, best results |
| **Model ID** | `deepseek-reasoner` (analysis)<br>`deepseek-chat` (generation) | `claude-sonnet-4-20250514` |

### When to Use Each

**DeepSeek R1 (`deepseek-reasoner`)**:
- ✅ Context analysis (reasoning mode)
- ✅ Free tier users
- ✅ Development/testing
- ✅ High-volume, cost-sensitive use cases

**Claude Sonnet 4.5**:
- ✅ Premium quality content
- ✅ Complex creative tasks
- ✅ Users willing to pay for quality
- ✅ Production-critical outputs

---

## **5. Prompt Engineering Patterns**

### Pattern 1: Clear Structure + Requirements
```typescript
prompt: `Create 4 weekly themes for a month.

Context:
- Core Themes: ${contextAnalysis.coreThemes.join(', ')}
- Brand Voice: ${contextAnalysis.brandVoice}

REQUIREMENTS:
1. 4 distinct themes
2. Narrative arc: Problem → Solution
3. Each has: title, description, 3-5 keywords

DO NOT:
- Repeat themes
- Use generic language
- Skip required fields`
```

### Pattern 2: Examples in Prompts
```typescript
Example structure:
- Week 1: "The Problem" - Identify the core issue
- Week 2: "The Consequences" - Explore what happens
- Week 3: "The Alternative" - Present a better way
- Week 4: "The Action Plan" - Concrete steps
```

### Pattern 3: Dynamic Context Injection
```typescript
Brand Voice: ${contextAnalysis.brandVoice}
Target Audience: ${contextAnalysis.targetAudience}
Weekly Theme: ${weekTheme.theme_title}
Time of Day: ${postType === 'morning' ? 'reflection' : 'action'}
```

---

## **6. Environment Setup**

### Required Environment Variables
```bash
# AI Provider Keys (server-side only)
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# Database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Auth
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

### Package Installation
```bash
pnpm add ai @ai-sdk/anthropic @ai-sdk/deepseek zod
# or
npm install ai @ai-sdk/anthropic @ai-sdk/deepseek zod
```

---

## **7. Key Takeaways for Your Project**

### ✅ **DO:**
1. **Use Vercel AI SDK** for model-agnostic architecture
2. **Define Zod schemas** for all LLM outputs (type safety + validation)
3. **Batch API calls** with delays (rate limit protection)
4. **Deduct credits BEFORE generation** (prevent fraud)
5. **Use `generateObject`** for structured JSON (auto-validates)
6. **Keep API keys server-side only** (security)
7. **Log all LLM calls** with SafeLogger (debugging + monitoring)
8. **Offer free + paid models** (DeepSeek + Claude pattern)

### ❌ **DON'T:**
1. Don't expose API keys to client
2. Don't skip Zod validation (runtime safety)
3. Don't charge after generation (race condition risk)
4. Don't use `any` types (lose type safety)
5. Don't forget rate limiting
6. Don't use synchronous processing (use batches)

---

## **8. Replication Checklist**

To implement this in your project:

- [ ] Install dependencies (`ai`, `@ai-sdk/*`, `zod`)
- [ ] Set up provider credentials (env vars)
- [ ] Create service layer (`services/ai-agent.ts`)
- [ ] Define Zod schemas for outputs
- [ ] Implement multi-step pipeline (if needed)
- [ ] Add tRPC endpoints with auth
- [ ] Implement credit/monetization system
- [ ] Add batch processing for scale
- [ ] Set up logging (SafeLogger pattern)
- [ ] Test with both free + paid models
- [ ] Add error handling + retry logic
- [ ] Monitor API costs

---

## **9. File Structure**

```
your-project/
├── server/
│   ├── services/
│   │   └── ai-agent.ts          # LLM service layer
│   └── routers/
│       └── agent.ts              # tRPC endpoints with credit checks
├── lib/
│   ├── logger.ts                 # SafeLogger for credential redaction
│   └── supabase-server.ts        # Database client
└── .env.local                    # API keys (never commit!)
```

---

## **10. Cost Optimization Tips**

1. **Use DeepSeek for development** - Free tier, unlimited
2. **Cache results** - Store generated content in database
3. **Batch requests** - Reduce overhead with `Promise.all`
4. **Set max tokens** - Prevent runaway costs
5. **Monitor usage** - Track API calls and costs
6. **Implement rate limiting** - Prevent abuse
7. **Use webhooks** - For async processing (cheaper than long-running requests)

---

**This architecture is production-ready, type-safe, and monetization-friendly**. The key innovation is the **credits-only system with dual models** (free DeepSeek + paid Claude) integrated through Vercel AI SDK's unified interface.

---

**Last Updated**: 2025-11-13
**Status**: Production-Ready
**Version**: 1.0.0
