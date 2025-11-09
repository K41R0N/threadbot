import { Client } from '@notionhq/client';
import { SafeLogger } from '@/lib/logger';

export class NotionService {
  private client: Client;
  private dataSourceCache: Map<string, string> = new Map();

  constructor(token: string) {
    this.client = new Client({ auth: token });
  }

  /**
   * Get data source ID from database ID (required for API v2025-09-03)
   */
  private async getDataSourceId(databaseId: string): Promise<string> {
    // Check cache first
    if (this.dataSourceCache.has(databaseId)) {
      return this.dataSourceCache.get(databaseId)!;
    }

    try {
      // Retrieve database to get its data sources
      const database = await this.client.databases.retrieve({
        database_id: databaseId,
      }) as any;

      // Most databases have one data source - use the first one
      if (database.data_sources && database.data_sources.length > 0) {
        const dataSourceId = database.data_sources[0].id;
        this.dataSourceCache.set(databaseId, dataSourceId);
        return dataSourceId;
      }

      throw new Error('Database has no data sources');
    } catch (error: any) {
      SafeLogger.error('Failed to get data source ID:', error);
      throw new Error(`Could not retrieve database: ${error.message}`);
    }
  }

  /**
   * Query database for pages matching today's date and prompt type
   */
  async queryDatabase(databaseId: string, date: string, type: 'morning' | 'evening') {
    try {
      // Get the data source ID from the database ID
      const dataSourceId = await this.getDataSourceId(databaseId);

      // Query the Notion data source (new API v2025-09-03)
      const response = await (this.client.dataSources as any).query({
        data_source_id: dataSourceId,
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

      // Ensure response has results array
      if (!response || !Array.isArray(response.results)) {
        SafeLogger.error('Invalid response from Notion:', response);
        throw new Error('Invalid response structure from Notion API');
      }

      // Filter by type in page title
      const typeKeyword = type.charAt(0).toUpperCase() + type.slice(1);
      const matchingPages = response.results.filter((page: any) => {
        // Defensive checks for page structure
        if (!page || typeof page !== 'object') return false;
        if (!page.properties || typeof page.properties !== 'object') return false;

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

      // Ensure blocks has results array
      if (!blocks || !Array.isArray(blocks.results)) {
        SafeLogger.error('Invalid blocks response from Notion:', blocks);
        return ''; // Return empty string instead of throwing
      }

      const content: string[] = [];

      for (const block of blocks.results) {
        // Skip null/undefined blocks
        if (!block || typeof block !== 'object') continue;

        const blockData = block as any;

        if (blockData.type === 'paragraph' && blockData.paragraph?.rich_text) {
          const text = blockData.paragraph.rich_text
            .map((rt: any) => rt?.plain_text || '')
            .join('');
          if (text.trim()) content.push(text);
        } else if (blockData.type === 'bulleted_list_item' && blockData.bulleted_list_item?.rich_text) {
          const text = blockData.bulleted_list_item.rich_text
            .map((rt: any) => rt?.plain_text || '')
            .join('');
          if (text.trim()) content.push(`• ${text}`);
        } else if (blockData.type === 'numbered_list_item' && blockData.numbered_list_item?.rich_text) {
          const text = blockData.numbered_list_item.rich_text
            .map((rt: any) => rt?.plain_text || '')
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
