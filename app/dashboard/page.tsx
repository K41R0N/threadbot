'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { UnifiedOnboardingModal } from '@/components/UnifiedOnboardingModal';
import { UpcomingPrompts } from '@/components/dashboard/upcoming-prompts';
import type { UserPrompt } from '@/lib/supabase-agent';
import type { BotConfig } from '@/lib/supabase';


interface AgentDatabase {
  monthKey: string;
  name: string;
  promptCount: number;
  morningCount: number;
  eveningCount: number;
  createdAt: string | undefined;
  status: 'active' | 'connected' | 'inactive';
  startDate: string;
  endDate: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: config, isLoading: configLoading } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const { data: subscription } = trpc.agent.getSubscription.useQuery();

  // Get onboarding status
  const { data: onboardingStatus } = trpc.agent.getOnboardingStatus.useQuery(undefined, {
    enabled: isSignedIn,
  });

  // Get all user's prompt databases (grouped by month)
  const { data: allPrompts } = trpc.agent.getPrompts.useQuery({});

  // Derive onboarding modal visibility from data (no state/effect needed)
  const showOnboarding = Boolean(
    onboardingStatus &&
    !onboardingStatus.onboarding_completed &&
    !onboardingStatus.onboarding_skipped
  );

  const skipOnboarding = trpc.agent.skipOnboarding.useMutation({
    onError: () => {
      toast.error('Failed to skip onboarding');
    },
  });

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      toast.success('Bot status updated');
    },
  });

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/');
    }
    // Note: bot_config is optional - AI-only users don't need it
  }, [isLoaded, isSignedIn, router]);

  // Loading state - only show if we're still loading AND user needs config
  if (!isLoaded || (configLoading && config === undefined)) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b-2 border-black">
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-4xl font-display">THREADBOT</h1>
              <div className="flex items-center gap-3">
                <div className="w-24 h-10 bg-gray-200 animate-pulse rounded" />
                <div className="w-10 h-10 bg-gray-200 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-display">Dashboard</span>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 max-w-6xl">
          {/* Loading Skeleton */}
          <div className="border-2 border-gray-200 p-8 mb-8 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 mb-4 rounded" />
            <div className="h-6 w-32 bg-gray-200 rounded" />
          </div>

          <div className="border-2 border-gray-200 p-8 mb-8 animate-pulse">
            <div className="h-8 w-64 bg-gray-200 mb-4 rounded" />
            <div className="h-12 w-24 bg-gray-200 rounded" />
          </div>

          <div className="border-2 border-gray-200 p-8 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 mb-6 rounded" />
            <div className="grid gap-4">
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Note: config may be null for AI-only users (no Telegram/Notion setup)
  const botConfig: BotConfig | null = config || null;

  // Group prompts by date range to show existing databases
  // Find continuous date ranges (prompts that span multiple months)
  const agentDatabases: AgentDatabase[] = (() => {
    if (!allPrompts || (allPrompts as UserPrompt[]).length === 0) return [];
    
    const prompts = allPrompts as UserPrompt[];
    const sortedPrompts = [...prompts].sort((a, b) => a.date.localeCompare(b.date));
    
    // Group by continuous date ranges
    const ranges: Array<{ startDate: string; endDate: string; prompts: UserPrompt[] }> = [];
    let currentRange: { startDate: string; endDate: string; prompts: UserPrompt[] } | null = null;
    
    sortedPrompts.forEach((prompt) => {
      if (!currentRange) {
        currentRange = {
          startDate: prompt.date,
          endDate: prompt.date,
          prompts: [prompt],
        };
      } else {
        const lastDate = new Date(currentRange.endDate);
        const currentDate = new Date(prompt.date);
        const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // If within 2 days, consider it part of the same range
        if (daysDiff <= 2) {
          currentRange.endDate = prompt.date;
          currentRange.prompts.push(prompt);
        } else {
          // Start a new range
          ranges.push(currentRange);
          currentRange = {
            startDate: prompt.date,
            endDate: prompt.date,
            prompts: [prompt],
          };
        }
      }
    });
    
    if (currentRange) {
      ranges.push(currentRange);
    }
    
    // Convert to AgentDatabase format
    const botCfg = botConfig as BotConfig | null;
    const isConnected = botCfg?.prompt_source === 'agent';
    const isActive = Boolean(isConnected && botCfg?.is_active);
    
    return ranges.map((range) => {
      const morningCount = range.prompts.filter(p => p.post_type === 'morning').length;
      const eveningCount = range.prompts.filter(p => p.post_type === 'evening').length;
      const monthKey = range.startDate.slice(0, 7); // For backward compatibility
      
      // Generate a name based on date range
      const startDateObj = new Date(range.startDate);
      const endDateObj = new Date(range.endDate);
      const startMonth = startDateObj.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = endDateObj.toLocaleDateString('en-US', { month: 'short' });
      const startYear = startDateObj.getFullYear();
      const endYear = endDateObj.getFullYear();
      
      // If same month, show single month with year
      // If different months but same year, show "Month1 - Month2 Year"
      // If different years, show "Month1 Year1 - Month2 Year2"
      const name = startMonth === endMonth 
        ? `${startMonth} ${startYear}`
        : startYear === endYear
        ? `${startMonth} - ${endMonth} ${startYear}`
        : `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
      
      return {
        monthKey,
        name,
        promptCount: range.prompts.length,
        morningCount,
        eveningCount,
        createdAt: range.prompts[0]?.created_at,
        status: isActive ? 'active' : (isConnected ? 'connected' : 'inactive'),
        startDate: range.startDate,
        endDate: range.endDate,
      };
    });
  })();

  const botCfg = botConfig as BotConfig | null;
  const hasNotionDatabase = botCfg?.notion_database_id;
  const isNotionActive = botCfg?.prompt_source === 'notion' && botCfg?.is_active;
  const isNotionConnected = botCfg?.prompt_source === 'notion';

  const handleCreateNew = () => {
    router.push('/agent/create');
  };

  const toggleBot = () => {
    const cfg = botConfig as BotConfig | null;
    if (!cfg) return;
    updateConfig.mutate({
      isActive: !cfg.is_active,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 bg-green-500 text-white text-xs font-display">● ACTIVE</span>;
      case 'connected':
        return <span className="px-3 py-1 bg-blue-500 text-white text-xs font-display">● CONNECTED</span>;
      default:
        return <span className="px-3 py-1 bg-gray-300 text-gray-700 text-xs font-display">INACTIVE</span>;
    }
  };

  return (
    <AuthenticatedLayout currentPage="dashboard">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 md:py-12 max-w-6xl">
        {/* Upcoming Prompts - Show first if prompts exist and bot is configured */}
        {allPrompts && (allPrompts as UserPrompt[]).length > 0 && botConfig && (
          <UpcomingPrompts 
            prompts={allPrompts as UserPrompt[]} 
            botConfig={botConfig}
          />
        )}

        {/* Quick Stats Row - Mobile optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Bot Status Card - only show if Telegram/Notion is configured */}
          {botConfig && (() => {
          const cfg = botConfig as BotConfig;
          return (
            <div className="border-2 border-black p-4 sm:p-6">
              <div className="mb-4">
                <h2 className="text-xl sm:text-2xl font-display mb-3">BOT STATUS</h2>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full ${cfg.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="font-display text-lg sm:text-xl">
                    {cfg.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Prompt Source: <span className="font-display uppercase">{cfg.prompt_source === 'agent' ? '🤖 AI Agent' : '📝 Notion'}</span>
                </div>

                {/* Webhook Health Status */}
                {cfg.last_webhook_setup_at && (
                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <div className="text-xs text-gray-500 mb-1">
                      Webhook Status
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {cfg.last_webhook_status === 'success' ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-xs sm:text-sm text-green-700 font-display">CONNECTED</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                          <span className="text-xs sm:text-sm text-red-700 font-display">FAILED</span>
                        </>
                      )}
                      <span className="text-xs text-gray-500">
                        • Last checked: {new Date(cfg.last_webhook_setup_at).toLocaleString()}
                      </span>
                    </div>
                    {cfg.last_webhook_error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                        Error: {cfg.last_webhook_error}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button
                  onClick={toggleBot}
                  variant={cfg.is_active ? 'outline' : 'default'}
                  disabled={updateConfig.isPending}
                  className="text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  {cfg.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push('/settings')}
                  className="text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  SETTINGS
                </Button>
              </div>
            </div>
          );
        })()}

          {/* Generation Credits */}
          <div className="border-2 border-black p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-display mb-2">CREDITS</h2>
                <p className="text-lg sm:text-xl mb-3">
                  <span className="font-display text-3xl sm:text-4xl">{subscription?.claude_credits || 0}</span>
                  <span className="text-gray-600 ml-2 text-xs sm:text-sm">remaining</span>
                </p>
                <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                  <p>• DeepSeek R1: <span className="font-display">FREE</span> (Once per week)</p>
                  <p>• Claude: <span className="font-display">1 CREDIT</span> per generation</p>
                </div>
              </div>

              {/* Credit Status */}
              <div>
                {(subscription?.claude_credits || 0) > 0 ? (
                  <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 border-2 border-green-500 px-3 py-1.5 text-xs">
                    <span>✓</span>
                    <span className="font-display">Claude available</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-blue-700 bg-blue-50 border-2 border-blue-500 px-3 py-1.5 text-xs">
                    <span>💡</span>
                    <span className="font-display">Free DeepSeek available</span>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => setShowUpgrade(true)}
                className="text-xs sm:text-sm w-full"
                size="sm"
              >
                BUY CREDITS
              </Button>
            </div>
          </div>
        </div>

        {/* Databases Section */}
        <div className="border-2 border-black p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-display">YOUR DATABASES</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Manage your AI-generated and Notion prompt calendars
              </p>
            </div>
            <Button 
              onClick={handleCreateNew}
              className="text-xs sm:text-sm w-full sm:w-auto"
              size="sm"
            >
              + CREATE AI DATABASE
            </Button>
          </div>

          {!hasNotionDatabase && agentDatabases.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-2xl font-display mb-3">NO DATABASES YET</h3>
                <p className="text-gray-600 mb-6">
                  Create your first AI-generated prompt calendar. Our AI will analyze your brand and generate 60 personalized prompts (30 mornings + 30 evenings).
                </p>
                <Button onClick={handleCreateNew} className="mb-4">
                  CREATE YOUR FIRST DATABASE →
                </Button>
                <div className="text-sm text-gray-500 mt-6 space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span>✓</span>
                    <span>AI analyzes your brand voice</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span>✓</span>
                    <span>Generates themed weekly prompts</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span>✓</span>
                    <span>Auto-delivers to Telegram daily</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Notion Database */}
              {hasNotionDatabase && (
                <div
                  className="border-2 border-black p-4 sm:p-6 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => {
                    toast.info('Notion database view coming soon!');
                  }}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                        <span className="text-xl sm:text-2xl">📝</span>
                        <h3 className="font-display text-lg sm:text-xl md:text-2xl">NOTION DATABASE</h3>
                        <span className="px-2 sm:px-3 py-1 bg-purple-100 text-purple-800 text-xs font-display">NOTION</span>
                        {getStatusBadge(isNotionActive ? 'active' : (isNotionConnected ? 'connected' : 'inactive'))}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 flex-wrap">
                        <span>Connected to your Notion workspace</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-xs">Database ID: {botCfg?.notion_database_id?.slice(0, 8)}...</span>
                      </div>
                      {isNotionActive && (
                        <div className="mt-2 text-xs sm:text-sm text-green-700">
                          ✓ Connected to Telegram bot and active
                        </div>
                      )}
                      {isNotionConnected && !isNotionActive && (
                        <div className="mt-2 text-xs sm:text-sm text-blue-700">
                          Connected to bot (activate in Settings)
                        </div>
                      )}
                    </div>
                    <div className="text-2xl sm:text-4xl flex-shrink-0">→</div>
                  </div>
                </div>
              )}

              {/* Agent Databases */}
              {agentDatabases.map((db: AgentDatabase) => {
                const totalPrompts = db.morningCount + db.eveningCount;

                return (
                  <div
                    key={`${db.startDate}-${db.endDate}`}
                    className="border-2 border-black p-4 sm:p-6 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => router.push(`/agent/database/range/${db.startDate}/${db.endDate}`)}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                          <span className="text-xl sm:text-2xl">🤖</span>
                          <h3 className="font-display text-lg sm:text-xl md:text-2xl">{db.name}</h3>
                          <span className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 text-xs font-display">AI AGENT</span>
                          {getStatusBadge(db.status)}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-2 flex-wrap">
                          <span>{totalPrompts} prompts</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{db.morningCount} morning</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{db.eveningCount} evening</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-xs">
                            {new Date(db.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(db.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        {db.status === 'active' && (
                          <div className="mt-2 text-xs sm:text-sm text-green-700">
                            ✓ Connected to Telegram bot and active
                          </div>
                        )}
                        {db.status === 'connected' && (
                          <div className="mt-2 text-xs sm:text-sm text-blue-700">
                            Connected to bot (activate in Settings)
                          </div>
                        )}
                      </div>
                      <div className="text-2xl sm:text-4xl flex-shrink-0">→</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* How It Works */}
        {!hasNotionDatabase && agentDatabases.length === 0 && (
          <div className="border-2 border-black p-8 mt-8">
            <h2 className="text-3xl font-display mb-6">HOW IT WORKS</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="font-display text-3xl">1</div>
                <div>
                  <h3 className="font-display text-xl mb-2">DEFINE YOUR CONTEXT</h3>
                  <p className="text-gray-600">
                    Add your brand URLs, voice, and themes. AI analyzes your content.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="font-display text-3xl">2</div>
                <div>
                  <h3 className="font-display text-xl mb-2">GENERATE PROMPTS</h3>
                  <p className="text-gray-600">
                    AI creates 4 weekly themes and generates 60+ daily prompts.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="font-display text-3xl">3</div>
                <div>
                  <h3 className="font-display text-xl mb-2">EDIT & CONNECT</h3>
                  <p className="text-gray-600">
                    Edit prompts in a table view, export to CSV, or connect to your Telegram bot.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Buy Credits Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-8 max-w-md">
            <h2 className="text-3xl font-display mb-4">BUY GENERATION CREDITS</h2>

            <div className="mb-6">
              <div className="border-2 border-black p-6 bg-gray-50">
                <div className="text-center mb-4">
                  <div className="text-6xl font-display mb-2">3</div>
                  <div className="text-xl font-display">GENERATION CREDITS</div>
                </div>

                <div className="border-t-2 border-black pt-4 mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Use for:</span>
                    <span className="font-display">Claude Sonnet 4.5</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Or:</span>
                    <span className="font-display">Bypass weekly limit</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Per generation:</span>
                    <span className="font-display">60 prompts</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total prompts:</span>
                    <span className="font-display">180 prompts</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 border-2 border-blue-500 bg-blue-50">
                <div className="font-display text-sm mb-1">💡 FREE OPTION:</div>
                <div className="text-sm text-gray-700">
                  DeepSeek R1 is free once per week (no credits needed)
                </div>
              </div>
            </div>

            <div className="border-t-2 border-black pt-6 mb-6">
              <div className="text-5xl font-display mb-2">$9</div>
              <div className="text-gray-600">one-time purchase</div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setShowUpgrade(false)}
                className="flex-1"
              >
                CANCEL
              </Button>
              <Button
                onClick={() => {
                  toast.info('Stripe integration coming soon!');
                  setShowUpgrade(false);
                }}
                className="flex-1"
              >
                BUY NOW
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      <UnifiedOnboardingModal
        isOpen={showOnboarding}
        onClose={() => skipOnboarding.mutate()}
      />
    </AuthenticatedLayout>
  );
}
