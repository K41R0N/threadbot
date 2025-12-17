'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { UserPrompt } from '@/lib/supabase-agent';
import type { BotConfig } from '@/lib/supabase';
import { PromptCalendar } from '@/components/calendar/prompt-calendar';
import { PromptEditPanel } from '@/components/calendar/prompt-edit-panel';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';

// Get bot username from environment or use default
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'threadbot_bot';

export default function DatabaseRangePage({
  params,
}: {
  params: Promise<{ startDate: string; endDate: string }>;
}) {
  const { startDate, endDate } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPrompts, setSelectedPrompts] = useState<UserPrompt[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [deletedPromptIds, setDeletedPromptIds] = useState<Set<string>>(new Set());

  // Check if this is a fresh generation (from URL param)
  const isFreshGeneration = searchParams.get('generated') === 'true';

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  // Type assertion for tRPC query result
  const botConfig = config as BotConfig | null | undefined;

  const generateCode = trpc.bot.generateVerificationCode.useMutation({
    onSuccess: (data) => {
      setVerificationCode(data.code);
      setIsWaiting(true);
      toast.success('Verification code generated! Say "hello" to the bot on Telegram.');
    },
    onError: (error) => {
      toast.error(`Failed to generate code: ${error.message}`);
      console.error('Verification code generation error:', error);
    },
  });

  // Poll to check if chat ID was linked
  const { data: linkStatus } = trpc.bot.checkChatIdLinked.useQuery(undefined, {
    enabled: isWaiting && !!verificationCode,
    refetchInterval: 2000,
  });

  useEffect(() => {
    // Show modal if just generated and Telegram not connected
    // Note: If Telegram is connected but inactive, the activation banner below will handle it
    if (isFreshGeneration && !botConfig?.telegram_chat_id) {
      setShowTelegramModal(true);
    }
  }, [isFreshGeneration, botConfig]);

  useEffect(() => {
    if (linkStatus?.linked) {
      toast.success('Telegram connected! Bot is now active.');
      setShowTelegramModal(false);
      setIsWaiting(false);
      // Refresh config
      router.refresh();
    }
  }, [linkStatus, router]);

  const handleOpenTelegram = () => {
    // Auto-detect timezone from browser
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    generateCode.mutate({ timezone: detectedTimezone });
    const telegramUrl = `https://t.me/${BOT_USERNAME}`;
    window.open(telegramUrl, '_blank');
  };

  // Format date range display
  const startFormatted = new Date(startDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const endFormatted = new Date(endDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const rangeTitle = `${startFormatted} - ${endFormatted}`;

  const { data: prompts, refetch } = trpc.agent.getPrompts.useQuery({
    startDate,
    endDate,
  });

  const updatePrompt = trpc.agent.updatePrompt.useMutation({
    onMutate: async (variables) => {
      // Capture state BEFORE mutation starts to detect race conditions
      // This runs synchronously before the mutation, so selectedDate is captured at call time
      return {
        selectedDateAtMutation: selectedDate,
        selectedPromptsAtMutation: selectedPrompts,
        deletedPromptIdsAtMutation: new Set(deletedPromptIds), // Capture snapshot of deleted IDs
      };
    },
    onSuccess: async (_, variables, context) => {
      toast.success('Prompt updated!');
      
      // Use captured state from onMutate to avoid race conditions
      const selectedDateAtMutation = context?.selectedDateAtMutation;
      const deletedPromptIdsAtMutation = context?.deletedPromptIdsAtMutation;
      const updatedPromptId = variables.id;
      
      // Optimistically update selectedPrompts for immediate UI feedback
      // Only update if prompts were provided in the mutation
      if (variables.prompts && context?.selectedPromptsAtMutation) {
        const updatedPrompts = context.selectedPromptsAtMutation.map(p => 
          p.id === updatedPromptId 
            ? { ...p, prompts: variables.prompts! }
            : p
        );
        setSelectedPrompts(updatedPrompts);
      }
      
      // Refetch to sync with server and update selectedPrompts with server data
      // Handle both return types: QueryObserverResult with .data or data directly
      const refetchResult = await refetch();
      // Check if result has .data property (QueryObserverResult) or is data directly
      const refetchedPrompts = (refetchResult && typeof refetchResult === 'object' && 'data' in refetchResult)
        ? (refetchResult as { data?: UserPrompt[] }).data
        : (refetchResult as UserPrompt[] | undefined);
      
      // Only sync if:
      // 1. The selected date hasn't changed since mutation started (avoid race conditions)
      // 2. The refetched data contains the updated prompt (verify it was saved)
      // 3. We have refetched data
      if (selectedDateAtMutation && refetchedPrompts && selectedDate === selectedDateAtMutation) {
        // Use captured deletedPromptIds from mutation start to avoid race conditions
        const deletedIdsAtMutation = deletedPromptIdsAtMutation || new Set<string>();
        const datePrompts = (refetchedPrompts as UserPrompt[]).filter(
          p => p.date === selectedDateAtMutation && !deletedIdsAtMutation.has(p.id)
        );
        
        // Verify the updated prompt exists in refetched data
        const updatedPromptExists = datePrompts.some(p => p.id === updatedPromptId);
        
        if (updatedPromptExists) {
          // Server data is valid - sync it
          setSelectedPrompts(datePrompts);
        } else if (datePrompts.length > 0) {
          // Updated prompt not found but other prompts exist - sync anyway
          // (might have been deleted or moved, but keep panel in sync)
          setSelectedPrompts(datePrompts);
        }
        // If datePrompts.length === 0, keep optimistic state (prompt might have been deleted)
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deletePrompt = trpc.agent.deletePrompt.useMutation({
    onSuccess: (_, variables) => {
      toast.success('Prompt deleted');
      
      // Track deleted prompt ID to filter it out from calendar immediately
      setDeletedPromptIds((prev) => new Set(prev).add(variables.id));
      
      // Immediately update selectedPrompts by filtering out the deleted prompt
      const updatedPrompts = selectedPrompts.filter(p => p.id !== variables.id);
      setSelectedPrompts(updatedPrompts);
      
      // Close panel if no prompts remain for this date
      if (updatedPrompts.length === 0) {
        setIsPanelOpen(false);
        setSelectedDate(null);
        setSelectedPrompts([]);
      }
      
      // Refetch to sync with server
      refetch().then(() => {
        // Clear deleted IDs after refetch completes (they're now gone from server)
        setDeletedPromptIds((prev) => {
          const updated = new Set(prev);
          updated.delete(variables.id);
          return updated;
        });
      });
    },
  });

  const handleDayClick = (date: string, prompts: UserPrompt[]) => {
    // Filter out any deleted prompts that haven't been refetched yet
    const validPrompts = prompts.filter(p => !deletedPromptIds.has(p.id));
    
    // Don't open panel if all prompts were deleted
    if (validPrompts.length === 0) {
      return;
    }
    
    setSelectedDate(date);
    setSelectedPrompts(validPrompts);
    setIsPanelOpen(true);
  };

  const handleSavePrompt = (id: string, promptTexts: string[]) => {
    updatePrompt.mutate({
      id,
      prompts: promptTexts,
    });
  };

  const handleDeletePrompt = (id: string) => {
    deletePrompt.mutate({ id });
  };

  const handleExportCSV = () => {
    if (!prompts || prompts.length === 0) {
      toast.error('No prompts to export');
      return;
    }

    // Create CSV content
    const headers = ['Name', 'Date', 'Week Theme', 'Post Type', 'Status', 'Prompts'];
    const rows = (prompts as UserPrompt[]).map((p) => [
      p.name,
      p.date,
      p.week_theme,
      p.post_type,
      p.status,
      p.prompts.map((prompt: string, i: number) => `${i + 1}. ${prompt}`).join(' '),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exported!');
  };

  // Group prompts by date
  const promptsByDate = (prompts as UserPrompt[] | undefined)?.reduce((acc: Record<string, UserPrompt[]>, prompt) => {
    if (!acc[prompt.date]) {
      acc[prompt.date] = [];
    }
    acc[prompt.date].push(prompt);
    return acc;
  }, {}) || {};

  const dates = Object.keys(promptsByDate).sort();

  return (
    <AuthenticatedLayout
      pageTitle="Prompt Database"
      pageSubtitle={rangeTitle}
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Prompt Database' },
        { label: `${startDate} to ${endDate}` },
      ]}
      showBackButton={true}
      backButtonHref="/dashboard"
      rightActions={
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportCSV}
          className="text-xs sm:text-sm h-8 px-2 sm:px-3 font-display hover:bg-gray-100"
        >
          Export CSV
        </Button>
      }
    >
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Telegram Connection Banner */}
        {botConfig && (!botConfig.telegram_chat_id || !botConfig.is_active) && (
          <div className="border-2 border-black p-6 mb-8 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-display text-xl mb-2">
                  {!botConfig.telegram_chat_id ? '📱 Connect Telegram to Receive Daily Prompts' : '⚡ Activate Bot to Start Receiving Prompts'}
                </h3>
                <p className="text-sm text-gray-600">
                  {!botConfig.telegram_chat_id 
                    ? 'Connect your Telegram account to start receiving your generated prompts daily.'
                    : 'Your bot is connected but inactive. Activate it to start receiving prompts.'}
                </p>
              </div>
              <div className="flex gap-3">
                {!botConfig.telegram_chat_id ? (
                  <Button onClick={() => setShowTelegramModal(true)}>
                    CONNECT TELEGRAM
                  </Button>
                ) : (
                  <Button onClick={() => router.push('/settings')}>
                    ACTIVATE BOT
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {botConfig && botConfig.telegram_chat_id && botConfig.is_active && (
          <div className="border-2 border-green-500 p-4 mb-8 bg-green-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-display text-lg text-green-800">Bot is Active!</div>
                <div className="text-sm text-green-700">
                  You'll receive prompts daily at {botConfig.morning_time} and {botConfig.evening_time} ({botConfig.timezone})
                </div>
              </div>
            </div>
          </div>
        )}

        {!prompts || prompts.length === 0 ? (
          <div className="border-2 border-black p-12 text-center">
            <p className="text-xl text-gray-600 mb-4">No prompts found for this date range</p>
            <Button onClick={() => router.push('/agent')}>← BACK TO DATABASES</Button>
          </div>
        ) : (
          <div className="relative">
            {/* Calendar View */}
            <PromptCalendar
              prompts={(prompts as UserPrompt[]).filter(p => !deletedPromptIds.has(p.id))}
              startDate={startDate}
              endDate={endDate}
              onDayClick={handleDayClick}
            />
          </div>
        )}

        {/* Stats */}
        {prompts && prompts.length > 0 && (
          <div className="mt-8 border-2 border-black p-6">
            <h3 className="font-display text-xl mb-4">DATABASE STATS</h3>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <div className="text-3xl font-display">{prompts.length}</div>
                <div className="text-sm text-gray-600">Total Prompts</div>
              </div>
              <div>
                <div className="text-3xl font-display">
                  {(prompts as UserPrompt[]).filter((p) => p.post_type === 'morning').length}
                </div>
                <div className="text-sm text-gray-600">Morning Prompts</div>
              </div>
              <div>
                <div className="text-3xl font-display">
                  {(prompts as UserPrompt[]).filter((p) => p.post_type === 'evening').length}
                </div>
                <div className="text-sm text-gray-600">Evening Prompts</div>
              </div>
              <div>
                <div className="text-3xl font-display">{dates.length}</div>
                <div className="text-sm text-gray-600">Days Covered</div>
              </div>
            </div>
          </div>
        )}

        {/* Side Panel Overlay */}
        {isPanelOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => {
              setIsPanelOpen(false);
              setSelectedDate(null);
              setSelectedPrompts([]);
            }}
          />
        )}

        {/* Edit Panel */}
        {selectedDate && (
          <PromptEditPanel
            date={selectedDate}
            prompts={selectedPrompts}
            isOpen={isPanelOpen}
            onClose={() => {
              setIsPanelOpen(false);
              setSelectedDate(null);
              setSelectedPrompts([]);
            }}
            onSave={handleSavePrompt}
            onDelete={handleDeletePrompt}
          />
        )}
      </div>

      {/* Telegram Connection Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-8 max-w-md w-full">
            <h2 className="text-3xl font-display mb-4">CONNECT TELEGRAM</h2>
            
            {!verificationCode ? (
              <>
                <p className="text-gray-600 mb-4">
                  Connect your Telegram account to start receiving your daily prompts automatically!
                </p>
                <div className="bg-gray-50 border-2 border-gray-200 p-4 mb-6 rounded">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>How it works:</strong>
                  </p>
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                    <li>Click the button below to open Telegram</li>
                    <li>Start a chat with <strong>@{BOT_USERNAME}</strong></li>
                    <li>Send "hello" or your verification code</li>
                    <li>Your account will be linked automatically!</li>
                  </ol>
                </div>
                <div className="space-y-4">
                  <Button
                    onClick={handleOpenTelegram}
                    disabled={generateCode.isPending}
                    size="lg"
                    className="w-full"
                  >
                    {generateCode.isPending ? 'GENERATING CODE...' : '📱 OPEN TELEGRAM & GENERATE CODE'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowTelegramModal(false)}
                    className="w-full"
                  >
                    I'LL DO THIS LATER
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="text-6xl font-display mb-4 tracking-wider border-4 border-black p-6 bg-white">
                    {verificationCode}
                  </div>
                  <p className="text-lg font-display mb-2">YOUR VERIFICATION CODE</p>
                  <div className="bg-blue-50 border-2 border-blue-200 p-4 mb-4 rounded">
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Next steps:</strong>
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 text-left">
                      <li>Telegram should have opened automatically</li>
                      <li>Start a chat with <strong>@{BOT_USERNAME}</strong></li>
                      <li>Send this code: <strong className="text-black">{verificationCode}</strong></li>
                      <li>Or just say <strong>"hello"</strong> - we'll link your account automatically!</li>
                    </ol>
                  </div>
                </div>

                {isWaiting && (
                  <div className="text-center mb-6">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
                    <p className="text-sm text-gray-600">Waiting for you to send the code...</p>
                    <p className="text-xs text-gray-500 mt-2">Make sure you've started a chat with @{BOT_USERNAME}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVerificationCode(null);
                      setIsWaiting(false);
                      setShowTelegramModal(false);
                    }}
                    className="flex-1"
                  >
                    CANCEL
                  </Button>
                  <Button
                    onClick={() => {
                      // Regenerate code and open Telegram (in case code expired)
                      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      generateCode.mutate({ timezone: detectedTimezone });
                      const telegramUrl = `https://t.me/${BOT_USERNAME}`;
                      window.open(telegramUrl, '_blank');
                    }}
                    className="flex-1"
                  >
                    OPEN TELEGRAM
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AuthenticatedLayout>
  );
}
