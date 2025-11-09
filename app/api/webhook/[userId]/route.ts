import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { BotService } from '@/server/services/bot';
import { SafeLogger } from '@/lib/logger';

// Set function timeout to 10 seconds
export const maxDuration = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

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

    // Extract message
    const message = update.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true }); // Ignore non-text messages
    }

    // Get bot configuration for this user
    const supabase = getServerSupabase();
    const { data: config, error } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !config) {
      SafeLogger.error('Bot config not found for user', { userId });
      return NextResponse.json({ ok: true }); // Silently ignore to prevent Telegram retries
    }

    // Verify chat ID matches to prevent cross-user attacks
    if (message.chat.id.toString() !== config.telegram_chat_id) {
      SafeLogger.warn('Chat ID mismatch', {
        userId,
        receivedChatId: message.chat.id,
        // Don't log expected chat ID for security
      });
      return NextResponse.json({ ok: true }); // Silently ignore
    }

    // Handle the reply
    const result = await BotService.handleReply(config, message.text);

    if (!result.success) {
      SafeLogger.error('Failed to handle reply', { userId, error: result.message });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    SafeLogger.error('Webhook error', error);
    return NextResponse.json({ ok: true }); // Always return ok to Telegram
  }
}
