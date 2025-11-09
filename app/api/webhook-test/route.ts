import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

// Debug endpoint to test webhook configuration
// SECURITY: Only accessible by authenticated user checking their own data
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify user is authenticated
    const { userId: authenticatedUserId } = await auth();

    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestedUserId = request.nextUrl.searchParams.get('userId');

    // SECURITY: User can only check their own webhook configuration
    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = authenticatedUserId;

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
