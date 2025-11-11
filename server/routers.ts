import { router, protectedProcedure } from './trpc';
import { z } from 'zod';
import { serverSupabase } from '@/lib/supabase-server';
import { TelegramService } from './services/telegram';
import { NotionService } from './services/notion';
import { BotService } from './services/bot';
import { agentRouter } from './routers/agent';
import type { Database } from '@/lib/database.types';
import type { BotConfig } from '@/lib/supabase';
import { format, toZonedTime } from 'date-fns-tz';
import { SafeLogger } from '@/lib/logger';

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
    // UPSERT: Creates config if it doesn't exist (for AI-only users)
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

        // Check if config exists
        const { data: existingConfig } = await supabase
          .from('bot_configs')
          .select('id')
          .eq('user_id', ctx.userId)
          .single();

        if (existingConfig) {
          // UPDATE existing config
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

          return data;
        } else {
          // CREATE new config for AI-only users
          const insertData: Database['public']['Tables']['bot_configs']['Insert'] = {
            user_id: ctx.userId,
            notion_token: input.notionToken || null,
            notion_database_id: input.notionDatabaseId || null,
            telegram_bot_token: input.telegramBotToken || null,
            telegram_chat_id: input.telegramChatId || null,
            timezone: input.timezone || 'UTC',
            morning_time: input.morningTime || '09:00',
            evening_time: input.eveningTime || '18:00',
            is_active: input.isActive !== undefined ? input.isActive : false,
            prompt_source: input.promptSource || 'agent',
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

          return data;
        }
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

    // Test Telegram prompt sending with detailed logging
    testTelegramPrompt: protectedProcedure.mutation(async ({ ctx }) => {
      const supabase = serverSupabase;

      SafeLogger.info('=== TEST TELEGRAM PROMPT START ===', { userId: ctx.userId });

      // Step 1: Check if bot config exists
      const { data: config, error: configError } = await supabase
        .from('bot_configs')
        .select('*')
        .eq('user_id', ctx.userId)
        .single();

      if (configError) {
        SafeLogger.error('Bot config not found', {
          userId: ctx.userId,
          error: configError
        });
        return {
          success: false,
          message: 'Bot configuration not found. Please configure your bot in Settings.',
          logs: ['❌ Bot config not found'],
        };
      }

      const logs: string[] = [];
      logs.push('✅ Bot config found');

      const botConfig = config as BotConfig;

      // Step 2: Check if bot is active
      SafeLogger.info('Bot config status', {
        isActive: botConfig.is_active,
        promptSource: botConfig.prompt_source,
        hasTelegramToken: !!botConfig.telegram_bot_token,
        hasTelegramChatId: !!botConfig.telegram_chat_id,
      });

      logs.push(`📊 Bot active: ${botConfig.is_active ? 'Yes' : 'No'}`);
      logs.push(`📡 Prompt source: ${botConfig.prompt_source}`);

      // Step 3: Check Telegram credentials
      if (!botConfig.telegram_bot_token) {
        SafeLogger.error('Telegram bot token missing');
        return {
          success: false,
          message: 'Telegram bot token not configured',
          logs: [...logs, '❌ Telegram bot token missing'],
        };
      }
      logs.push('✅ Telegram bot token configured');

      if (!botConfig.telegram_chat_id) {
        SafeLogger.error('Telegram chat ID missing');
        return {
          success: false,
          message: 'Telegram chat ID not configured',
          logs: [...logs, '❌ Telegram chat ID missing'],
        };
      }
      logs.push('✅ Telegram chat ID configured');

      // Step 4: Find closest prompt
      SafeLogger.info('Searching for prompts', { source: botConfig.prompt_source });

      let promptContent: string | null = null;
      let promptTopic: string = 'Test Prompt';
      let promptDate: string = 'Today';

      try {
        if (botConfig.prompt_source === 'agent') {
          // Find closest prompt from agent database
          const { data: prompts, error: promptError } = await supabase
            .from('user_prompts')
            .select('*')
            .eq('user_id', ctx.userId)
            .order('date', { ascending: false })
            .limit(1);

          if (promptError) {
            SafeLogger.error('Failed to fetch agent prompts', { error: promptError });
            logs.push('❌ Failed to fetch agent prompts');
            throw new Error(`Failed to fetch agent prompts: ${promptError.message}`);
          }

          if (!prompts || prompts.length === 0) {
            SafeLogger.warn('No agent prompts found');
            logs.push('⚠️ No agent prompts found');
            return {
              success: false,
              message: 'No agent prompts found. Please generate prompts first.',
              logs,
            };
          }

          const prompt = prompts[0];
          // @ts-expect-error Supabase v2.80.0 type inference issue
          if (prompt.prompts && prompt.prompts.length > 0) {
            // @ts-expect-error Supabase v2.80.0 type inference issue
            promptContent = prompt.prompts
              .map((p: string, i: number) => `${i + 1}. ${p}`)
              .join('\n');
            // @ts-expect-error Supabase v2.80.0 type inference issue
            promptTopic = prompt.week_theme || 'Test Prompt';
            // @ts-expect-error Supabase v2.80.0 type inference issue
            promptDate = prompt.date;
            // @ts-expect-error Supabase v2.80.0 type inference issue
            logs.push(`✅ Found agent prompt for ${prompt.date}`);
            SafeLogger.info('Agent prompt found', {
              // @ts-expect-error Supabase v2.80.0 type inference issue
              date: prompt.date,
              // @ts-expect-error Supabase v2.80.0 type inference issue
              theme: prompt.week_theme
            });
          } else {
            throw new Error('Prompt content is empty');
          }
        } else {
          // Find prompt from Notion database
          if (!botConfig.notion_token || !botConfig.notion_database_id) {
            SafeLogger.error('Notion credentials missing');
            logs.push('❌ Notion token or database ID missing');
            return {
              success: false,
              message: 'Notion token or database ID not configured',
              logs,
            };
          }

          logs.push('✅ Notion credentials configured');

          const notion = new NotionService(botConfig.notion_token);
          const now = new Date();
          const zonedDate = toZonedTime(now, botConfig.timezone);
          const dateString = format(zonedDate, 'yyyy-MM-dd');

          // Try morning first, then evening
          let page = await notion.queryDatabase(
            botConfig.notion_database_id,
            dateString,
            'morning'
          );

          if (!page) {
            page = await notion.queryDatabase(
              botConfig.notion_database_id,
              dateString,
              'evening'
            );
          }

          if (!page) {
            SafeLogger.warn('No Notion prompt found for today');
            logs.push('⚠️ No Notion prompt found for today');
            return {
              success: false,
              message: 'No Notion prompt found for today',
              logs,
            };
          }

          promptContent = await notion.getPageContent(page.id);

          if (!promptContent) {
            SafeLogger.warn('Notion page is empty');
            logs.push('⚠️ Notion page is empty');
            return {
              success: false,
              message: 'Notion page is empty',
              logs,
            };
          }

          const pageProps = page.properties as any;
          promptTopic =
            pageProps.Topic?.rich_text?.[0]?.plain_text ||
            pageProps.Week?.rich_text?.[0]?.plain_text ||
            pageProps.Name?.title?.[0]?.plain_text ||
            'Daily Prompt';
          promptDate = dateString;

          logs.push(`✅ Found Notion prompt for ${dateString}`);
          SafeLogger.info('Notion prompt found', { date: dateString, topic: promptTopic });
        }

        // Step 5: Send via Telegram
        if (!promptContent) {
          throw new Error('No prompt content available');
        }

        logs.push('📤 Sending to Telegram...');
        SafeLogger.info('Sending test prompt to Telegram', {
          chatId: botConfig.telegram_chat_id
        });

        const telegram = new TelegramService(botConfig.telegram_bot_token);
        const escapedTopic = TelegramService.escapeMarkdown(promptTopic);
        const escapedContent = TelegramService.escapeMarkdown(promptContent);

        const message = `🧪 *TEST PROMPT*\n\n📅 ${promptDate}\n🎯 ${escapedTopic}\n\n${escapedContent}\n\n✅ Your Telegram bot is working correctly\\!`;

        await telegram.sendMessage(botConfig.telegram_chat_id, message);

        logs.push('✅ Message sent successfully!');
        SafeLogger.info('Test prompt sent successfully');

        return {
          success: true,
          message: 'Test prompt sent successfully! Check your Telegram.',
          logs,
        };
      } catch (error: any) {
        SafeLogger.error('Test prompt failed', { error });
        logs.push(`❌ Error: ${error.message}`);

        return {
          success: false,
          message: `Failed to send test prompt: ${error.message}`,
          logs,
        };
      }
    }),
  }),

  // Agent router for AI-powered prompt generation
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
