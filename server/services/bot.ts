import { NotionService } from './notion';
import { TelegramService } from './telegram';
import { getServerSupabase, type BotConfig } from '@/lib/supabase';
import { format, toZonedTime } from 'date-fns-tz';
import { SafeLogger } from '@/lib/logger';

export class BotService {
  /**
   * Send scheduled prompt to user
   */
  static async sendScheduledPrompt(
    config: BotConfig,
    type: 'morning' | 'evening'
  ): Promise<{ success: boolean; message?: string; pageId?: string }> {
    try {
      // Initialize services
      const notion = new NotionService(config.notion_token);
      const telegram = new TelegramService(config.telegram_bot_token);

      // Get today's date in user's timezone
      const now = new Date();
      const zonedDate = toZonedTime(now, config.timezone);
      const dateString = format(zonedDate, 'yyyy-MM-dd');

      // Query Notion for today's prompt
      const page = await notion.queryDatabase(
        config.notion_database_id,
        dateString,
        type
      );

      if (!page) {
        return {
          success: false,
          message: `No ${type} prompt found for ${dateString}`,
        };
      }

      // Extract page content
      const content = await notion.getPageContent(page.id);

      if (!content) {
        return {
          success: false,
          message: 'Prompt page is empty',
        };
      }

      // Send to Telegram
      const message = `*${type.toUpperCase()} PROMPT*\n\n${content}`;
      await telegram.sendMessage(config.telegram_chat_id, message);

      // Update bot state
      const supabase = getServerSupabase();
      await supabase
        .from('bot_state')
        .upsert({
          user_id: config.user_id,
          last_prompt_type: type,
          last_prompt_sent_at: new Date().toISOString(),
          last_prompt_page_id: page.id,
        });

      return {
        success: true,
        message: 'Prompt sent successfully',
        pageId: page.id,
      };
    } catch (error: any) {
      SafeLogger.error('Send prompt error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Handle reply from Telegram and log to Notion
   */
  static async handleReply(
    config: BotConfig,
    replyText: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      // Get last prompt page ID from bot state
      const supabase = getServerSupabase();
      const { data: state } = await supabase
        .from('bot_state')
        .select('last_prompt_page_id')
        .eq('user_id', config.user_id)
        .single();

      if (!state?.last_prompt_page_id) {
        return {
          success: false,
          message: 'No active prompt to reply to',
        };
      }

      // Append reply to Notion page
      const notion = new NotionService(config.notion_token);
      await notion.appendReply(state.last_prompt_page_id, replyText);

      return {
        success: true,
        message: 'Reply logged to Notion',
      };
    } catch (error: any) {
      SafeLogger.error('Handle reply error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Check if it's time to send a prompt
   */
  static shouldSendPrompt(
    scheduledTime: string,
    timezone: string,
    type: 'morning' | 'evening'
  ): boolean {
    const now = new Date();
    const zonedNow = toZonedTime(now, timezone);
    const currentTime = format(zonedNow, 'HH:mm');
    const currentHour = parseInt(currentTime.split(':')[0]);
    const currentMinute = parseInt(currentTime.split(':')[1]);

    const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);

    // Check if current time is within 5 minutes of scheduled time
    const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const diff = Math.abs(currentTotalMinutes - scheduledTotalMinutes);

    return diff <= 5;
  }
}
