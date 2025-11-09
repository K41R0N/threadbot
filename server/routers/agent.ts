/**
 * Agent Router - tRPC procedures for AI-powered prompt generation
 * SECURITY: All procedures are protected and check user tier for model access
 */

import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { getServerSupabase } from '@/lib/supabase';
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
 * Check if user has credits for Claude generation
 * Free tier: Can use DeepSeek unlimited (no credit check)
 * Paid: Each purchase = 3 credits for Claude generations
 * Admins are exempt from credit checks
 */
async function checkCredits(userId: string, useClaude: boolean) {
  // Admins always allowed
  if (isAdmin(userId)) {
    return { allowed: true };
  }

  // Free tier using DeepSeek: unlimited, no credit check
  if (!useClaude) {
    return { allowed: true };
  }

  // Using Claude: check credits
  const supabase = getServerSupabase();
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('claude_credits')
    .eq('user_id', userId)
    .single();

  const credits = subscription?.claude_credits || 0;

  if (credits <= 0) {
    return {
      allowed: false,
      error: 'No Claude credits remaining. Purchase more credits to generate with Claude.',
      needsCredits: true,
    };
  }

  return { allowed: true, credits };
}

export const agentRouter = router({
  // Get user's subscription and credits
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('claude_credits, tier, current_period_end')
      .eq('user_id', ctx.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Ignore "not found" error
      SafeLogger.error('Get subscription error:', error);
    }

    // Default to free tier with 0 credits if no subscription
    return data || { claude_credits: 0, tier: 'free', current_period_end: null };
  }),

  // Get user's generation context
  getContext: protectedProcedure.query(async ({ ctx }) => {
    const supabase = getServerSupabase();

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
      const supabase = getServerSupabase();

      const { data, error } = await supabase
        .from('user_generation_context')
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
        const supabase = getServerSupabase();
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = getServerSupabase();

      // SECURITY: Check if user has credits for Claude generation
      const creditCheck = await checkCredits(ctx.userId, input.useClaude);
      if (!creditCheck.allowed) {
        return {
          success: false,
          error: creditCheck.error,
          needsCredits: creditCheck.needsCredits,
        };
      }

      // Get user context
      const { data: context } = await supabase
        .from('user_generation_context')
        .select('*')
        .eq('user_id', ctx.userId)
        .single();

      if (!context || !context.core_themes || context.core_themes.length === 0) {
        return {
          success: false,
          error: 'Please analyze your context first. Go back to the Context step and analyze your brand URLs.',
        };
      }

      try {
        const themes = await AIAgentService.generateWeeklyThemes(
          {
            coreThemes: Array.isArray(context.core_themes) ? context.core_themes : [],
            brandVoice: context.brand_voice || 'Professional and engaging',
            targetAudience: context.target_audience || 'General audience',
            keyTopics: Array.isArray(context.core_themes) ? context.core_themes : [],
          },
          input.userPreferences,
          input.useClaude
        );

        // Save themes to database for the user's selected month
        const monthYear = input.monthYear;

        await Promise.all(
          themes.map((theme) =>
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
      const supabase = getServerSupabase();

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
      const supabase = getServerSupabase();

      await supabase
        .from('user_weekly_themes')
        .update({ approved: true })
        .eq('user_id', ctx.userId)
        .eq('month_year', input.monthYear);

      return { success: true };
    }),

  // Step 3: Generate all prompts for a month
  generatePrompts: protectedProcedure
    .input(
      z.object({
        startDate: z.string(),
        endDate: z.string(),
        useClaude: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const supabase = getServerSupabase();

      // SECURITY: Check if user has credits for Claude generation
      const creditCheck = await checkCredits(ctx.userId, input.useClaude);
      if (!creditCheck.allowed) {
        return {
          success: false,
          error: creditCheck.error,
          needsCredits: creditCheck.needsCredits,
        };
      }

      // Create job record
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
          .update({ status: 'generating_prompts' })
          .eq('id', job.id);

        // Generate all prompts
        const prompts = await AIAgentService.generateAllPrompts(
          input.startDate,
          input.endDate,
          themes,
          {
            coreThemes: context.core_themes || [],
            brandVoice: context.brand_voice || '',
            targetAudience: context.target_audience || '',
            keyTopics: context.core_themes || [],
          },
          input.useClaude
        );

        // Save prompts to database
        await supabase.from('user_prompts').insert(
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

        // Deduct 1 credit for Claude generations BEFORE marking complete (admins exempt)
        // This ensures atomicity: if credit deduction fails, job stays incomplete
        if (input.useClaude && !isAdmin(ctx.userId)) {
          const { error: creditError } = await supabase
            .rpc('decrement_claude_credits', { user_id_param: ctx.userId });

          if (creditError) {
            SafeLogger.error('Credit deduction failed:', creditError);
            throw new Error('Failed to deduct credit: ' + creditError.message);
          }
        }

        // Mark job as completed (only after successful credit deduction)
        await supabase
          .from('agent_generation_jobs')
          .update({
            status: 'completed',
            total_prompts: prompts.length,
          })
          .eq('id', job.id);

        return {
          success: true,
          jobId: job.id,
          totalPrompts: prompts.length,
        };
      } catch (error: any) {
        SafeLogger.error('Prompt generation error:', error);

        // Mark job as failed
        await supabase
          .from('agent_generation_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
          })
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
      const supabase = getServerSupabase();

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
      const supabase = getServerSupabase();

      const updateData: any = {};
      if (input.prompts) updateData.prompts = input.prompts;
      if (input.status) updateData.status = input.status;

      const { data, error } = await supabase
        .from('user_prompts')
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
      const supabase = getServerSupabase();

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
      const supabase = getServerSupabase();

      const { data } = await supabase
        .from('agent_generation_jobs')
        .select('*')
        .eq('id', input.jobId)
        .eq('user_id', ctx.userId)
        .single();

      return data;
    }),
});
