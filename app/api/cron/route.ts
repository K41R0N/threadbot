import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { BotService } from '@/server/services/bot';
import { SafeLogger } from '@/lib/logger';

// Set function timeout to 30 seconds (requires Vercel Pro)
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify request is authorized (from Vercel Cron or with valid secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      SafeLogger.warn('Unauthorized cron request attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'morning' | 'evening';

    if (!type || (type !== 'morning' && type !== 'evening')) {
      return NextResponse.json(
        { error: 'Invalid type parameter. Must be "morning" or "evening"' },
        { status: 400 }
      );
    }

    // Get all active bot configurations
    const supabase = getServerSupabase();
    const { data: configs, error } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('is_active', true);

    if (error) {
      SafeLogger.error('Failed to fetch bot configs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bot configurations' },
        { status: 500 }
      );
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({
        message: 'No active bots found',
        processed: 0,
      });
    }

    // Process each bot
    const results = [];
    for (const config of configs) {
      const scheduledTime = type === 'morning' ? config.morning_time : config.evening_time;
      
      // Check if it's time to send this prompt
      if (BotService.shouldSendPrompt(scheduledTime, config.timezone, type)) {
        const result = await BotService.sendScheduledPrompt(config, type);
        results.push({
          userId: config.user_id,
          ...result,
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${type} prompts`,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    SafeLogger.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
