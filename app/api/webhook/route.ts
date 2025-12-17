import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase-server';
import { BotService } from '@/server/services/bot';
import { TelegramService } from '@/server/services/telegram';
import { SafeLogger } from '@/lib/logger';
import type { BotConfig } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

// Set function timeout to 10 seconds
export const maxDuration = 10;

/**
 * Shared webhook endpoint for all users
 * Routes messages to users based on Telegram chat ID
 */
export async function POST(request: NextRequest) {
  try {
    SafeLogger.info('Shared webhook received');

    // SECURITY: Verify request is from Telegram using secret token
    const telegramSecretToken = request.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecretToken && telegramSecretToken !== expectedSecretToken) {
      SafeLogger.warn('Unauthorized webhook request attempt', {
        ip: request.headers.get('x-forwarded-for'),
        hasToken: !!telegramSecretToken,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse Telegram update
    const update = await request.json();
    SafeLogger.info('Telegram update received', {
      hasMessage: !!update.message,
      hasText: !!update.message?.text,
      chatId: update.message?.chat?.id,
    });

    // Extract message
    const message = update.message;
    if (!message || !message.text) {
      SafeLogger.info('Ignoring non-text message');
      return NextResponse.json({ ok: true }); // Ignore non-text messages
    }

    const chatId = message.chat.id.toString();
    const messageText = message.text.trim().toLowerCase();

    const supabase = serverSupabase;

    // Check if this is a verification code (6-digit number or "hello" + code)
    const verificationCodeMatch = messageText.match(/(\d{6})/);
    const isHello = messageText.includes('hello') || messageText.includes('hi') || messageText.includes('hey');
    
    // Try to find verification code first
    if (verificationCodeMatch || isHello) {
      const code = verificationCodeMatch ? verificationCodeMatch[1] : null;
      
      // Look for active verification code
      let verificationQuery = supabase
        .from('telegram_verification_codes')
        .select('id, user_id, code, expires_at, timezone')
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString());

      if (code) {
        verificationQuery = verificationQuery.eq('code', code);
      } else if (isHello) {
        // If just "hello", get the most recent unexpired code
        verificationQuery = verificationQuery.order('created_at', { ascending: false });
      }

      const { data: verificationData } = await verificationQuery.limit(1);

      if (verificationData && verificationData.length > 0) {
        const verification = verificationData[0] as { id: string; user_id: string; code: string; expires_at: string; timezone: string | null };
        
        // Mark code as used and link chat ID
        await supabase
          .from('telegram_verification_codes')
          // @ts-expect-error Supabase v2.80.0 type inference issue
          .update({
            used_at: new Date().toISOString(),
            chat_id: chatId,
          })
          .eq('id', verification.id);

        // Check if user has prompts (AI path)
        const { data: prompts } = await supabase
          .from('user_prompts')
          .select('id')
          .eq('user_id', verification.user_id)
          .limit(1);
        
        const hasPrompts = prompts && prompts.length > 0;

        // Update or create bot config with chat ID and auto-activate if user has prompts
        const { data: existingConfig } = await supabase
          .from('bot_configs')
          .select('id, is_active')
          .eq('user_id', verification.user_id)
          .single();

        // Use detected timezone from verification code, or fall back to default
        const detectedTimezone = verification.timezone || 'America/New_York';

        const configUpdate: Database['public']['Tables']['bot_configs']['Update'] = {
          telegram_chat_id: chatId,
          // Auto-activate if user has prompts
          is_active: hasPrompts ? true : (existingConfig?.is_active || false),
          prompt_source: hasPrompts ? 'agent' : 'notion',
          // Set defaults if creating new config
          ...(existingConfig ? {} : {
            timezone: detectedTimezone, // Use detected timezone from browser
            morning_time: '09:00',
            evening_time: '18:00',
            notion_token: null,
            notion_database_id: null,
            telegram_bot_token: null,
          }),
        };

        if (existingConfig) {
          // Update existing config
          await supabase
            .from('bot_configs')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .update(configUpdate)
            .eq('user_id', verification.user_id);
        } else {
          // Create new config with smart defaults
          await supabase
            .from('bot_configs')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .insert({
              user_id: verification.user_id,
              ...configUpdate,
            });

          // Initialize bot state
          await supabase
            .from('bot_state')
            // @ts-expect-error Supabase v2.80.0 type inference issue
            .insert({ user_id: verification.user_id });
        }

        // Send confirmation message
        const telegram = new TelegramService();
        await telegram.sendMessage(
          chatId,
          `✅ *Account Linked\\!*\n\nYour Telegram account has been successfully linked to Threadbot\\. You can now receive prompts and log replies\\.`
        );

        SafeLogger.info('Chat ID linked via verification code', {
          userId: verification.user_id,
          chatId,
          code: code || 'hello',
        });

        return NextResponse.json({ ok: true });
      }
    }

    // Look up user by chat ID (existing flow)
    const { data, error } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .single();

    if (error || !data) {
      // If no user found and not a verification code, send helpful message
      if (!verificationCodeMatch && !isHello) {
        const telegram = new TelegramService();
        await telegram.sendMessage(
          chatId,
          `👋 *Hello\\!*\n\nTo link your account, please:\n\n1\\. Go to your Threadbot dashboard\n2\\. Click "Connect Telegram"\n3\\. Send the verification code here\n\nOr just say "hello" if you have an active verification code\\.`
        );
      }
      
      SafeLogger.warn('No user found for chat ID', { chatId, error: error?.message });
      return NextResponse.json({ ok: true });
    }

    const config = data as BotConfig;
    SafeLogger.info('User found for chat ID', { 
      userId: config.user_id, 
      chatId: config.telegram_chat_id 
    });

    // Handle the reply
    const result = await BotService.handleReply(config, message.text);

    if (!result.success) {
      SafeLogger.error('Failed to handle reply', { 
        userId: config.user_id, 
        error: result.message 
      });
    } else {
      SafeLogger.info('Reply handled successfully', { userId: config.user_id });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    SafeLogger.error('Webhook error', error);
    return NextResponse.json({ ok: true }); // Always return ok to Telegram
  }
}

