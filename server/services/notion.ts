import { Client } from '@notionhq/client';
import { SafeLogger } from '@/lib/logger';

export class NotionService {
  private client: Client;

  constructor(token: string) {
    this.client = new Client({ auth: token });
  }

  /**
   * Query database for pages matching today's date and prompt type
   */
  async queryDatabase(databaseId: string, date: string, type: 'morning' | 'evening') {
    try {
      // Query the Notion database
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: 'Date',
              date: {
                equals: date,
              },
            },
          ],
        },
        sorts: [
          {
            property: 'Date',
            direction: 'descending',
          },
        ],
      });

      // Filter by type in page title
      const typeKeyword = type.charAt(0).toUpperCase() + type.slice(1);
      const matchingPages = response.results.filter((page: any) => {
        const title = page.properties.Name?.title?.[0]?.plain_text || '';
        return title.toLowerCase().includes(type.toLowerCase());
      });

      return matchingPages.length > 0 ? matchingPages[0] : null;
    } catch (error: any) {
      SafeLogger.error('Notion query error:', error);
      throw new Error(`Failed to query Notion database: ${error.message}`);
    }
  }

  /**
   * Extract text content from a Notion page
   */
  async getPageContent(pageId: string): Promise<string> {
    try {
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
      });

      const content: string[] = [];

      for (const block of blocks.results) {
        const blockData = block as any;
        
        if (blockData.type === 'paragraph' && blockData.paragraph?.rich_text) {
          const text = blockData.paragraph.rich_text
            .map((rt: any) => rt.plain_text)
            .join('');
          if (text.trim()) content.push(text);
        } else if (blockData.type === 'bulleted_list_item' && blockData.bulleted_list_item?.rich_text) {
          const text = blockData.bulleted_list_item.rich_text
            .map((rt: any) => rt.plain_text)
            .join('');
          if (text.trim()) content.push(`• ${text}`);
        } else if (blockData.type === 'numbered_list_item' && blockData.numbered_list_item?.rich_text) {
          const text = blockData.numbered_list_item.rich_text
            .map((rt: any) => rt.plain_text)
            .join('');
          if (text.trim()) content.push(text);
        }
      }

      return content.join('\n\n');
    } catch (error: any) {
      SafeLogger.error('Notion content extraction error:', error);
      throw new Error(`Failed to extract page content: ${error.message}`);
    }
  }

  /**
   * Append a reply to a Notion page
   */
  async appendReply(pageId: string, reply: string): Promise<void> {
    try {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content: `Reply: ${reply}`,
                  },
                },
              ],
            },
          },
        ],
      });
    } catch (error: any) {
      SafeLogger.error('Notion append error:', error);
      throw new Error(`Failed to append reply: ${error.message}`);
    }
  }
}
