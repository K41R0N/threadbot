/**
 * AI Agent Service
 * Handles multi-model prompt generation using DeepSeek (free) or Claude (paid)
 *
 * SECURITY: All API keys are server-side only. Never expose to client.
 */

import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { SafeLogger } from '@/lib/logger';

// SECURITY: API keys from environment variables (server-side only)
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com',
});

// Schemas for structured outputs
const ThemeSchema = z.object({
  week_number: z.number().int().min(1).max(4),
  theme_title: z.string(),
  theme_description: z.string(),
  keywords: z.array(z.string()),
});

const WeeklyThemesSchema = z.object({
  themes: z.array(ThemeSchema).length(4),
});

const DailyPromptSchema = z.object({
  date: z.string(),
  name: z.string(),
  week_theme: z.string(),
  post_type: z.enum(['morning', 'evening']),
  prompts: z.array(z.string()).length(5),
});

const MonthlyPromptsSchema = z.object({
  prompts: z.array(DailyPromptSchema),
});

export interface ContextAnalysis {
  coreThemes: string[];
  brandVoice: string;
  targetAudience: string;
  keyTopics: string[];
}

export interface WeeklyTheme {
  week_number: number;
  theme_title: string;
  theme_description: string;
  keywords: string[];
}

export interface DailyPrompt {
  date: string;
  name: string;
  week_theme: string;
  post_type: 'morning' | 'evening';
  prompts: string[];
}

export class AIAgentService {
  /**
   * Step 1: Analyze user context (URLs, brand voice, etc.)
   * Uses DeepSeek R1 for reasoning (free)
   */
  static async analyzeContext(
    brandUrls: string[],
    competitorUrls: string[] = [],
    additionalContext?: string
  ): Promise<ContextAnalysis> {
    try {
      const { text } = await generateText({
        model: deepseek('deepseek-reasoner'), // R1 model
        prompt: `Analyze the following content sources and extract:

1. Core Themes (5-7 main topics/pillars)
2. Brand Voice (tone, style, personality)
3. Target Audience (who is this for?)
4. Key Topics (specific subjects to explore)

Brand URLs:
${brandUrls.join('\n')}

${competitorUrls.length > 0 ? `Competitor/Inspiration URLs:\n${competitorUrls.join('\n')}` : ''}

${additionalContext ? `Additional Context:\n${additionalContext}` : ''}

Return your analysis in this exact JSON format:
{
  "coreThemes": ["theme1", "theme2", ...],
  "brandVoice": "description of voice",
  "targetAudience": "description of audience",
  "keyTopics": ["topic1", "topic2", ...]
}`,
        maxTokens: 4000,
      });

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse context analysis');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error: any) {
      SafeLogger.error('Context analysis error:', error);
      throw new Error(`Failed to analyze context: ${error.message}`);
    }
  }

  /**
   * Step 2: Generate 4 weekly themes
   * Uses Claude Sonnet for paid tier, DeepSeek Chat for free tier
   */
  static async generateWeeklyThemes(
    contextAnalysis: ContextAnalysis,
    userPreferences: string,
    useClaude: boolean = false
  ): Promise<WeeklyTheme[]> {
    try {
      const model = useClaude
        ? anthropic('claude-sonnet-4.5-20250929')
        : deepseek('deepseek-chat');

      const { object } = await generateObject({
        model,
        schema: WeeklyThemesSchema,
        prompt: `Create 4 weekly themes for a month-long content calendar.

Context Analysis:
- Core Themes: ${contextAnalysis.coreThemes.join(', ')}
- Brand Voice: ${contextAnalysis.brandVoice}
- Target Audience: ${contextAnalysis.targetAudience}
- Key Topics: ${contextAnalysis.keyTopics.join(', ')}

User Preferences:
${userPreferences}

REQUIREMENTS:
1. Create 4 distinct, sequential weekly themes
2. Themes should tell a story: Problem → Consequences → Alternative → Action
3. Each theme should have a compelling title
4. Each theme should have 3-5 keywords
5. Themes should build on each other throughout the month

Example structure:
- Week 1: "The Problem" - Identify the core issue
- Week 2: "The Consequences" - Explore what happens if unaddressed
- Week 3: "The Alternative" - Present a better way
- Week 4: "The Action Plan" - Concrete steps forward

Return 4 weekly themes that follow this narrative arc but are customized to the provided context.`,
        temperature: 0.8,
        maxTokens: 2000,
      });

      return (object as z.infer<typeof WeeklyThemesSchema>).themes;
    } catch (error: any) {
      SafeLogger.error('Theme generation error:', error);
      throw new Error(`Failed to generate themes: ${error.message}`);
    }
  }

  /**
   * Step 3: Generate prompts for a single day
   * Uses selected model based on tier
   */
  static async generateDayPrompts(
    date: string,
    weekTheme: WeeklyTheme,
    contextAnalysis: ContextAnalysis,
    postType: 'morning' | 'evening',
    useClaude: boolean = false
  ): Promise<DailyPrompt> {
    try {
      const model = useClaude
        ? anthropic('claude-sonnet-4.5-20250929')
        : deepseek('deepseek-chat');

      const timeOfDay = postType === 'morning' ? 'morning reflection' : 'evening reflection';
      const formattedDate = new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const { object } = await generateObject({
        model,
        schema: DailyPromptSchema,
        prompt: `Generate a ${postType} prompt set for ${formattedDate}.

Weekly Theme: ${weekTheme.theme_title}
Theme Description: ${weekTheme.theme_description}
Keywords: ${weekTheme.keywords.join(', ')}

Context:
- Brand Voice: ${contextAnalysis.brandVoice}
- Target Audience: ${contextAnalysis.targetAudience}
- Core Themes: ${contextAnalysis.coreThemes.join(', ')}

REQUIREMENTS:
1. Create EXACTLY 5 open-ended questions
2. Questions must be thought-starters, not statements
3. Questions should align with the weekly theme
4. Questions should be appropriate for ${timeOfDay}
5. Questions should inspire the user to write their own take
6. Vary question styles (why, what, how, reflection, action)

DO NOT:
- Write pre-written copy or statements
- Create prompts that can be answered with yes/no
- Repeat questions from previous days

TONE: ${contextAnalysis.brandVoice}`,
        temperature: 0.9,
        maxTokens: 1000,
      });

      const typedObject = object as z.infer<typeof DailyPromptSchema>;

      return {
        ...typedObject,
        date,
        name: `${formattedDate.split(',')[0]} ${date} - ${postType.charAt(0).toUpperCase() + postType.slice(1)}`,
        week_theme: weekTheme.theme_title,
        post_type: postType,
      };
    } catch (error: any) {
      SafeLogger.error('Day prompt generation error:', error);
      throw new Error(`Failed to generate day prompts: ${error.message}`);
    }
  }

  /**
   * Generate all prompts for a date range in parallel
   */
  static async generateAllPrompts(
    startDate: string,
    endDate: string,
    weeklyThemes: WeeklyTheme[],
    contextAnalysis: ContextAnalysis,
    useClaude: boolean = false
  ): Promise<DailyPrompt[]> {
    const days = this.getDaysInRange(startDate, endDate);
    const results: DailyPrompt[] = [];

    // Generate in batches of 5 to avoid rate limits
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

      // Small delay between batches
      if (i + batchSize < days.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Helper: Get all days in a date range
   */
  private static getDaysInRange(startDate: string, endDate: string): { date: string }[] {
    const days: { date: string }[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push({ date: d.toISOString().split('T')[0] });
    }

    return days;
  }

  /**
   * Helper: Determine which week a date falls into (1-4)
   */
  private static getWeekNumber(date: string, startDate: string): number {
    const d = new Date(date);
    const start = new Date(startDate);
    const diffDays = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.min(Math.floor(diffDays / 7) + 1, 4);
  }
}
