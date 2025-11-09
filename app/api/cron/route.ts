import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { BotService } from '@/server/services/bot';
import { SafeLogger } from '@/lib/logger';

// Set function timeout to 30 seconds (requires Vercel Pro)
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify request is authorized
    // Accept either:
    // 1. Requests from Vercel Cron (has x-vercel-cron header)
    // 2. Requests with valid CRON_SECRET authorization header

    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get('x-vercel-cron');

    // Check if request is from Vercel Cron
    const isVercelCron = vercelCronHeader !== null;

    // Check if request has valid CRON_SECRET
    const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

    // Require at least one valid authentication method
    if (!isVercelCron && !hasValidSecret) {
      SafeLogger.warn('Unauthorized cron request attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
        hasAuthHeader: !!authHeader,
        hasVercelCronHeader: isVercelCron,
        hasCronSecret: !!cronSecret,
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
