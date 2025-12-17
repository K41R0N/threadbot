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
          .select('id, is_active')
          .eq('user_id', ctx.userId)
          .single();

        // Type assertion for Supabase query result
        const configData = existingConfig as { id: string; is_active: boolean } | null;

        if (configData) {
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

          // AUTO-ACTIVATION: If Telegram chat ID is being set and bot was inactive, auto-activate
          if (input.telegramChatId && !configData.is_active && input.isActive === undefined) {
            // Check if user has prompts (AI path) - if so, auto-activate
            const { data: prompts } = await supabase
              .from('user_prompts')
              .select('id')
              .eq('user_id', ctx.userId)
              .limit(1);
            
            if (prompts && prompts.length > 0) {
              // User has prompts, auto-activate bot
              updateData.is_active = true;
              // Auto-set prompt_source to agent if not explicitly set
              if (!input.promptSource) {
                updateData.prompt_source = 'agent';
              }
              SafeLogger.info('Auto-activating bot after Telegram connection', { userId: ctx.userId });
            }
          }

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
          // Check if user has prompts - if so, auto-activate
          const { data: prompts } = await supabase
            .from('user_prompts')
            .select('id')
            .eq('user_id', ctx.userId)
            .limit(1);
          
          const hasPrompts = prompts && prompts.length > 0;
          const shouldAutoActivate = hasPrompts && input.telegramChatId && input.isActive === undefined;

          const insertData: Database['public']['Tables']['bot_configs']['Insert'] = {
            user_id: ctx.userId,
            notion_token: input.notionToken || null,
            notion_database_id: input.notionDatabaseId || null,
            telegram_bot_token: input.telegramBotToken || null,
            telegram_chat_id: input.telegramChatId || null,
            timezone: input.timezone || 'America/New_York', // Match schema default
            morning_time: input.morningTime || '09:00',
            evening_time: input.eveningTime || '18:00',
            is_active: shouldAutoActivate ? true : (input.isActive !== undefined ? input.isActive : false),
            prompt_source: input.promptSource || (hasPrompts ? 'agent' : 'notion'),
          };

          const { data, error } = await supabase
            .from('bot_configs')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .insert(insertData)
            .select('id, user_id, notion_database_id, telegram_chat_id, timezone, morning_time, evening_time, is_active, prompt_source, last_webhook_setup_at, last_webhook_status, last_webhook_error, created_at, updated_at')
            .single();

          if (error) {
            SafeLogger.error('Failed to create bot configuration', {
              userId: ctx.userId,
              error: error.message,
              errorCode: error.code,
              errorDetails: error.details,
            });
            throw new Error(`Failed to create bot configuration: ${error.message}`);
          }

          // Initialize bot state (use upsert to handle existing state gracefully)
          const stateData: Database['public']['Tables']['bot_state']['Insert'] = {
            user_id: ctx.userId,
          };

          const { error: stateError } = await supabase
            .from('bot_state')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .upsert(stateData, { onConflict: 'user_id' });

          if (stateError) {
            SafeLogger.warn('Failed to initialize bot state (non-critical)', {
              userId: ctx.userId,
              error: stateError.message,
            });
            // Don't throw - bot state initialization is non-critical
          }

          return data;
        }
      }),

    // Set up Telegram webhook (shared bot - sets webhook once for all users)
    setupWebhookForUser: protectedProcedure.mutation(async ({ ctx }) => {
      const supabase = serverSupabase;

      // Verify user has chat ID configured
      const { data: config, error } = await supabase
        .from('bot_configs')
        .select('telegram_chat_id, user_id')
        .eq('user_id', ctx.userId)
        .single();

      // Type assertion for Supabase query result
      const configData = config as { telegram_chat_id: string | null; user_id: string } | null;

      // If config doesn't exist or chat ID is missing, return helpful error
      if (error || !configData || !configData.telegram_chat_id) {
        return {
          success: false,
          message: 'Telegram chat ID not configured. Please connect your Telegram account first using the verification code.',
        };
      }

      try {
        // Shared webhook URL for all users (routes by chat ID)
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`;
        const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

        // Use shared bot token from environment
        const telegram = new TelegramService();
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        // Persist webhook error
        const webhookError: Database['public']['Tables']['bot_configs']['Update'] = {
          last_webhook_setup_at: new Date().toISOString(),
          last_webhook_status: 'failed',
          last_webhook_error: message,
        };

        await supabase
          .from('bot_configs')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update(webhookError)
          .eq('user_id', ctx.userId);

        return {
          success: false,
          message,
        };
      }
    }),

    // Send test prompt (today's prompt)
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

    // Send a specific prompt by date (for early/manual sending)
    sendPromptByDate: protectedProcedure
      .input(z.object({
        date: z.string(), // ISO date string (YYYY-MM-DD)
        type: z.enum(['morning', 'evening']),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = serverSupabase;

        // SECURITY: Rate limit to prevent Telegram API abuse (10 sends per hour per user)
        const cooldownKey = `send:${ctx.userId}:${input.date}:${input.type}`;
        const { data: lastSendRecord } = await supabase
          .from('send_cooldowns')
          .select('last_sent_at, send_count')
          .eq('user_id', ctx.userId)
          .eq('cooldown_key', cooldownKey)
          .single();

        const now = new Date();
        const lastSent = lastSendRecord?.last_sent_at ? new Date(lastSendRecord.last_sent_at) : null;
        const sendCount = lastSendRecord?.send_count || 0;

        // Reset counter if last send was over 1 hour ago
        const resetSendCount = lastSent && (now.getTime() - lastSent.getTime()) > 3600000;

        if (!resetSendCount && sendCount >= 10) {
          return {
            success: false,
            message: 'Rate limit exceeded. You can send up to 10 prompts per hour. Please try again later.',
          };
        }

        // Check minimum cooldown between sends (30 seconds)
        if (lastSent && (now.getTime() - lastSent.getTime()) < 30000) {
          const secondsRemaining = Math.ceil((30000 - (now.getTime() - lastSent.getTime())) / 1000);
          return {
            success: false,
            message: `Please wait ${secondsRemaining} seconds before sending another prompt.`,
          };
        }

        const { data, error } = await supabase
          .from('bot_configs')
          .select('*')
          .eq('user_id', ctx.userId)
          .single();

        if (error || !data) {
          return {
            success: false,
            message: 'Bot configuration not found',
          };
        }

        const config = data as BotConfig;
        if (!config.telegram_chat_id) {
          return {
            success: false,
            message: 'Telegram not connected. Please connect Telegram in Settings.',
          };
        }

        // Send the prompt
        const result = await BotService.sendPromptByDate(config, input.date, input.type);

        // Update cooldown tracking
        if (result.success) {
          await supabase
            .from('send_cooldowns')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .upsert({
              user_id: ctx.userId,
              cooldown_key,
              send_count: resetSendCount ? 1 : sendCount + 1,
              last_sent_at: now.toISOString(),
            });
        }

        return result;
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
        hasTelegramChatId: !!botConfig.telegram_chat_id,
      });

      logs.push(`📊 Bot active: ${botConfig.is_active ? 'Yes' : 'No'}`);
      logs.push(`📡 Prompt source: ${botConfig.prompt_source}`);

      // Step 3: Check Telegram credentials (shared bot - no token needed in config)
      // Verify shared bot token is configured in environment
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        SafeLogger.error('TELEGRAM_BOT_TOKEN environment variable not configured');
        return {
          success: false,
          message: 'Telegram bot is not configured. Please contact support.',
          logs: [...logs, '❌ Shared Telegram bot token not configured'],
        };
      }
      logs.push('✅ Shared Telegram bot configured');

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

          const prompt = prompts[0] as any;

          // Runtime validation: Ensure prompt has required structure
          if (!prompt.prompts || !Array.isArray(prompt.prompts) || prompt.prompts.length === 0) {
            SafeLogger.warn('Agent prompt has no content', { promptId: prompt.id });
            logs.push('⚠️ Agent prompt has no content');
            return {
              success: false,
              message: 'Agent prompt is empty. Please regenerate prompts.',
              logs,
            };
          }

          if (!prompt.date) {
            SafeLogger.warn('Agent prompt missing date field', { promptId: prompt.id });
            logs.push('⚠️ Agent prompt missing date field');
            return {
              success: false,
              message: 'Agent prompt data is malformed. Please regenerate prompts.',
              logs,
            };
          }

          promptContent = prompt.prompts
            .map((p: string, i: number) => `${i + 1}. ${p}`)
            .join('\n');
          promptTopic = prompt.week_theme || 'Daily Reflection';
          promptDate = prompt.date;

          logs.push(`✅ Found agent prompt for ${prompt.date}`);
          SafeLogger.info('Agent prompt found', {
            date: prompt.date,
            theme: prompt.week_theme || 'Daily Reflection',
            promptCount: prompt.prompts.length
          });
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
        // Final validation: Ensure we have content and required fields
        if (!promptContent || promptContent.trim() === '') {
          SafeLogger.error('No prompt content after fetch', { source: botConfig.prompt_source });
          logs.push('❌ No prompt content available');
          return {
            success: false,
            message: 'Failed to retrieve prompt content',
            logs,
          };
        }

        if (!promptDate) {
          SafeLogger.error('No prompt date after fetch', { source: botConfig.prompt_source });
          logs.push('❌ Prompt date missing');
          return {
            success: false,
            message: 'Prompt data is incomplete',
            logs,
          };
        }

        logs.push('📤 Sending to Telegram...');
        SafeLogger.info('Sending test prompt to Telegram', {
          chatId: botConfig.telegram_chat_id
        });

        // Use shared bot token from environment
        const telegram = new TelegramService();
        const escapedTopic = TelegramService.escapeMarkdown(promptTopic);
        const escapedContent = TelegramService.escapeMarkdown(promptContent);
        const escapedDate = TelegramService.escapeMarkdown(promptDate);

        const message = `🧪 *TEST PROMPT*\n\n📅 ${escapedDate}\n🎯 ${escapedTopic}\n\n${escapedContent}\n\n✅ Your Telegram bot is working correctly\\!`;

        await telegram.sendMessage(botConfig.telegram_chat_id, message);

        logs.push('✅ Message sent successfully!');
        SafeLogger.info('Test prompt sent successfully');

        return {
          success: true,
          message: 'Test prompt sent successfully! Check your Telegram.',
          logs,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        SafeLogger.error('Test prompt failed', { error });
        logs.push(`❌ Error: ${message}`);

        return {
          success: false,
          message: `Failed to send test prompt: ${message}`,
          logs,
        };
      }
    }),

    // Purge all user data but preserve subscription/credits
    purgeData: protectedProcedure.mutation(async ({ ctx }) => {
      const supabase = serverSupabase;

      SafeLogger.info('=== DATA PURGE REQUEST ===', { userId: ctx.userId });

      try {
        // Delete from all data tables (preserve user_subscriptions)
        const tables = [
          'bot_configs',
          'bot_state',
          'user_prompts',
          'user_generation_context',
          'user_weekly_themes',
          'agent_generation_jobs',
          'telegram_verification_codes', // Clear old verification codes
        ];

        const failedTables: string[] = [];
        const successTables: string[] = [];

        for (const table of tables) {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('user_id', ctx.userId);

          if (error) {
            SafeLogger.error(`Failed to purge ${table}`, { userId: ctx.userId, error });
            failedTables.push(table);
          } else {
            SafeLogger.info(`Purged ${table}`, { userId: ctx.userId });
            successTables.push(table);
          }
        }

        // Report failure if ANY table failed to purge
        if (failedTables.length > 0) {
          SafeLogger.error('Data purge incomplete - some tables failed', {
            userId: ctx.userId,
            failedTables,
            successTables,
          });

          return {
            success: false,
            message: `Data purge incomplete. Failed to purge: ${failedTables.join(', ')}. Successfully purged: ${successTables.join(', ')}. Your subscription and credits are preserved. Please contact support for manual cleanup.`,
          };
        }

        SafeLogger.info('Data purge completed successfully', { userId: ctx.userId });

        return {
          success: true,
          message: 'All data has been purged. Your subscription and credits are preserved.',
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        SafeLogger.error('Data purge failed', { userId: ctx.userId, error });
        return {
          success: false,
          message: `Failed to purge data: ${message}`,
        };
      }
    }),

    // Delete account completely (including subscription)
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      const supabase = serverSupabase;

      SafeLogger.info('=== ACCOUNT DELETION REQUEST ===', { userId: ctx.userId });

      try {
        // Delete from ALL tables including subscriptions
        const tables = [
          'bot_configs',
          'bot_state',
          'user_prompts',
          'user_generation_context',
          'user_weekly_themes',
          'agent_generation_jobs',
          'user_subscriptions',
        ];

        const failedTables: string[] = [];
        const successTables: string[] = [];

        for (const table of tables) {
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('user_id', ctx.userId);

          if (error) {
            SafeLogger.error(`Failed to delete from ${table}`, { userId: ctx.userId, error });
            failedTables.push(table);
          } else {
            SafeLogger.info(`Deleted from ${table}`, { userId: ctx.userId });
            successTables.push(table);
          }
        }

        // Report failure if ANY table failed to delete
        if (failedTables.length > 0) {
          SafeLogger.error('Account deletion incomplete - some tables failed', {
            userId: ctx.userId,
            failedTables,
            successTables,
          });

          return {
            success: false,
            message: `Account deletion incomplete. Failed to delete from: ${failedTables.join(', ')}. Successfully deleted from: ${successTables.join(', ')}. Please contact support for manual cleanup.`,
          };
        }

        SafeLogger.info('Account deletion completed successfully', { userId: ctx.userId });

        return {
          success: true,
          message: 'Your account data has been deleted from our database. You can now delete your account from Clerk if desired.',
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        SafeLogger.error('Account deletion failed', { userId: ctx.userId, error });
        return {
          success: false,
          message: `Failed to delete account: ${message}`,
        };
      }
    }),

    // Quick setup: Connect Telegram and auto-configure everything
    quickSetup: protectedProcedure
      .input(z.object({
        telegramChatId: z.string(),
        timezone: z.string().optional(),
        morningTime: z.string().optional(),
        eveningTime: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const supabase = serverSupabase;

        // Detect timezone if not provided
        const timezone = input.timezone || 'America/New_York'; // Default, can be improved with browser detection
        const morningTime = input.morningTime || '09:00';
        const eveningTime = input.eveningTime || '18:00';

        // Check if user has prompts (AI path)
        const { data: prompts } = await supabase
          .from('user_prompts')
          .select('id')
          .eq('user_id', ctx.userId)
          .limit(1);
        
        const hasPrompts = prompts && prompts.length > 0;

        // Update or create config with auto-activation
        const { data: existingConfig } = await supabase
          .from('bot_configs')
          .select('id, is_active')
          .eq('user_id', ctx.userId)
          .single();

        // Type assertion for Supabase query result
        const configData = existingConfig as { id: string; is_active: boolean } | null;

        const updateData: Database['public']['Tables']['bot_configs']['Update'] = {
          telegram_chat_id: input.telegramChatId,
          timezone,
          morning_time: morningTime,
          evening_time: eveningTime,
          prompt_source: hasPrompts ? 'agent' : 'notion',
          // Auto-activate if user has prompts
          is_active: hasPrompts ? true : false,
        };

        if (configData) {
          await supabase
            .from('bot_configs')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .update(updateData)
            .eq('user_id', ctx.userId);
        } else {
          await supabase
            .from('bot_configs')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .insert({
              user_id: ctx.userId,
              ...updateData,
              notion_token: null,
              notion_database_id: null,
              telegram_bot_token: null,
            });

          // Initialize bot state
          await supabase
            .from('bot_state')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .insert({ user_id: ctx.userId });
        }

        // Setup webhook
        const telegram = new TelegramService();
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`;
        const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
        await telegram.setWebhook(webhookUrl, secretToken);

        return {
          success: true,
          activated: hasPrompts,
          message: hasPrompts 
            ? 'Bot is now active! You\'ll receive prompts daily.' 
            : 'Telegram connected. Activate bot in Settings to start receiving prompts.',
        };
      }),

    // Generate verification code for Telegram linking
    generateVerificationCode: protectedProcedure
      .input(z.object({
        timezone: z.string().optional(), // Optional timezone from browser detection
      }).optional().default({}))
      .mutation(async ({ ctx, input }) => {
        const supabase = serverSupabase;

        // RESET: Clear bot conversation state when generating verification code
        // This ensures a fresh start and prevents old conversation state from interfering
        await supabase
          .from('bot_state')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update({
            last_prompt_type: null,
            last_prompt_sent_at: null,
            last_prompt_page_id: null,
          })
          .eq('user_id', ctx.userId);

        SafeLogger.info('Reset bot state for verification', { userId: ctx.userId });

        // Clean up old/expired verification codes for this user
        // Delete all codes for this user (we'll create a fresh one)
        // This prevents confusion from multiple active codes
        await supabase
          .from('telegram_verification_codes')
          .delete()
          .eq('user_id', ctx.userId);

        // Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Store code with 10-minute expiration
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        const { data, error } = await supabase
          .from('telegram_verification_codes')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .insert({
            user_id: ctx.userId,
            code,
            timezone: input?.timezone || null, // Store detected timezone if provided
            expires_at: expiresAt.toISOString(),
          })
          .select('code, expires_at')
          .single();

        if (error) {
          SafeLogger.error('Failed to generate verification code', {
            userId: ctx.userId,
            error: error.message,
            errorCode: error.code,
            errorDetails: error.details,
          });
          throw new Error(`Failed to generate verification code: ${error.message}`);
        }

        // Type assertion for Supabase query result
        const codeData = data as { code: string; expires_at: string } | null;

        if (!codeData) {
          throw new Error('Failed to generate verification code');
        }

        return {
          code: codeData.code,
          expiresAt: codeData.expires_at,
        };
      }),

    // Check if chat ID was linked (for polling)
    checkChatIdLinked: protectedProcedure.query(async ({ ctx }) => {
      const supabase = serverSupabase;

      const { data: config } = await supabase
        .from('bot_configs')
        .select('telegram_chat_id')
        .eq('user_id', ctx.userId)
        .single();

      // Type assertion for Supabase query result
      const configData = config as { telegram_chat_id: string | null } | null;

      return {
        linked: !!configData?.telegram_chat_id,
        chatId: configData?.telegram_chat_id || null,
      };
    }),
  }),

  // Agent router for AI-powered prompt generation
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
