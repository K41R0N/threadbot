import { NotionService } from './notion';
import { TelegramService } from './telegram';
import { getServerSupabase, type BotConfig } from '@/lib/supabase';
import { format, toZonedTime } from 'date-fns-tz';
import { SafeLogger } from '@/lib/logger';

export class BotService {
  /**
   * Send scheduled prompt to user
   * Supports both Notion and Agent sources
   */
  static async sendScheduledPrompt(
    config: any, // Extended BotConfig with prompt_source
    type: 'morning' | 'evening'
  ): Promise<{ success: boolean; message?: string; pageId?: string }> {
    try {
      const telegram = new TelegramService(config.telegram_bot_token);

      // Get today's date in user's timezone
      const now = new Date();
      const zonedDate = toZonedTime(now, config.timezone);
      const dateString = format(zonedDate, 'yyyy-MM-dd');
      const formattedDate = format(zonedDate, 'EEEE yyyy-MM-dd');

      let content: string;
      let topicProperty: string;
      let pageId: string | undefined;

      // Determine greeting and emoji based on type
      const greeting = type === 'morning' ? 'Good morning!' : 'Good afternoon!';
      const emoji = type === 'morning' ? '🌅' : '🌆';
      const promptLabel = type === 'morning' ? 'Morning' : 'Evening';

      // Fetch prompt from appropriate source
      if (config.prompt_source === 'agent') {
        // Fetch from agent database
        const supabase = getServerSupabase();
        const { data: prompt } = await supabase
          .from('user_prompts')
          .select('*')
          .eq('user_id', config.user_id)
          .eq('date', dateString)
          .eq('post_type', type)
          .single();

        if (!prompt || !prompt.prompts || prompt.prompts.length === 0) {
          return {
            success: false,
            message: `No ${type} prompt found for ${dateString}`,
          };
        }

        // Format prompts as numbered list
        content = prompt.prompts
          .map((p: string, i: number) => `${i + 1}. ${p}`)
          .join('\n');
        topicProperty = prompt.week_theme;
        pageId = prompt.id; // Use prompt ID instead of Notion page ID
      } else {
        // Fetch from Notion (existing logic)
        const notion = new NotionService(config.notion_token);

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

        content = await notion.getPageContent(page.id);

        if (!content) {
          return {
            success: false,
            message: 'Prompt page is empty',
          };
        }

        // Extract page properties
        const pageProps = page.properties as any;
        topicProperty =
          pageProps.Topic?.rich_text?.[0]?.plain_text ||
          pageProps.Week?.rich_text?.[0]?.plain_text ||
          pageProps.Name?.title?.[0]?.plain_text ||
          'Daily Prompt';
        pageId = page.id;
      }

      // Format message with requested structure
      const replyText = config.prompt_source === 'agent'
        ? 'Reply to this message to log your response.'
        : 'Reply to this message to log your response to Notion.';

      const message = `${greeting}\n\n${emoji} ${formattedDate} - ${promptLabel}\n🎯 ${topicProperty}\n\n${content}\n\n💬 ${replyText}`;

      await telegram.sendMessage(config.telegram_chat_id, message);

      // Update bot state
      const supabase = getServerSupabase();
      await supabase
        .from('bot_state')
        .upsert({
          user_id: config.user_id,
          last_prompt_type: type,
          last_prompt_sent_at: new Date().toISOString(),
          last_prompt_page_id: pageId || null,
        });

      return {
        success: true,
        message: 'Prompt sent successfully',
        pageId,
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
   * Handle reply from Telegram and log to Notion or Agent database
   * Supports both Notion and Agent sources
   */
  static async handleReply(
    config: any, // Extended BotConfig with prompt_source
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

      // Handle reply based on prompt source
      if (config.prompt_source === 'agent') {
        // Store reply in agent database
        const { data: prompt, error: fetchError } = await supabase
          .from('user_prompts')
          .select('response')
          .eq('id', state.last_prompt_page_id)
          .single();

        if (fetchError) {
          throw new Error('Failed to fetch prompt: ' + fetchError.message);
        }

        // Append reply to existing responses (if any)
        const existingResponse = prompt?.response || '';
        const updatedResponse = existingResponse
          ? `${existingResponse}\n\n---\n\n${replyText}`
          : replyText;

        const { error: updateError } = await supabase
          .from('user_prompts')
          .update({ response: updatedResponse })
          .eq('id', state.last_prompt_page_id);

        if (updateError) {
          throw new Error('Failed to save reply: ' + updateError.message);
        }

        return {
          success: true,
          message: 'Reply logged successfully',
        };
      } else {
        // Append reply to Notion page
        const notion = new NotionService(config.notion_token);
        await notion.appendReply(state.last_prompt_page_id, replyText);

        return {
          success: true,
          message: 'Reply logged to Notion',
        };
      }
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
