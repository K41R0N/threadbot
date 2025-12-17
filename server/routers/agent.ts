/**
 * Agent Router - tRPC procedures for AI-powered prompt generation
 * SECURITY: All procedures are protected and check user tier for model access
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { serverSupabase } from '@/lib/supabase-server';
import { AIAgentService } from '../services/ai-agent';
import { SafeLogger } from '@/lib/logger';

// Admin user ID - checked server-side only
const ADMIN_USER_ID = 'user_2qVl3Z4r8Ys9Xx7Ww6Vv5Uu4Tt3';

/**
 * Check if user is an admin
 */
function isAdmin(userId: string): boolean {
  return userId === ADMIN_USER_ID;
}

/**
 * Check if user can generate prompts based on credits and weekly limits
 *
 * CREDITS-ONLY SYSTEM (as of 2025-11-11):
 * - DeepSeek R1: FREE once per week, OR spend 1 credit to bypass cooldown
 * - Claude Sonnet 4.5: 1 credit per generation
 * - Each purchase = 3 generation credits
 * - Admins: Exempt from all checks
 *
 * @param userId - User ID to check
 * @param useClaude - True if using Claude, false if DeepSeek
 * @param bypassWeeklyLimit - If true, user wants to spend 1 credit to bypass DeepSeek weekly limit
 * @returns Object with allowed status, error message if blocked, and credit info
 */
async function checkCredits(
  userId: string,
  useClaude: boolean,
  bypassWeeklyLimit: boolean = false
) {
  // Admins always allowed
  if (isAdmin(userId)) {
    return { allowed: true, bypassedLimit: false };
  }

  const supabase = serverSupabase;
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('claude_credits, last_free_generation_at')
    .eq('user_id', userId)
    .single();

  // @ts-expect-error Supabase v2.80.0 type inference issue
  const credits = subscription?.claude_credits || 0;
  // @ts-expect-error Supabase v2.80.0 type inference issue
  const lastFreeGeneration = subscription?.last_free_generation_at;

  // === CLAUDE SONNET 4.5: Always requires 1 credit ===
  if (useClaude) {
    if (credits <= 0) {
      return {
        allowed: false,
        error:
          'No generation credits remaining. Purchase more credits to use Claude Sonnet 4.5.',
        needsCredits: true,
        bypassedLimit: false,
      };
    }
    return { allowed: true, credits, bypassedLimit: false };
  }

  // === DEEPSEEK R1: Free with weekly cooldown ===

  // If user wants to bypass weekly limit with a credit
  if (bypassWeeklyLimit) {
    if (credits <= 0) {
      return {
        allowed: false,
        error:
          'No generation credits remaining. Purchase credits to bypass the weekly cooldown.',
        needsCredits: true,
        bypassedLimit: false,
      };
    }
    // User has credits and wants to spend one to bypass
    return { allowed: true, credits, bypassedLimit: true };
  }

  // Check weekly cooldown for free DeepSeek generation
  if (lastFreeGeneration) {
    const lastGenDate = new Date(lastFreeGeneration);
    const now = new Date();
    const daysSinceLastGen = (now.getTime() - lastGenDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastGen < 7) {
      // Still within cooldown period
      const daysRemaining = Math.ceil(7 - daysSinceLastGen);
      return {
        allowed: false,
        error: `Free DeepSeek generation available in ${daysRemaining} day(s). You can spend 1 credit to generate now.`,
        needsCredits: false,
        canBypass: true,
        daysRemaining,
        bypassedLimit: false,
      };
    }
  }

  // User can generate for free (first time or 7+ days since last generation)
  return { allowed: true, bypassedLimit: false };
}

export const agentRouter = router({
  // Get user's subscription and credits
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const supabase = serverSupabase;

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('claude_credits, tier, current_period_end, last_free_generation_at')
      .eq('user_id', ctx.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Ignore "not found" error
      SafeLogger.error('Get subscription error:', error);
    }

    // Default to free tier with 0 credits if no subscription
    return data || {
      claude_credits: 0,
      tier: 'free',
      current_period_end: null,
      last_free_generation_at: null,
    };
  }),

  // Get user's generation context
  getContext: protectedProcedure.query(async ({ ctx }) => {
    const supabase = serverSupabase;

    const { data } = await supabase
      .from('user_generation_context')
      .select('*')
      .eq('user_id', ctx.userId)
      .single();

    return data;
  }),

  // Save user's generation context
  saveContext: protectedProcedure
    .input(
      z.object({
        brandUrls: z.array(z.string().url()).optional(),
        competitorUrls: z.array(z.string().url()).optional(),
        brandVoice: z.string().optional(),
        toneAttributes: z.record(z.string(), z.any()).optional(),
        targetAudience: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      const { data, error } = await supabase
        .from('user_generation_context')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .upsert({
          user_id: ctx.userId,
          brand_urls: input.brandUrls,
          competitor_urls: input.competitorUrls,
          brand_voice: input.brandVoice,
          tone_attributes: input.toneAttributes,
          target_audience: input.targetAudience,
        })
        .select()
        .single();

      if (error) {
        throw new Error('Failed to save context');
      }

      return data;
    }),

  // Step 1: Analyze context (free for all users)
  analyzeContext: protectedProcedure
    .input(
      z.object({
        brandUrls: z.array(z.string().url()),
        competitorUrls: z.array(z.string().url()).optional(),
        additionalContext: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const analysis = await AIAgentService.analyzeContext(
          input.brandUrls,
          input.competitorUrls,
          input.additionalContext
        );

        // Save analysis to context
        const supabase = serverSupabase;
        // @ts-expect-error Supabase v2.80.0 type inference issue
        await supabase.from('user_generation_context').upsert({
          user_id: ctx.userId,
          brand_urls: input.brandUrls,
          competitor_urls: input.competitorUrls,
          core_themes: analysis.coreThemes,
          brand_voice: analysis.brandVoice,
          target_audience: analysis.targetAudience,
          last_analysis_at: new Date().toISOString(),
        });

        return {
          success: true,
          analysis,
        };
      } catch (error: any) {
        SafeLogger.error('Context analysis error:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Step 2: Generate weekly themes
  generateThemes: protectedProcedure
    .input(
      z.object({
        userPreferences: z.string(),
        useClaude: z.boolean().default(false),
        monthYear: z.string(), // Format: "2025-11"
        bypassWeeklyLimit: z.boolean().default(false), // If true, spend 1 credit to bypass DeepSeek cooldown
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      // SECURITY: Check if user can generate (credits + weekly limits)
      const creditCheck = await checkCredits(
        ctx.userId,
        input.useClaude,
        input.bypassWeeklyLimit
      );
      if (!creditCheck.allowed) {
        return {
          success: false,
          error: creditCheck.error,
          needsCredits: creditCheck.needsCredits,
          canBypass: creditCheck.canBypass,
          daysRemaining: creditCheck.daysRemaining,
        };
      }

      // Get user context
      const { data: context } = await supabase
        .from('user_generation_context')
        .select('*')
        .eq('user_id', ctx.userId)
        .single();

      // @ts-expect-error Supabase v2.80.0 type inference issue
      if (!context || !context.core_themes || context.core_themes.length === 0) {
        return {
          success: false,
          error: 'Please analyze your context first. Go back to the Context step and analyze your brand URLs.',
        };
      }

      try {
        const themes = await AIAgentService.generateWeeklyThemes(
          {
            // @ts-expect-error Supabase v2.80.0 type inference issue
            coreThemes: Array.isArray(context.core_themes) ? context.core_themes : [],
            // @ts-expect-error Supabase v2.80.0 type inference issue
            brandVoice: context.brand_voice || 'Professional and engaging',
            // @ts-expect-error Supabase v2.80.0 type inference issue
            targetAudience: context.target_audience || 'General audience',
            // @ts-expect-error Supabase v2.80.0 type inference issue
            keyTopics: Array.isArray(context.core_themes) ? context.core_themes : [],
          },
          input.userPreferences,
          input.useClaude
        );

        // Save themes to database for the user's selected month
        const monthYear = input.monthYear;

        await Promise.all(
          themes.map((theme) =>
            // @ts-expect-error Supabase v2.80.0 type inference issue
            supabase.from('user_weekly_themes').upsert({
              user_id: ctx.userId,
              month_year: monthYear,
              week_number: theme.week_number,
              theme_title: theme.theme_title,
              theme_description: theme.theme_description,
              keywords: theme.keywords,
              approved: false, // User needs to approve
            })
          )
        );

        return {
          success: true,
          themes,
        };
      } catch (error: any) {
        SafeLogger.error('Theme generation error:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Get user's weekly themes
  getWeeklyThemes: protectedProcedure
    .input(
      z.object({
        monthYear: z.string(), // "2025-11"
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      const { data } = await supabase
        .from('user_weekly_themes')
        .select('*')
        .eq('user_id', ctx.userId)
        .eq('month_year', input.monthYear)
        .order('week_number', { ascending: true });

      return data || [];
    }),

  // Approve themes
  approveThemes: protectedProcedure
    .input(
      z.object({
        monthYear: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      await supabase
        .from('user_weekly_themes')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .update({ approved: true })
        .eq('user_id', ctx.userId)
        .eq('month_year', input.monthYear);

      return { success: true };
    }),

  // Step 3: Generate all prompts for a month
  generatePrompts: protectedProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)'),
        useClaude: z.boolean().default(false),
        bypassWeeklyLimit: z.boolean().default(false), // If true, spend 1 credit to bypass DeepSeek cooldown
      }).superRefine((data, ctx) => {
        // SECURITY: Prevent API cost explosion by limiting date ranges
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        // Validate date parsing
        if (isNaN(start.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid start date value',
            path: ['startDate'],
          });
          return;
        }

        if (isNaN(end.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid end date value',
            path: ['endDate'],
          });
          return;
        }

        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // Validate date order
        if (days < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'End date must be after start date',
            path: ['endDate'],
          });
        }

        // Validate maximum range (31 days)
        if (days > 31) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Date range cannot exceed 31 days (1 month maximum)',
            path: ['endDate'],
          });
        }
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      // SECURITY: Check if user can generate (credits + weekly limits)
      const creditCheck = await checkCredits(
        ctx.userId,
        input.useClaude,
        input.bypassWeeklyLimit
      );
      if (!creditCheck.allowed) {
        return {
          success: false,
          error: creditCheck.error,
          needsCredits: creditCheck.needsCredits,
          canBypass: creditCheck.canBypass,
          daysRemaining: creditCheck.daysRemaining,
        };
      }

      // Create job record
      const { data: job } = await supabase
        .from('agent_generation_jobs')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .insert({
          user_id: ctx.userId,
          status: 'pending',
          model_used: input.useClaude ? 'claude-sonnet-4.5' : 'deepseek-r1',
          start_date: input.startDate,
          end_date: input.endDate,
        })
        .select()
        .single();

      if (!job) {
        return { success: false, error: 'Failed to create job' };
      }

      try {
        // Get context and themes
        const { data: context } = await supabase
          .from('user_generation_context')
          .select('*')
          .eq('user_id', ctx.userId)
          .single();

        const monthYear = input.startDate.slice(0, 7);
        const { data: themes } = await supabase
          .from('user_weekly_themes')
          .select('*')
          .eq('user_id', ctx.userId)
          .eq('month_year', monthYear)
          .order('week_number', { ascending: true });

        if (!context || !themes || themes.length !== 4) {
          throw new Error('Missing context or themes');
        }

        // Update job status
        await supabase
          .from('agent_generation_jobs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update({ status: 'generating_prompts' })
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .eq('id', job.id);

        // SECURITY: Deduct credit BEFORE generating prompts to prevent race conditions
        // This ensures we never give away free prompts if deduction fails
        if (!isAdmin(ctx.userId)) {
          // Case 1: Using Claude Sonnet 4.5 → Always deduct 1 credit
          // Case 2: Using DeepSeek with bypass → Deduct 1 credit
          // Case 3: Using DeepSeek without bypass → Update timestamp only, no credit deduction
          const shouldDeductCredit = input.useClaude || input.bypassWeeklyLimit;

          if (shouldDeductCredit) {
            const { error: creditError } = await supabase
              // @ts-expect-error Supabase v2.80.0 type inference issue
              .rpc('decrement_claude_credits', { user_id_param: ctx.userId });

            if (creditError) {
              SafeLogger.error('Credit deduction failed BEFORE generation:', creditError);
              // Mark job as failed since we couldn't charge
              await supabase
                .from('agent_generation_jobs')
                // @ts-expect-error Supabase v2.80.0 type inference issue
                .update({
                  status: 'failed',
                  error_message: 'Failed to deduct credit: ' + creditError.message,
                })
                // @ts-expect-error Supabase v2.80.0 type inference issue
                .eq('id', job.id);

              throw new Error('Failed to deduct credit: ' + creditError.message);
            }

            SafeLogger.info('Generation credit deducted (before generation)', {
              userId: ctx.userId,
              useClaude: input.useClaude,
              bypassedLimit: input.bypassWeeklyLimit,
            });
          }

          // Update last free generation timestamp for DeepSeek (including bypassed)
          if (!input.useClaude) {
            const { error: timestampError } = await supabase
              .from('user_subscriptions')
              // @ts-expect-error Supabase v2.80.0 type inference issue
              .update({ last_free_generation_at: new Date().toISOString() })
              .eq('user_id', ctx.userId);

            if (timestampError) {
              SafeLogger.error('Failed to update generation timestamp:', timestampError);
              // Don't throw - this is just tracking, not critical
            } else {
              SafeLogger.info('Weekly generation timestamp updated', {
                userId: ctx.userId,
                bypassedLimit: input.bypassWeeklyLimit,
              });
            }
          }
        }

        // NOW generate prompts (after payment confirmed)
        const prompts = await AIAgentService.generateAllPrompts(
          input.startDate,
          input.endDate,
          themes,
          {
            // @ts-expect-error Supabase v2.80.0 type inference issue
            coreThemes: context.core_themes || [],
            // @ts-expect-error Supabase v2.80.0 type inference issue
            brandVoice: context.brand_voice || '',
            // @ts-expect-error Supabase v2.80.0 type inference issue
            targetAudience: context.target_audience || '',
            // @ts-expect-error Supabase v2.80.0 type inference issue
            keyTopics: context.core_themes || [],
          },
          input.useClaude
        );

        // Save prompts to database
        await supabase.from('user_prompts').insert(
          // @ts-expect-error Supabase v2.80.0 type inference issue
          prompts.map((p) => ({
            user_id: ctx.userId,
            date: p.date,
            name: p.name,
            week_theme: p.week_theme,
            post_type: p.post_type,
            status: 'draft',
            prompts: p.prompts,
          }))
        );

        // Mark job as completed (only after successful credit deduction)
        await supabase
          .from('agent_generation_jobs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update({
            status: 'completed',
            total_prompts: prompts.length,
          })
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .eq('id', job.id);

        return {
          success: true,
          // @ts-expect-error Supabase v2.80.0 type inference issue
          jobId: job.id,
          totalPrompts: prompts.length,
        };
      } catch (error: any) {
        SafeLogger.error('Prompt generation error:', error);

        // Mark job as failed
        await supabase
          .from('agent_generation_jobs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update({
            status: 'failed',
            error_message: error.message,
          })
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .eq('id', job.id);

        return {
          success: false,
          error: error.message,
        };
      }
    }),

  // Get user's prompts for a date range
  getPrompts: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      let query = supabase
        .from('user_prompts')
        .select('*')
        .eq('user_id', ctx.userId)
        .order('date', { ascending: true });

      if (input.startDate) {
        query = query.gte('date', input.startDate);
      }

      if (input.endDate) {
        query = query.lte('date', input.endDate);
      }

      const { data } = await query;

      return data || [];
    }),

  // Update a prompt
  updatePrompt: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        prompts: z.array(z.string()).optional(),
        status: z.enum(['draft', 'scheduled', 'sent']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      // Type-safe update data for user_prompts table
      type PromptUpdate = {
        prompts?: string[];
        status?: 'draft' | 'scheduled' | 'sent';
      };

      const updateData: PromptUpdate = {};
      if (input.prompts) updateData.prompts = input.prompts;
      if (input.status) updateData.status = input.status;

      const { data, error } = await supabase
        .from('user_prompts')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .update(updateData)
        .eq('id', input.id)
        .eq('user_id', ctx.userId) // Ensure user owns this prompt
        .select()
        .single();

      if (error) {
        throw new Error('Failed to update prompt');
      }

      return data;
    }),

  // Delete a prompt
  deletePrompt: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      await supabase
        .from('user_prompts')
        .delete()
        .eq('id', input.id)
        .eq('user_id', ctx.userId);

      return { success: true };
    }),

  // Get generation job status
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const supabase = serverSupabase;

      const { data } = await supabase
        .from('agent_generation_jobs')
        .select('*')
        .eq('id', input.jobId)
        .eq('user_id', ctx.userId)
        .single();

      return data;
    }),

  // Get onboarding status
  getOnboardingStatus: protectedProcedure.query(async ({ ctx }) => {
    const supabase = serverSupabase;

    // Ensure subscription row exists
    const { data } = await supabase
      .from('user_subscriptions')
      .select('onboarding_completed, onboarding_skipped')
      .eq('user_id', ctx.userId)
      .single();

    // If no subscription row, create one (tier omitted - deprecated)
    if (!data) {
      await supabase
        .from('user_subscriptions')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .insert({
          user_id: ctx.userId,
          // tier: removed (deprecated 2025-11-11, defaults to 'free')
          claude_credits: 0,
          onboarding_completed: false,
          onboarding_skipped: false,
        });

      return { onboarding_completed: false, onboarding_skipped: false };
    }

    return data;
  }),

  // Mark onboarding as completed
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const supabase = serverSupabase;

    // SECURITY: Only update onboarding flags - preserve tier and credits
    // Use update with select to check if row exists
    const { data, error } = await supabase
      .from('user_subscriptions')
      // @ts-expect-error Supabase v2.80.0 type inference issue
      .update({
        onboarding_completed: true,
        onboarding_skipped: false,
      })
      .eq('user_id', ctx.userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error('Failed to update onboarding status');
    }

    // If no row exists, create it with defaults (first-time user, tier omitted - deprecated)
    if (!data) {
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .insert({
          user_id: ctx.userId,
          // tier: removed (deprecated 2025-11-11, defaults to 'free')
          claude_credits: 0,
          onboarding_completed: true,
          onboarding_skipped: false,
        });

      if (insertError) {
        throw new Error('Failed to create onboarding status');
      }
    }

    return { success: true };
  }),

  // Skip onboarding
  skipOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    const supabase = serverSupabase;

    // SECURITY: Only update onboarding flags - preserve credits
    // Use update with select to check if row exists
    const { data, error } = await supabase
      .from('user_subscriptions')
      // @ts-expect-error Supabase v2.80.0 type inference issue
      .update({
        onboarding_completed: false,
        onboarding_skipped: true,
      })
      .eq('user_id', ctx.userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new Error('Failed to update onboarding status');
    }

    // If no row exists, create it with defaults (first-time user, tier omitted - deprecated)
    if (!data) {
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        // @ts-expect-error Supabase v2.80.0 type inference issue
        .insert({
          user_id: ctx.userId,
          // tier: removed (deprecated 2025-11-11, defaults to 'free')
          claude_credits: 0,
          onboarding_completed: false,
          onboarding_skipped: true,
        });

      if (insertError) {
        throw new Error('Failed to create onboarding status');
      }
    }

    return { success: true };
  }),
});
