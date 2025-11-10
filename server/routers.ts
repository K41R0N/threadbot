import { router, protectedProcedure } from './trpc';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase-server';
import { TelegramService } from './services/telegram';
import { BotService } from './services/bot';
import { agentRouter } from './routers/agent';
import type { Database } from '@/lib/database.types';

export const appRouter = router({
  bot: router({
    // Get user's bot configuration (excluding sensitive tokens)
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      const supabase = serverSupabase;

      // SECURITY: Only select non-sensitive fields. Never send tokens to client!
      const { data, error } = await supabase
        .from('bot_configs')
        .select('id, user_id, notion_database_id, telegram_chat_id, timezone, morning_time, evening_time, is_active, prompt_source, last_webhook_setup_at, last_webhook_status, last_webhook_error, created_at, updated_at')
        .eq('user_id', ctx.userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new Error('Failed to fetch bot configuration');
      }

      return data;
    }),

    // Get user's bot state
    getState: protectedProcedure.query(async ({ ctx }) => {
      const supabase = serverSupabase;
      
      const { data, error } = await supabase
        .from('bot_state')
        .select('*')
        .eq('user_id', ctx.userId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to fetch bot state: ${error.message}`);
      }
      
      return data;
    }),

    // Create bot configuration
    createConfig: protectedProcedure
      .input(z.object({
        notionToken: z.string(),
        notionDatabaseId: z.string(),
        telegramBotToken: z.string().nullable().optional(),
        telegramChatId: z.string().nullable().optional(),
        timezone: z.string(),
        morningTime: z.string(),
        eveningTime: z.string(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = serverSupabase;

        const insertData: Database['public']['Tables']['bot_configs']['Insert'] = {
          user_id: ctx.userId,
          notion_token: input.notionToken,
          notion_database_id: input.notionDatabaseId,
          telegram_bot_token: input.telegramBotToken || null,
          telegram_chat_id: input.telegramChatId || null,
          timezone: input.timezone,
          morning_time: input.morningTime,
          evening_time: input.eveningTime,
          is_active: input.isActive,
          prompt_source: 'notion', // Default to notion for new configs
        };

        const { data, error } = await supabase
          .from('bot_configs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .insert(insertData)
          .select('id, user_id, notion_database_id, telegram_chat_id, timezone, morning_time, evening_time, is_active, prompt_source, last_webhook_setup_at, last_webhook_status, last_webhook_error, created_at, updated_at')
          .single();

        if (error) {
          throw new Error('Failed to create bot configuration');
        }

        // Initialize bot state
        const stateData: Database['public']['Tables']['bot_state']['Insert'] = {
          user_id: ctx.userId,
        };

        await supabase
          .from('bot_state')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .insert(stateData);

        // SECURITY: Return config without sensitive tokens
        return data;
      }),

    // Update bot configuration
    updateConfig: protectedProcedure
      .input(z.object({
        notionToken: z.string().nullable().optional(),
        notionDatabaseId: z.string().nullable().optional(),
        telegramBotToken: z.string().nullable().optional(),
        telegramChatId: z.string().nullable().optional(),
        timezone: z.string().optional(),
        morningTime: z.string().optional(),
        eveningTime: z.string().optional(),
        isActive: z.boolean().optional(),
        promptSource: z.enum(['notion', 'agent']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = serverSupabase;

        // Type-safe update data for bot_configs table
        const updateData: Database['public']['Tables']['bot_configs']['Update'] = {};
        // Support clearing tokens by distinguishing undefined (not provided) from null (clear)
        if (input.notionToken !== undefined) updateData.notion_token = input.notionToken;
        if (input.notionDatabaseId !== undefined) updateData.notion_database_id = input.notionDatabaseId;
        if (input.telegramBotToken !== undefined) updateData.telegram_bot_token = input.telegramBotToken;
        if (input.telegramChatId !== undefined) updateData.telegram_chat_id = input.telegramChatId;
        if (input.timezone) updateData.timezone = input.timezone;
        if (input.morningTime) updateData.morning_time = input.morningTime;
        if (input.eveningTime) updateData.evening_time = input.eveningTime;
        if (input.isActive !== undefined) updateData.is_active = input.isActive;
        if (input.promptSource) updateData.prompt_source = input.promptSource;
        
        const { data, error } = await supabase
          .from('bot_configs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update(updateData)
          .eq('user_id', ctx.userId)
          .select('id, user_id, notion_database_id, telegram_chat_id, timezone, morning_time, evening_time, is_active, prompt_source, last_webhook_setup_at, last_webhook_status, last_webhook_error, created_at, updated_at')
          .single();

        if (error) {
          throw new Error('Failed to update bot configuration');
        }

        // SECURITY: Return config without sensitive tokens
        return data;
      }),

    // Set up Telegram webhook (server-side, token never exposed to client)
    setupWebhookForUser: protectedProcedure.mutation(async ({ ctx }) => {
      const supabase = serverSupabase;

      // Get full config from database (server-side only)
      const { data: config, error } = await supabase
        .from('bot_configs')
        .select('telegram_bot_token, user_id')
        .eq('user_id', ctx.userId)
        .single();

      if (error || !config) {
        return {
          success: false,
          message: 'Bot configuration not found',
        };
      }

      try {
        // @ts-expect-error Supabase v2.80.0 type inference issue
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${config.user_id}`;
        const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

        // @ts-expect-error Supabase v2.80.0 type inference issue
        const telegram = new TelegramService(config.telegram_bot_token);
        const success = await telegram.setWebhook(webhookUrl, secretToken);

        // Persist webhook health status
        const webhookStatus: Database['public']['Tables']['bot_configs']['Update'] = {
          last_webhook_setup_at: new Date().toISOString(),
          last_webhook_status: success ? 'success' : 'failed',
          last_webhook_error: success ? null : 'Webhook setup returned false',
        };

        await supabase
          .from('bot_configs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update(webhookStatus)
          .eq('user_id', ctx.userId);

        return {
          success,
          message: success ? 'Webhook configured successfully' : 'Failed to configure webhook',
        };
      } catch (error: any) {
        // Persist webhook error
        const webhookError: Database['public']['Tables']['bot_configs']['Update'] = {
          last_webhook_setup_at: new Date().toISOString(),
          last_webhook_status: 'failed',
          last_webhook_error: error.message,
        };

        await supabase
          .from('bot_configs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update(webhookError)
          .eq('user_id', ctx.userId);

        return {
          success: false,
          message: error.message,
        };
      }
    }),

    // Set up Telegram webhook (legacy - for manual setup with token)
    setupWebhook: protectedProcedure
      .input(z.object({
        botToken: z.string(),
        webhookUrl: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const telegram = new TelegramService(input.botToken);
          const success = await telegram.setWebhook(input.webhookUrl);
          return {
            success,
            message: success ? 'Webhook set successfully' : 'Failed to set webhook',
          };
        } catch (error: any) {
          return {
            success: false,
            message: error.message,
          };
        }
      }),

    // Get webhook info
    getWebhookInfo: protectedProcedure
      .input(z.object({
        botToken: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const telegram = new TelegramService(input.botToken);
          const info = await telegram.getWebhookInfo();
          return {
            success: true,
            info,
          };
        } catch (error: any) {
          return {
            success: false,
            message: error.message,
          };
        }
      }),

    // Send test prompt
    testPrompt: protectedProcedure
      .input(z.object({
        type: z.enum(['morning', 'evening']),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = serverSupabase;
        
        const { data: config, error } = await supabase
          .from('bot_configs')
          .select('*')
          .eq('user_id', ctx.userId)
          .single();
        
        if (error || !config) {
          return {
            success: false,
            message: 'Bot configuration not found',
          };
        }
        
        return await BotService.sendScheduledPrompt(config, input.type);
      }),
  }),

  // Agent router for AI-powered prompt generation
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
