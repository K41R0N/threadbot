'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [showOptions, setShowOptions] = useState(false);

  const { data: onboardingStatus, isLoading: statusLoading } = trpc.agent.getOnboardingStatus.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const skipOnboarding = trpc.agent.skipOnboarding.useMutation({
    onSuccess: () => {
      toast.success('Welcome! You can set up your bot anytime from the dashboard.');
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!isLoaded || statusLoading) return;

    if (!isSignedIn) {
      router.push('/');
      return;
    }

    // If onboarding completed or skipped, go to dashboard
    if (onboardingStatus?.onboarding_completed || onboardingStatus?.onboarding_skipped) {
      router.push('/dashboard');
      return;
    }

    // If config exists (legacy flow), go to dashboard
    if (config) {
      router.push('/dashboard');
      return;
    }

    // Show onboarding options
    setShowOptions(true);
  }, [isLoaded, isSignedIn, onboardingStatus, config, statusLoading, router]);

  const handleStartAIGeneration = () => {
    router.push('/agent/create');
  };

  const handleStartNotionSetup = () => {
    router.push('/setup/notion');
  };

  const handleSkip = () => {
    skipOnboarding.mutate();
  };

  if (!showOptions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-display mb-4">LOADING...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-display">WELCOME TO THREADBOT</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="border-2 border-black p-8 mb-8">
          <h2 className="text-3xl font-display mb-6">GET STARTED</h2>
          <p className="text-lg mb-8">
            Choose how you'd like to set up your content prompts:
          </p>

          <div className="space-y-4">
            {/* Option 1: AI Generation */}
            <button
              onClick={handleStartAIGeneration}
              className="w-full border-2 border-black p-6 text-left hover:bg-black hover:text-white transition group"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">🤖</div>
                <div className="flex-1">
                  <div className="font-display text-2xl mb-2">AI PROMPT GENERATION</div>
                  <div className="text-sm mb-3 group-hover:text-gray-300">
                    Let AI analyze your brand and generate personalized prompts
                  </div>
                  <ul className="text-sm space-y-1 group-hover:text-gray-300">
                    <li>• Analyze your website and content</li>
                    <li>• Generate 4 weekly themes</li>
                    <li>• Create 60 unique prompts (30 days)</li>
                    <li>• Free tier: DeepSeek R1 (unlimited)</li>
                    <li>• Paid tier: Claude Sonnet 4 (premium quality)</li>
                  </ul>
                </div>
              </div>
            </button>

            {/* Option 2: Notion Setup */}
            <button
              onClick={handleStartNotionSetup}
              className="w-full border-2 border-black p-6 text-left hover:bg-black hover:text-white transition group"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">📓</div>
                <div className="flex-1">
                  <div className="font-display text-2xl mb-2">NOTION DATABASE IMPORT</div>
                  <div className="text-sm mb-3 group-hover:text-gray-300">
                    Connect your existing Notion database with prompts
                  </div>
                  <ul className="text-sm space-y-1 group-hover:text-gray-300">
                    <li>• Connect Notion workspace</li>
                    <li>• Import existing prompts</li>
                    <li>• Set up Telegram delivery</li>
                    <li>• Configure schedule times</li>
                  </ul>
                </div>
              </div>
            </button>

            {/* Option 3: Skip */}
            <button
              onClick={handleSkip}
              disabled={skipOnboarding.isPending}
              className="w-full border-2 border-gray-400 p-6 text-left hover:border-black transition"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">⏭️</div>
                <div className="flex-1">
                  <div className="font-display text-2xl mb-2">SKIP FOR NOW</div>
                  <div className="text-sm text-gray-600">
                    {skipOnboarding.isPending
                      ? 'Skipping...'
                      : 'Explore the dashboard and set up later'}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="border-2 border-blue-500 bg-blue-50 p-6">
          <div className="font-display text-sm mb-2">💡 YOU CAN ALWAYS CHANGE THIS LATER</div>
          <div className="text-sm text-gray-700">
            All setup options are available from your dashboard. You can switch between
            AI-generated prompts and Notion imports, or set up Telegram delivery anytime.
          </div>
        </div>
      </div>
    </div>
  );
}
