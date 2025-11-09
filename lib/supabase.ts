import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (for admin operations)
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

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
