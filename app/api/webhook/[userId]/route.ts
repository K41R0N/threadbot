import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { BotService } from '@/server/services/bot';

// Set function timeout to 10 seconds
export const maxDuration = 10;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
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
      console.error('Bot config not found for user:', userId);
      return NextResponse.json({ ok: true }); // Silently ignore
    }

    // Verify chat ID matches
    if (message.chat.id.toString() !== config.telegram_chat_id) {
      console.log('Chat ID mismatch:', message.chat.id, config.telegram_chat_id);
      return NextResponse.json({ ok: true }); // Silently ignore
    }

    // Handle the reply
    const result = await BotService.handleReply(config, message.text);

    if (!result.success) {
      console.error('Failed to handle reply:', result.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }); // Always return ok to Telegram
  }
}
