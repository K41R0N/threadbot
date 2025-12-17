import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase-server';
import { BotService } from '@/server/services/bot';
import { SafeLogger } from '@/lib/logger';
import type { BotConfig } from '@/lib/supabase';

// Set function timeout to 30 seconds (requires Vercel Pro)
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Verify request is from Vercel Cron
    // Vercel Cron sends x-vercel-cron header with value "1" OR has user-agent "vercel-cron/1.0"
    // Check header case-insensitively as some proxies may modify header casing
    const vercelCronHeader = request.headers.get('x-vercel-cron') || 
                              request.headers.get('X-Vercel-Cron') ||
                              request.headers.get('X-VERCEL-CRON');
    const userAgent = request.headers.get('user-agent') || '';
    const searchParams = request.nextUrl.searchParams;
    const providedSecret = searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET;

    // Check if request is from Vercel Cron:
    // 1. Has x-vercel-cron header with value "1"
    // 2. OR has user-agent "vercel-cron/1.0" (fallback for cases where header might not be present)
    const isVercelCronHeader = vercelCronHeader === '1';
    const isVercelCronUserAgent = userAgent.includes('vercel-cron');
    const isVercelCron = isVercelCronHeader || isVercelCronUserAgent;
    
    // If secret is provided, it must match CRON_SECRET
    // If CRON_SECRET is not configured, deny access unless it's from Vercel Cron
    let secretMatches = false;
    if (providedSecret && cronSecret) {
      secretMatches = providedSecret === cronSecret;
    } else if (providedSecret && !cronSecret) {
      // Secret provided but CRON_SECRET not configured - deny
      secretMatches = false;
    }
    // If no secret provided, secretMatches remains false (only Vercel Cron can access)

    // Allow if: (1) It's from Vercel Cron OR (2) Secret is provided AND matches (for manual testing)
    if (!isVercelCron && !secretMatches) {
      SafeLogger.warn('Unauthorized cron request attempt', {
        ip: request.headers.get('x-forwarded-for'),
        userAgent,
        hasVercelCronHeader: !!vercelCronHeader,
        vercelCronHeader,
        isVercelCronUserAgent,
        hasSecret: !!providedSecret,
        secretMatches,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
