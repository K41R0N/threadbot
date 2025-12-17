import TelegramBot from 'node-telegram-bot-api';
import { SafeLogger } from '@/lib/logger';

export class TelegramService {
  private bot: TelegramBot;

  /**
   * Create TelegramService instance
   * @param token - Optional bot token. If not provided, uses TELEGRAM_BOT_TOKEN from environment
   */
  constructor(token?: string) {
    // Use provided token or fall back to shared bot token from environment
    const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      throw new Error('Telegram bot token is required. Either provide a token or set TELEGRAM_BOT_TOKEN environment variable.');
    }
    
    // Don't use polling in serverless environment
    this.bot = new TelegramBot(botToken, { polling: false });
  }

  /**
   * Escape Markdown special characters to prevent formatting issues
   * SECURITY: Prevents user content from breaking message formatting
   */
  static escapeMarkdown(text: string): string {
    // Escape Telegram Markdown special characters
    // Reference: https://core.telegram.org/bots/api#markdown-style
    return text
      .replace(/\\/g, '\\\\')   // Backslash must be first
      .replace(/\*/g, '\\*')    // Bold
      .replace(/_/g, '\\_')     // Italic
      .replace(/\[/g, '\\[')    // Link opening
      .replace(/\]/g, '\\]')    // Link closing
      .replace(/\(/g, '\\(')    // Link URL opening
      .replace(/\)/g, '\\)')    // Link URL closing
      .replace(/~/g, '\\~')     // Strikethrough
      .replace(/`/g, '\\`')     // Code
      .replace(/>/g, '\\>')     // Quote
      .replace(/#/g, '\\#')     // Header
      .replace(/\+/g, '\\+')    // Unordered list
      .replace(/-/g, '\\-')     // Unordered list / minus
      .replace(/=/g, '\\=')     // Equals
      .replace(/\|/g, '\\|')    // Table
      .replace(/\{/g, '\\{')    // Curly brace
      .replace(/\}/g, '\\}')    // Curly brace
      .replace(/\./g, '\\.')    // Dot (for numbered lists)
      .replace(/!/g, '\\!');    // Exclamation
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'MarkdownV2',
      });
    } catch (error: any) {
      SafeLogger.error('Telegram send error:', error);
      throw new Error(`Failed to send Telegram message: ${error.message}`);
    }
  }

  /**
   * Set webhook URL for receiving messages with optional secret token
   * @param webhookUrl - The webhook URL
   * @param secretToken - Optional secret token for webhook verification (recommended)
   */
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<boolean> {
    try {
      // Type-safe webhook options matching Telegram Bot API
      type WebhookOptions = {
        secret_token?: string;
      };

      const options: WebhookOptions = {};
      if (secretToken) {
        // VALIDATION: Telegram only allows A-Z, a-z, 0-9, _, - (1-256 chars)
        // Reference: https://core.telegram.org/bots/api#setwebhook
        const validTokenPattern = /^[A-Za-z0-9_-]{1,256}$/;
        if (!validTokenPattern.test(secretToken)) {
          throw new Error(
            'Invalid webhook secret token. Must be 1-256 characters and only contain: A-Z, a-z, 0-9, _, -'
          );
        }
        options.secret_token = secretToken;
      }

      const result = await this.bot.setWebHook(webhookUrl, options);
      return result;
    } catch (error: any) {
      SafeLogger.error('Telegram webhook setup error:', error);
      throw new Error(`Failed to set webhook: ${error.message}`);
    }
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo() {
    try {
      return await this.bot.getWebHookInfo();
    } catch (error: any) {
      SafeLogger.error('Telegram webhook info error:', error);
      throw new Error(`Failed to get webhook info: ${error.message}`);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<boolean> {
    try {
      return await this.bot.deleteWebHook();
    } catch (error: any) {
      SafeLogger.error('Telegram webhook deletion error:', error);
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
  }
}
