'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { UserPrompt } from '@/lib/supabase-agent';
import type { BotConfig } from '@/lib/supabase';

interface UpcomingPromptsProps {
  prompts: UserPrompt[];
  botConfig: BotConfig | null;
}

export function UpcomingPrompts({ prompts, botConfig }: UpcomingPromptsProps) {
  const [sendingPromptId, setSendingPromptId] = useState<string | null>(null);

  const sendPromptByDate = trpc.bot.sendPromptByDate.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Prompt sent successfully!');
      } else {
        toast.error(data.message || 'Failed to send prompt');
      }
      setSendingPromptId(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to send prompt');
      setSendingPromptId(null);
    },
  });

  // Filter and sort upcoming prompts (future dates or today if not sent yet)
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const upcomingPrompts = prompts
    .filter((p) => {
      // Include future dates
      if (p.date > today) return true;
      // Include today if status is not 'sent'
      if (p.date === today && p.status !== 'sent') return true;
      return false;
    })
    .sort((a, b) => {
      // Sort by date first
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      // Then by post_type (morning before evening)
      if (a.post_type === 'morning' && b.post_type === 'evening') return -1;
      if (a.post_type === 'evening' && b.post_type === 'morning') return 1;
      return 0;
    })
    .slice(0, 5); // Get next 5

  if (upcomingPrompts.length === 0 || !botConfig) {
    return null;
  }

  const nextPrompt = upcomingPrompts[0];
  const nextPrompts = upcomingPrompts.slice(1);

  // Format date for display
  const formatPromptDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const promptDate = new Date(date);
    promptDate.setHours(0, 0, 0, 0);
    
    const diffTime = promptDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  // Get the first prompt text (usually the main one)
  const getMainPrompt = (prompt: UserPrompt) => {
    return prompt.prompts && prompt.prompts.length > 0 ? prompt.prompts[0] : 'No prompt available';
  };

  const handleSendEarly = (prompt: UserPrompt) => {
    if (!botConfig?.telegram_chat_id) {
      toast.error('Please connect Telegram first');
      return;
    }
    
    setSendingPromptId(prompt.id);
    sendPromptByDate.mutate({ 
      date: prompt.date, 
      type: prompt.post_type 
    });
  };

  return (
    <div className="border-2 border-black mb-6 sm:mb-8">
      {/* Next Prompt - Featured Quote Style */}
      <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 p-6 sm:p-8 md:p-10 lg:p-12 border-b-2 border-black">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div className="flex-1">
              <div className="text-xs sm:text-sm text-gray-500 mb-2 font-display uppercase tracking-wider">
                Upcoming Prompt
              </div>
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-base sm:text-lg md:text-xl font-display">
                  {formatPromptDate(nextPrompt.date)}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-sm sm:text-base text-gray-600 capitalize">
                  {nextPrompt.post_type === 'morning' ? '🌅 Morning' : '🌆 Evening'}
                </span>
                {nextPrompt.week_theme && (
                  <>
                    <span className="text-gray-400 hidden sm:inline">•</span>
                    <span className="text-xs sm:text-sm text-gray-500 italic hidden sm:inline">
                      {nextPrompt.week_theme}
                    </span>
                  </>
                )}
              </div>
              {nextPrompt.week_theme && (
                <div className="text-xs text-gray-500 italic mt-1 sm:hidden">
                  {nextPrompt.week_theme}
                </div>
              )}
            </div>
            {botConfig.telegram_chat_id && (
              <Button
                onClick={() => handleSendEarly(nextPrompt)}
                disabled={sendPromptByDate.isPending || sendingPromptId === nextPrompt.id}
                size="sm"
                className="text-xs sm:text-sm w-full sm:w-auto"
              >
                {sendPromptByDate.isPending && sendingPromptId === nextPrompt.id
                  ? 'SENDING...'
                  : 'SEND NOW'}
              </Button>
            )}
          </div>

          {/* Large Quote Display */}
          <div className="relative">
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-gray-200 font-serif leading-none mb-2 sm:mb-3 md:mb-4 absolute -left-2 sm:-left-4 md:-left-6 -top-2 sm:-top-4">
              "
            </div>
            <blockquote className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-medium text-gray-900 leading-relaxed mb-4 sm:mb-6 px-6 sm:px-8 md:px-12 lg:px-16">
              {getMainPrompt(nextPrompt)}
            </blockquote>
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-gray-200 font-serif leading-none text-right absolute -right-2 sm:-right-4 md:-right-6 -bottom-2 sm:-bottom-4">
              "
            </div>
          </div>

          {/* Show all 5 prompts if available */}
          {nextPrompt.prompts && nextPrompt.prompts.length > 1 && (
            <details className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-200">
              <summary className="text-xs sm:text-sm text-gray-500 mb-3 font-display uppercase tracking-wider cursor-pointer hover:text-gray-700">
                View All {nextPrompt.prompts.length} Prompts for This {nextPrompt.post_type === 'morning' ? 'Morning' : 'Evening'} ({nextPrompt.prompts.length - 1} more)
              </summary>
              <div className="space-y-2 sm:space-y-3 mt-4">
                {nextPrompt.prompts.map((promptText, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 text-sm sm:text-base text-gray-700"
                  >
                    <span className="font-display text-gray-400 flex-shrink-0 w-6">
                      {index + 1}.
                    </span>
                    <span className="flex-1">{promptText}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Upcoming Prompts Preview */}
      {nextPrompts.length > 0 && (
        <div className="p-4 sm:p-6 bg-white">
          <div className="text-xs sm:text-sm text-gray-500 mb-4 font-display uppercase tracking-wider">
            Next {nextPrompts.length} Prompts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {nextPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="border-2 border-gray-200 p-3 sm:p-4 hover:border-black transition-colors bg-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-gray-500 font-display">
                    {formatPromptDate(prompt.date)}
                  </div>
                  <span className="text-sm">
                    {prompt.post_type === 'morning' ? '🌅' : '🌆'}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-gray-900 line-clamp-3 leading-snug mb-2">
                  {getMainPrompt(prompt)}
                </p>
                {prompt.week_theme && (
                  <div className="mt-2 text-xs text-gray-500 italic truncate mb-2">
                    {prompt.week_theme}
                  </div>
                )}
                {botConfig.telegram_chat_id && (
                  <Button
                    onClick={() => handleSendEarly(prompt)}
                    disabled={sendPromptByDate.isPending || sendingPromptId === prompt.id}
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full text-xs"
                  >
                    {sendPromptByDate.isPending && sendingPromptId === prompt.id
                      ? 'SENDING...'
                      : 'SEND NOW'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
