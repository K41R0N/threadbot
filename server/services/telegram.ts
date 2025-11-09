import TelegramBot from 'node-telegram-bot-api';

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
      console.error('Telegram send error:', error);
      throw new Error(`Failed to send Telegram message: ${error.message}`);
    }
  }

  /**
   * Set webhook URL for receiving messages
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const result = await this.bot.setWebHook(webhookUrl);
      return result;
    } catch (error: any) {
      console.error('Telegram webhook setup error:', error);
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
      console.error('Telegram webhook info error:', error);
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
      console.error('Telegram webhook deletion error:', error);
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
  }
}
