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

  // Get all user's prompt databases (grouped by month)
  const { data: allPrompts } = trpc.agent.getPrompts.useQuery({});

  // Group prompts by month to show existing databases
  const databases = allPrompts?.reduce((acc: any[], prompt) => {
    const monthKey = prompt.date.slice(0, 7); // "2025-11"
    if (!acc.find(db => db.monthKey === monthKey)) {
      const monthPrompts = allPrompts.filter(p => p.date.startsWith(monthKey));
      acc.push({
        monthKey,
        name: new Date(monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        promptCount: monthPrompts.length,
        createdAt: monthPrompts[0]?.created_at,
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
    router.push('/agent/create');
  };

  if (!isSignedIn) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-4xl font-display">AGENT</h1>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            ← BACK TO DASHBOARD
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Subscription Info */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-display mb-2">YOUR PLAN</h2>
              <p className="text-xl mb-4">
                <span className="font-display">{subscription?.tier?.toUpperCase() || 'FREE'}</span>
                {subscription?.tier === 'free' && (
                  <span className="text-gray-600 ml-2">• 1 Database Limit</span>
                )}
                {subscription?.tier === 'pro' && (
                  <span className="text-gray-600 ml-2">• Unlimited Databases</span>
                )}
              </p>
            </div>

            {subscription?.tier === 'free' && (
              <Button onClick={() => setShowUpgrade(true)}>
                UPGRADE TO PRO
              </Button>
            )}
          </div>

          <div className="border-t-2 border-black pt-6 mt-6">
            <h3 className="font-display text-lg mb-4">AI MODELS</h3>
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
            <h2 className="text-3xl font-display">PROMPT DATABASES</h2>
            <Button onClick={handleCreateNew} disabled={!canCreateDatabase}>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-display text-2xl mb-2">{db.name}</h3>
                      <p className="text-gray-600">
                        {db.promptCount} prompts
                        {' • '}
                        Created {new Date(db.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-4xl">→</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canCreateDatabase && (
            <div className="mt-6 p-4 border-2 border-black bg-yellow-50">
              <p className="text-sm">
                <span className="font-display">FREE PLAN LIMIT:</span> You've reached the 1 database limit.
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-4"
                  onClick={() => setShowUpgrade(true)}
                >
                  UPGRADE TO PRO
                </Button>
              </p>
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
                  <h3 className="font-display text-xl mb-2">EDIT & EXPORT</h3>
                  <p className="text-gray-600">
                    Edit prompts in a table view. Export to CSV or send to Telegram.
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
                  <div className="font-display">CLAUDE SONNET 4.5</div>
                  <div className="text-sm text-gray-600">Best-in-class AI for superior prompts</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="text-2xl">✓</div>
                <div>
                  <div className="font-display">PRIORITY GENERATION</div>
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
