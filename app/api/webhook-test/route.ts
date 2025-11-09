import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

// Debug endpoint to test webhook configuration
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // Get bot config
    const { data: config, error } = await supabase
      .from('bot_configs')
      .select('user_id, telegram_chat_id, is_active')
      .eq('user_id', userId)
      .single();

    if (error || !config) {
      return NextResponse.json({
        error: 'Bot config not found',
        userId
      }, { status: 404 });
    }

    // Get bot state
    const { data: state } = await supabase
      .from('bot_state')
      .select('last_prompt_page_id, last_prompt_type, last_prompt_sent_at')
      .eq('user_id', userId)
      .single();

    // Check environment variables
    const hasWebhookSecret = !!process.env.TELEGRAM_WEBHOOK_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const expectedWebhookUrl = `${appUrl}/api/webhook/${userId}`;

    return NextResponse.json({
      userId: config.user_id,
      chatId: config.telegram_chat_id,
      isActive: config.is_active,
      lastPrompt: state ? {
        pageId: state.last_prompt_page_id,
        type: state.last_prompt_type,
        sentAt: state.last_prompt_sent_at,
      } : null,
      webhookConfig: {
        hasSecret: hasWebhookSecret,
        expectedUrl: expectedWebhookUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
