'use client';

import { use, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { UserPrompt } from '@/lib/supabase-agent';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<string[]>([]);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);

  // Check if this is a fresh generation (from URL param)
  const isFreshGeneration = searchParams.get('generated') === 'true';

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const generateCode = trpc.bot.generateVerificationCode.useMutation({
    onSuccess: (data) => {
      setVerificationCode(data.code);
      setIsWaiting(true);
      toast.success('Verification code generated!');
    },
    onError: (error) => {
      toast.error(`Failed to generate code: ${error.message}`);
    },
  });

  // Poll to check if chat ID was linked
  const { data: linkStatus } = trpc.bot.checkChatIdLinked.useQuery(undefined, {
    enabled: isWaiting && !!verificationCode,
    refetchInterval: 2000,
  });

  useEffect(() => {
    // Show modal if just generated and Telegram not connected
    if (isFreshGeneration && (!config?.telegram_chat_id || !config?.is_active)) {
      setShowTelegramModal(true);
    }
  }, [isFreshGeneration, config]);

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
    generateCode.mutate();
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
    onSuccess: () => {
      toast.success('Prompt updated!');
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deletePrompt = trpc.agent.deletePrompt.useMutation({
    onSuccess: () => {
      toast.success('Prompt deleted');
      refetch();
    },
  });

  const handleEdit = (prompt: UserPrompt) => {
    setEditingId(prompt.id);
    setEditedPrompts(prompt.prompts);
  };

  const handleSave = (id: string) => {
    updatePrompt.mutate({
      id,
      prompts: editedPrompts,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditedPrompts([]);
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                ← BACK
              </Button>
              <div>
                <h1 className="text-4xl font-display">PROMPT DATABASE</h1>
                <p className="text-sm text-gray-600 mt-1">{rangeTitle}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleExportCSV}>
                EXPORT CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/settings')}
              >
                SETTINGS
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
              >
                DASHBOARD
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="text-sm text-gray-600">
            <span className="cursor-pointer hover:text-black" onClick={() => router.push('/dashboard')}>Dashboard</span>
            <span className="mx-2">→</span>
            <span>Prompt Database</span>
            <span className="mx-2">→</span>
            <span>{startDate} to {endDate}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Telegram Connection Banner */}
        {config && (!config.telegram_chat_id || !config.is_active) && (
          <div className="border-2 border-black p-6 mb-8 bg-yellow-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-display text-xl mb-2">
                  {!config.telegram_chat_id ? '📱 Connect Telegram to Receive Daily Prompts' : '⚡ Activate Bot to Start Receiving Prompts'}
                </h3>
                <p className="text-sm text-gray-600">
                  {!config.telegram_chat_id 
                    ? 'Connect your Telegram account to start receiving your generated prompts daily.'
                    : 'Your bot is connected but inactive. Activate it to start receiving prompts.'}
                </p>
              </div>
              <div className="flex gap-3">
                {!config.telegram_chat_id ? (
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
        {config && config.telegram_chat_id && config.is_active && (
          <div className="border-2 border-green-500 p-4 mb-8 bg-green-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-display text-lg text-green-800">Bot is Active!</div>
                <div className="text-sm text-green-700">
                  You'll receive prompts daily at {config.morning_time} and {config.evening_time} ({config.timezone})
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
          <div className="border-2 border-black">
            {/* Table Header */}
            <div className="bg-black text-white p-4 grid grid-cols-12 gap-4 font-display text-sm">
              <div className="col-span-2">DATE</div>
              <div className="col-span-2">WEEK THEME</div>
              <div className="col-span-1">TYPE</div>
              <div className="col-span-6">PROMPTS</div>
              <div className="col-span-1">ACTIONS</div>
            </div>

            {/* Table Body */}
            <div className="divide-y-2 divide-black">
              {dates.map((date) => {
                const datePrompts = promptsByDate[date].sort((a, b) =>
                  a.post_type === 'morning' ? -1 : 1
                );

                return datePrompts.map((prompt) => {
                  const isEditing = editingId === prompt.id;

                  return (
                    <div
                      key={prompt.id}
                      className="p-4 grid grid-cols-12 gap-4 hover:bg-gray-50 transition"
                    >
                      {/* Date */}
                      <div className="col-span-2 text-sm">
                        <div className="font-display">
                          {new Date(prompt.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(prompt.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                          })}
                        </div>
                      </div>

                      {/* Week Theme */}
                      <div className="col-span-2 text-sm">
                        <div className="text-gray-700">{prompt.week_theme}</div>
                      </div>

                      {/* Type */}
                      <div className="col-span-1 text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-display ${
                            prompt.post_type === 'morning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {prompt.post_type === 'morning' ? '🌅 AM' : '🌆 PM'}
                        </span>
                      </div>

                      {/* Prompts */}
                      <div className="col-span-6 text-sm">
                        {isEditing ? (
                          <div className="space-y-2">
                            {editedPrompts.map((p, i) => (
                              <Input
                                key={i}
                                value={p}
                                onChange={(e) => {
                                  const newPrompts = [...editedPrompts];
                                  newPrompts[i] = e.target.value;
                                  setEditedPrompts(newPrompts);
                                }}
                                className="text-xs"
                              />
                            ))}
                          </div>
                        ) : (
                          <ol className="list-decimal list-inside space-y-1 text-gray-700">
                            {prompt.prompts.map((p, i) => (
                              <li key={i} className="text-xs">
                                {p}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(prompt.id)}
                              className="text-green-600 hover:text-green-800 text-xl"
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-red-600 hover:text-red-800 text-xl"
                              title="Cancel"
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              title="Edit"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this prompt?')) {
                                  deletePrompt.mutate({ id: prompt.id });
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-sm"
                              title="Delete"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })}
            </div>
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
      </div>

      {/* Telegram Connection Modal */}
      {showTelegramModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-8 max-w-md w-full">
            <h2 className="text-3xl font-display mb-4">CONNECT TELEGRAM</h2>
            
            {!verificationCode ? (
              <>
                <p className="text-gray-600 mb-6">
                  Connect your Telegram account to start receiving your daily prompts automatically!
                </p>
                <div className="space-y-4">
                  <Button
                    onClick={handleOpenTelegram}
                    disabled={generateCode.isPending}
                    size="lg"
                    className="w-full"
                  >
                    {generateCode.isPending ? 'GENERATING CODE...' : '📱 OPEN TELEGRAM'}
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
                  <p className="text-sm text-gray-600 mb-6">
                    Send this code to <strong>@{BOT_USERNAME}</strong> on Telegram, or just say "hello"
                  </p>
                </div>

                {isWaiting && (
                  <div className="text-center mb-6">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
                    <p className="text-sm text-gray-600">Waiting for you to send the code...</p>
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
    </div>
  );
}
