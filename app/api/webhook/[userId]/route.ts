import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase-server';
import { BotService } from '@/server/services/bot';
import { SafeLogger } from '@/lib/logger';
import type { BotConfig } from '@/lib/supabase';

// Set function timeout to 10 seconds
export const maxDuration = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    SafeLogger.info('Webhook received', { userId });

    // SECURITY: Verify request is from Telegram using secret token
    const telegramSecretToken = request.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecretToken && telegramSecretToken !== expectedSecretToken) {
      SafeLogger.warn('Unauthorized webhook request attempt', {
        userId,
        ip: request.headers.get('x-forwarded-for'),
        hasToken: !!telegramSecretToken,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse Telegram update
    const update = await request.json();
    SafeLogger.info('Telegram update received', {
      userId,
      hasMessage: !!update.message,
      hasText: !!update.message?.text
    });

    // Extract message
    const message = update.message;
    if (!message || !message.text) {
      SafeLogger.info('Ignoring non-text message', { userId });
      return NextResponse.json({ ok: true }); // Ignore non-text messages
    }

    // Get bot configuration for this user
    const supabase = serverSupabase;
    const { data, error } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      SafeLogger.error('Bot config not found for user', { userId, error });
      return NextResponse.json({ ok: true }); // Silently ignore to prevent Telegram retries
    }

    const config = data as BotConfig;
    SafeLogger.info('Bot config found', { userId, chatId: config.telegram_chat_id });

    // Verify chat ID matches to prevent cross-user attacks
    if (message.chat.id.toString() !== config.telegram_chat_id) {
      SafeLogger.warn('Chat ID mismatch', {
        userId,
        receivedChatId: message.chat.id,
        expectedChatId: config.telegram_chat_id,
      });
      return NextResponse.json({ ok: true }); // Silently ignore
    }

    SafeLogger.info('Chat ID verified, handling reply', { userId, textLength: message.text.length });

    // Handle the reply
    const result = await BotService.handleReply(config, message.text);

    if (!result.success) {
      SafeLogger.error('Failed to handle reply', { userId, error: result.message });
    } else {
      SafeLogger.info('Reply handled successfully', { userId });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    SafeLogger.error('Webhook error', error);
    return NextResponse.json({ ok: true }); // Always return ok to Telegram
  }
}
