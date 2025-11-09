'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useState } from 'react';

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

  const { data: config, isLoading: configLoading } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const { data: subscription } = trpc.agent.getSubscription.useQuery();
  const { data: rateLimitCheck } = trpc.agent.checkRateLimit.useQuery();

  // Get all user's prompt databases (grouped by month)
  const { data: allPrompts } = trpc.agent.getPrompts.useQuery({});

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

  if (!config) return null;

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

  const hasNotionDatabase = config.notion_database_id && config.notion_token;
  const isNotionActive = config.prompt_source === 'notion' && config.is_active;
  const isNotionConnected = config.prompt_source === 'notion';

  const canCreateDatabase = subscription?.tier !== 'free' || agentDatabases.length === 0;

  const handleCreateNew = () => {
    if (!canCreateDatabase) {
      setShowUpgrade(true);
      return;
    }

    // Check rate limit for free users
    if (subscription?.tier === 'free' && rateLimitCheck && !rateLimitCheck.canGenerate) {
      toast.error(`Rate limit: Please wait ${rateLimitCheck.daysRemaining} more days`);
      return;
    }

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
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <header className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-display">THREADBOT</h1>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/settings')}
              >
                SETTINGS
              </Button>
              <UserButton />
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="text-sm text-gray-600">
            <span className="font-display">Dashboard</span>
          </div>
        </div>
      </header>

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

        {/* Your Plan */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-display mb-2">YOUR PLAN</h2>
              <p className="text-xl mb-4">
                <span className="font-display">{subscription?.tier?.toUpperCase() || 'FREE'}</span>
                {subscription?.tier === 'free' && (
                  <span className="text-gray-600 ml-2">• 1 AI Database | 1 Generation/Week</span>
                )}
                {subscription?.tier === 'pro' && (
                  <span className="text-gray-600 ml-2">• Unlimited AI Databases | Unlimited Generations</span>
                )}
              </p>

              {/* Rate Limit Status */}
              {subscription?.tier === 'free' && rateLimitCheck && (
                <div className="mt-4">
                  {rateLimitCheck.canGenerate ? (
                    <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 border-2 border-green-500 px-4 py-2">
                      <span>✓</span>
                      <span className="font-display text-sm">You can generate a new database</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-yellow-700 bg-yellow-50 border-2 border-yellow-500 px-4 py-2">
                      <span>⏳</span>
                      <span className="font-display text-sm">
                        Next generation in {rateLimitCheck.daysRemaining} days
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {subscription?.tier === 'free' && (
              <Button onClick={() => setShowUpgrade(true)}>
                UPGRADE TO PRO
              </Button>
            )}
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
            <Button onClick={handleCreateNew} disabled={!canCreateDatabase && subscription?.tier === 'free'}>
              + CREATE AI DATABASE
            </Button>
          </div>

          {!hasNotionDatabase && agentDatabases.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <p className="text-xl mb-4">No databases yet</p>
              <p className="mb-6">
                Create your first AI-powered prompt calendar
              </p>
              <Button onClick={handleCreateNew}>
                GET STARTED →
              </Button>
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
              {agentDatabases.map((db: AgentDatabase) => (
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
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{db.morningCount} morning prompts</span>
                        <span>•</span>
                        <span>{db.eveningCount} evening prompts</span>
                        <span>•</span>
                        <span>Created {new Date(db.createdAt).toLocaleDateString()}</span>
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
                    </div>
                    <div className="text-4xl">→</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canCreateDatabase && subscription?.tier === 'free' && (
            <div className="mt-6 p-4 border-2 border-yellow-500 bg-yellow-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <span className="font-display text-sm">⚠️ FREE PLAN LIMIT:</span>
                  <span className="text-sm ml-2">
                    You&apos;ve reached the 1 AI database limit. Upgrade for unlimited databases.
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpgrade(true)}
                >
                  UPGRADE TO PRO
                </Button>
              </div>
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

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black p-8 max-w-md">
            <h2 className="text-3xl font-display mb-4">UPGRADE TO PRO</h2>

            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <div className="font-display">UNLIMITED DATABASES</div>
                  <div className="text-sm text-gray-600">Create as many prompt calendars as you need</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <div className="font-display">UNLIMITED GENERATIONS</div>
                  <div className="text-sm text-gray-600">No weekly rate limits</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <div className="font-display">CLAUDE SONNET 4.5</div>
                  <div className="text-sm text-gray-600">Best-in-class AI for superior prompts</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <div className="font-display">PRIORITY SUPPORT</div>
                  <div className="text-sm text-gray-600">Faster processing and support</div>
                </div>
              </div>
            </div>

            <div className="border-t-2 border-black pt-6 mb-6">
              <div className="text-4xl font-display mb-2">$9/mo</div>
              <div className="text-gray-600">or $90/year (save 17%)</div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setShowUpgrade(false)}
                className="flex-1"
              >
                MAYBE LATER
              </Button>
              <Button
                onClick={() => {
                  toast.info('Stripe integration coming soon!');
                  setShowUpgrade(false);
                }}
                className="flex-1"
              >
                UPGRADE NOW
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
