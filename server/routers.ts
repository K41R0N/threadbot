import { router, protectedProcedure } from './trpc';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase';
import { TelegramService } from './services/telegram';
import { BotService } from './services/bot';

export const appRouter = router({
  bot: router({
    // Get user's bot configuration
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      const supabase = getServerSupabase();
      
      const { data, error } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('user_id', ctx.userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new Error(`Failed to fetch bot config: ${error.message}`);
      }
      
      return data;
    }),

    // Get user's bot state
    getState: protectedProcedure.query(async ({ ctx }) => {
      const supabase = getServerSupabase();
      
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
        telegramBotToken: z.string(),
        telegramChatId: z.string(),
        timezone: z.string(),
        morningTime: z.string(),
        eveningTime: z.string(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = getServerSupabase();
        
        const { data, error } = await supabase
          .from('bot_configs')
          .insert({
            user_id: ctx.userId,
            notion_token: input.notionToken,
            notion_database_id: input.notionDatabaseId,
            telegram_bot_token: input.telegramBotToken,
            telegram_chat_id: input.telegramChatId,
            timezone: input.timezone,
            morning_time: input.morningTime,
            evening_time: input.eveningTime,
            is_active: input.isActive,
          })
          .select()
          .single();
        
        if (error) {
          throw new Error(`Failed to create bot config: ${error.message}`);
        }
        
        // Initialize bot state
        await supabase
          .from('bot_state')
          .insert({
            user_id: ctx.userId,
          });
        
        return data;
      }),

    // Update bot configuration
    updateConfig: protectedProcedure
      .input(z.object({
        notionToken: z.string().optional(),
        notionDatabaseId: z.string().optional(),
        telegramBotToken: z.string().optional(),
        telegramChatId: z.string().optional(),
        timezone: z.string().optional(),
        morningTime: z.string().optional(),
        eveningTime: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = getServerSupabase();
        
        const updateData: any = {};
        if (input.notionToken) updateData.notion_token = input.notionToken;
        if (input.notionDatabaseId) updateData.notion_database_id = input.notionDatabaseId;
        if (input.telegramBotToken) updateData.telegram_bot_token = input.telegramBotToken;
        if (input.telegramChatId) updateData.telegram_chat_id = input.telegramChatId;
        if (input.timezone) updateData.timezone = input.timezone;
        if (input.morningTime) updateData.morning_time = input.morningTime;
        if (input.eveningTime) updateData.evening_time = input.eveningTime;
        if (input.isActive !== undefined) updateData.is_active = input.isActive;
        
        const { data, error } = await supabase
          .from('bot_configs')
          .update(updateData)
          .eq('user_id', ctx.userId)
          .select()
          .single();
        
        if (error) {
          throw new Error(`Failed to update bot config: ${error.message}`);
        }
        
        return data;
      }),

    // Set up Telegram webhook
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
        const supabase = getServerSupabase();
        
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
});

export type AppRouter = typeof appRouter;
