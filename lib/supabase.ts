import { createClient } from '@supabase/supabase-js';
import type { Database } from './database';

/**
 * Client-side Supabase client with anonymous key
 * Safe to use in browser/client components
 * Subject to Row Level Security (RLS) policies
 *
 * Lazy initialization to allow build-time code analysis without throwing errors
 */
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get: (_, prop) => {
    const client = getSupabaseClient();
    return client[prop as keyof typeof client];
  }
});

// Database types
export type BotConfig = {
  id: string;
  user_id: string;
  notion_token: string | null;
  notion_database_id: string | null;
  telegram_bot_token: string;
  telegram_chat_id: string;
  timezone: string;
  morning_time: string;
  evening_time: string;
  is_active: boolean;
  prompt_source: 'notion' | 'agent';
  last_webhook_setup_at: string | null;
  last_webhook_status: 'success' | 'failed' | null;
  last_webhook_error: string | null;
  created_at: string;
  updated_at: string;
};

export type BotState = {
  id: string;
  user_id: string;
  last_prompt_type: string | null;
  last_prompt_sent_at: string | null;
  last_prompt_page_id: string | null;
  created_at: string;
  updated_at: string;
};
