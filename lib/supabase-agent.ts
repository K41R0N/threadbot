// TypeScript types for agent tables

export type UserTier = 'free' | 'pro' | 'enterprise';

export type PostType = 'morning' | 'evening';

export type PromptStatus = 'draft' | 'scheduled' | 'sent';

export type JobStatus = 'pending' | 'analyzing' | 'generating_themes' | 'generating_prompts' | 'completed' | 'failed';

export interface UserPrompt {
  id: string;
  user_id: string;
  date: string; // ISO date string
  name: string;
  week_theme: string;
  post_type: PostType;
  status: PromptStatus;
  prompts: string[]; // Array of 5 prompts
  created_at: string;
  updated_at: string;
}

export interface UserGenerationContext {
  id: string;
  user_id: string;
  brand_urls: string[] | null;
  competitor_urls: string[] | null;
  brand_voice: string | null;
  tone_attributes: Record<string, any> | null;
  target_audience: string | null;
  core_themes: string[] | null;
  uploaded_files: Record<string, any> | null;
  last_analysis_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWeeklyTheme {
  id: string;
  user_id: string;
  month_year: string; // Format: "2025-11"
  week_number: number; // 1-4
  theme_title: string;
  theme_description: string | null;
  keywords: string[] | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentGenerationJob {
  id: string;
  user_id: string;
  status: JobStatus;
  model_used: string;
  start_date: string;
  end_date: string;
  total_prompts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: UserTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// Generation input types
export interface GenerationContextInput {
  brandUrls?: string[];
  competitorUrls?: string[];
  brandVoice?: string;
  toneAttributes?: Record<string, any>;
  targetAudience?: string;
}

export interface GenerationJobInput {
  startDate: string;
  endDate: string;
  context: GenerationContextInput;
  useClaudeModel?: boolean; // If true, use Claude (paid tier only)
}
