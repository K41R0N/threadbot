'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { OnboardingModal } from '@/components/onboarding-modal';

interface AgentDatabase {
  monthKey: string;
  name: string;
  promptCount: number;
  morningCount: number;
  eveningCount: number;
  createdAt: string | undefined;
  status: 'active' | 'connected' | 'inactive';
}

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  // Show onboarding modal for first-time users
  useEffect(() => {
    if (onboardingStatus && !onboardingStatus.onboarding_completed && !onboardingStatus.onboarding_skipped) {
      setShowOnboarding(true);
    }
  }, [onboardingStatus]);

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      toast.success('Bot status updated');
    },
  });

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/');
    } else if (!configLoading && !config) {
      router.push('/onboarding');
    }
  }, [isLoaded, isSignedIn, config, configLoading, router]);

  // Loading state
  if (configLoading || !config) {
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

  // Group prompts by month to show existing databases
  const agentDatabases: AgentDatabase[] = allPrompts?.reduce<AgentDatabase[]>((acc, prompt) => {
    const monthKey = prompt.date.slice(0, 7); // "2025-11"
    if (!acc.find(db => db.monthKey === monthKey)) {
      const monthPrompts = allPrompts.filter(p => p.date.startsWith(monthKey));
      const morningCount = monthPrompts.filter(p => p.post_type === 'morning').length;
      const eveningCount = monthPrompts.filter(p => p.post_type === 'evening').length;

      // Check if this database is connected to the bot
      const isConnected = config.prompt_source === 'agent';
      const isActive = isConnected && config.is_active;

      acc.push({
        monthKey,
        name: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        promptCount: monthPrompts.length,
        morningCount,
        eveningCount,
        createdAt: monthPrompts[0]?.created_at,
        status: isActive ? 'active' : (isConnected ? 'connected' : 'inactive'),
      });
    }
    return acc;
  }, []) || [];

  const hasNotionDatabase = config.notion_database_id;
  const isNotionActive = config.prompt_source === 'notion' && config.is_active;
  const isNotionConnected = config.prompt_source === 'notion';

  const handleCreateNew = () => {
    router.push('/agent/create');
  };

  const toggleBot = () => {
    updateConfig.mutate({
      isActive: !config.is_active,
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
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Bot Status Card */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-display mb-2">BOT STATUS</h2>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="font-display text-xl">
                  {config.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Prompt Source: <span className="font-display uppercase">{config.prompt_source === 'agent' ? '🤖 AI Agent' : '📝 Notion'}</span>
              </div>

              {/* Webhook Health Status */}
              {config.last_webhook_setup_at && (
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <div className="text-xs text-gray-500 mb-1">
                    Webhook Status
                  </div>
                  <div className="flex items-center gap-2">
                    {config.last_webhook_status === 'success' ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-sm text-green-700 font-display">CONNECTED</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm text-red-700 font-display">FAILED</span>
                      </>
                    )}
                    <span className="text-xs text-gray-500">
                      • Last checked: {new Date(config.last_webhook_setup_at).toLocaleString()}
                    </span>
                  </div>
                  {config.last_webhook_error && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                      Error: {config.last_webhook_error}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={toggleBot}
                variant={config.is_active ? 'outline' : 'default'}
                disabled={updateConfig.isPending}
              >
                {config.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/settings')}
              >
                CONFIGURE BOT
              </Button>
            </div>
          </div>
        </div>

        {/* Claude Credits */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-display mb-2">CLAUDE CREDITS</h2>
              <p className="text-xl mb-4">
                <span className="font-display text-5xl">{subscription?.claude_credits || 0}</span>
                <span className="text-gray-600 ml-3">credits remaining</span>
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• DeepSeek R1: <span className="font-display">FREE</span> (Unlimited)</p>
                <p>• Claude Sonnet 4.5: <span className="font-display">1 CREDIT</span> per generation</p>
                <p>• Each purchase = 3 credits</p>
              </div>

              {/* Credit Status */}
              <div className="mt-4">
                {(subscription?.claude_credits || 0) > 0 ? (
                  <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 border-2 border-green-500 px-4 py-2">
                    <span>✓</span>
                    <span className="font-display text-sm">You can use Claude for generation</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-blue-700 bg-blue-50 border-2 border-blue-500 px-4 py-2">
                    <span>💡</span>
                    <span className="font-display text-sm">
                      Use DeepSeek R1 for free, or purchase credits for Claude
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button onClick={() => setShowUpgrade(true)}>
              BUY CREDITS
            </Button>
          </div>
        </div>

        {/* Databases Section */}
        <div className="border-2 border-black p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-display">YOUR DATABASES</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your AI-generated and Notion prompt calendars
              </p>
            </div>
            <Button onClick={handleCreateNew}>
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
                  className="border-2 border-black p-6 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => {
                    toast.info('Notion database view coming soon!');
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">📝</span>
                        <h3 className="font-display text-2xl">NOTION DATABASE</h3>
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-display">NOTION</span>
                        {getStatusBadge(isNotionActive ? 'active' : (isNotionConnected ? 'connected' : 'inactive'))}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Connected to your Notion workspace</span>
                        <span>•</span>
                        <span>Database ID: {config.notion_database_id?.slice(0, 8)}...</span>
                      </div>
                      {isNotionActive && (
                        <div className="mt-2 text-sm text-green-700">
                          ✓ Connected to Telegram bot and active
                        </div>
                      )}
                      {isNotionConnected && !isNotionActive && (
                        <div className="mt-2 text-sm text-blue-700">
                          Connected to bot (activate in Settings)
                        </div>
                      )}
                    </div>
                    <div className="text-4xl">→</div>
                  </div>
                </div>
              )}

              {/* Agent Databases */}
              {agentDatabases.map((db: AgentDatabase) => {
                const totalPrompts = db.morningCount + db.eveningCount;
                const expectedPrompts = 60; // 30 mornings + 30 evenings
                const rawPercent = Math.round((totalPrompts / expectedPrompts) * 100);
                const completionPercent = Math.min(100, Math.max(0, rawPercent)); // Clamp to 0-100

                return (
                  <div
                    key={db.monthKey}
                    className="border-2 border-black p-6 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => router.push(`/agent/database/${db.monthKey}`)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🤖</span>
                          <h3 className="font-display text-2xl">{db.name}</h3>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-display">AI AGENT</span>
                          {getStatusBadge(db.status)}
                        </div>

                        {/* Progress Indicator */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{totalPrompts} of {expectedPrompts} prompts generated</span>
                            <span className="font-display">{completionPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${completionPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{db.morningCount} morning</span>
                          <span>•</span>
                          <span>{db.eveningCount} evening</span>
                          <span>•</span>
                          <span>Created {db.createdAt ? new Date(db.createdAt).toLocaleDateString() : 'Unknown'}</span>
                        </div>

                        {db.status === 'active' && (
                          <div className="mt-2 text-sm text-green-700">
                            ✓ Connected to Telegram bot and active
                          </div>
                        )}
                        {db.status === 'connected' && (
                          <div className="mt-2 text-sm text-blue-700">
                            Connected to bot (activate in Settings)
                          </div>
                        )}
                        {db.status === 'inactive' && totalPrompts < expectedPrompts && (
                          <div className="mt-2 text-sm text-amber-700">
                            ⚠ Incomplete - Click to continue generation
                          </div>
                        )}
                      </div>
                      <div className="text-4xl">→</div>
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
            <h2 className="text-3xl font-display mb-4">BUY CLAUDE CREDITS</h2>

            <div className="mb-6">
              <div className="border-2 border-black p-6 bg-gray-50">
                <div className="text-center mb-4">
                  <div className="text-6xl font-display mb-2">3</div>
                  <div className="text-xl font-display">CLAUDE GENERATIONS</div>
                </div>

                <div className="border-t-2 border-black pt-4 mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Model:</span>
                    <span className="font-display">Claude Sonnet 4.5</span>
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
                <div className="font-display text-sm mb-1">💡 FREE ALTERNATIVE:</div>
                <div className="text-sm text-gray-700">
                  DeepSeek R1 is always free with unlimited generations
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
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </AuthenticatedLayout>
  );
}
