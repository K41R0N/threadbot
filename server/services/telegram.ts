import TelegramBot from 'node-telegram-bot-api';
import { SafeLogger } from '@/lib/logger';

export class TelegramService {
  private bot: TelegramBot;

  constructor(token: string) {
    // Don't use polling in serverless environment
    this.bot = new TelegramBot(token, { polling: false });
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
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
      const options: any = {};
      if (secretToken) {
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
