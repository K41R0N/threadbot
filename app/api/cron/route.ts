import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase-server';
import { BotService } from '@/server/services/bot';
import { SafeLogger } from '@/lib/logger';
import type { BotConfig } from '@/lib/supabase';

// Set function timeout to 30 seconds (requires Vercel Pro)
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require CRON_SECRET for all requests
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const vercelCronHeader = request.headers.get('x-vercel-cron'); // For logging only

    // CRON_SECRET must be configured
    if (!cronSecret) {
      SafeLogger.error('CRON_SECRET environment variable not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Verify the authorization header matches the secret
    if (authHeader !== `Bearer ${cronSecret}`) {
      SafeLogger.warn('Unauthorized cron request attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent: request.headers.get('user-agent'),
        hasAuthHeader: !!authHeader,
        vercelCronHeader, // Log for diagnostics
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
    const supabase = serverSupabase;
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
    for (const config of configs as BotConfig[]) {
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
