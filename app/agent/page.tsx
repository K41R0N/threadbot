'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useState } from 'react';
import { toast } from 'sonner';

export default function AgentPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: subscription } = trpc.agent.getSubscription.useQuery();
  const { data: context } = trpc.agent.getContext.useQuery();
  const { data: rateLimitCheck } = trpc.agent.checkRateLimit.useQuery();
  const { data: botConfig } = trpc.bot.getConfig.useQuery();

  // Get all user's prompt databases (grouped by month)
  const { data: allPrompts } = trpc.agent.getPrompts.useQuery({});

  // Group prompts by month to show existing databases
  const databases = allPrompts?.reduce((acc: any[], prompt) => {
    const monthKey = prompt.date.slice(0, 7); // "2025-11"
    if (!acc.find(db => db.monthKey === monthKey)) {
      const monthPrompts = allPrompts.filter(p => p.date.startsWith(monthKey));
      const morningCount = monthPrompts.filter(p => p.post_type === 'morning').length;
      const eveningCount = monthPrompts.filter(p => p.post_type === 'evening').length;

      // Check if this database is connected to the bot
      const isConnected = botConfig?.prompt_source === 'agent';
      const isActive = isConnected && botConfig?.is_active;

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

  const canCreateDatabase = subscription?.tier !== 'free' || databases.length === 0;

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

  if (!isSignedIn) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-display">AI AGENT</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push('/settings')}>
                SETTINGS
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                DASHBOARD
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="text-sm text-gray-600">
            <span className="cursor-pointer hover:text-black" onClick={() => router.push('/dashboard')}>Dashboard</span>
            <span className="mx-2">→</span>
            <span>AI Agent</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Subscription & Rate Limit Info */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-display mb-2">YOUR PLAN</h2>
              <p className="text-xl mb-4">
                <span className="font-display">{subscription?.tier?.toUpperCase() || 'FREE'}</span>
                {subscription?.tier === 'free' && (
                  <span className="text-gray-600 ml-2">• 1 Database | 1 Generation/Week</span>
                )}
                {subscription?.tier === 'pro' && (
                  <span className="text-gray-600 ml-2">• Unlimited Databases | Unlimited Generations</span>
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

          <div className="border-t-2 border-black pt-6 mt-6">
            <h3 className="font-display text-lg mb-4">AI MODELS AVAILABLE</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-black p-4">
                <div className="font-display text-xl mb-2">DEEPSEEK R1</div>
                <div className="text-sm text-gray-600 mb-3">
                  Fast analysis, good quality prompts
                </div>
                <div className="font-display text-lg">FREE</div>
              </div>

              <div className="border-2 border-black p-4 relative">
                <div className="font-display text-xl mb-2">CLAUDE SONNET 4.5</div>
                <div className="text-sm text-gray-600 mb-3">
                  Best quality, nuanced understanding
                </div>
                <div className="font-display text-lg">PRO ONLY</div>
                {subscription?.tier === 'free' && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <Button variant="outline" onClick={() => setShowUpgrade(true)}>
                      UPGRADE →
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Databases Section */}
        <div className="border-2 border-black p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-display">PROMPT DATABASES</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create, manage, and connect your AI-generated prompt calendars
              </p>
            </div>
            <Button onClick={handleCreateNew} disabled={!canCreateDatabase && subscription?.tier === 'free'}>
              + CREATE NEW DATABASE
            </Button>
          </div>

          {databases.length === 0 ? (
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
              {databases.map((db: any) => (
                <div
                  key={db.monthKey}
                  className="border-2 border-black p-6 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => router.push(`/agent/database/${db.monthKey}`)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-display text-2xl">{db.name}</h3>
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
                    You've reached the 1 database limit. Upgrade for unlimited databases.
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
        {databases.length === 0 && (
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
