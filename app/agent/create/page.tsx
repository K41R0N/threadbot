'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function CreateDatabasePage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();

  const [step, setStep] = useState<'context' | 'model' | 'generating'>('context');
  const [brandUrls, setBrandUrls] = useState<string[]>(['']);
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  const [startDate, setStartDate] = useState('');
  const [useClaude, setUseClaude] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [generationProgress, setGenerationProgress] = useState('Initializing...');
  const [showRateLimitWarning, setShowRateLimitWarning] = useState(false);

  const { data: subscription } = trpc.agent.getSubscription.useQuery();
  const { data: rateLimitCheck } = trpc.agent.checkRateLimit.useQuery();

  // Check if user is admin
  const isAdmin = user?.id === 'user_2qVl3Z4r8Ys9Xx7Ww6Vv5Uu4Tt3';

  const analyzeContext = trpc.agent.analyzeContext.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.analysis);
        setStep('model');
        toast.success('Context analyzed successfully!');
      } else {
        toast.error(data.error || 'Analysis failed');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generateThemes = trpc.agent.generateThemes.useMutation();
  const generatePrompts = trpc.agent.generatePrompts.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        const monthYear = startDate.slice(0, 7);
        toast.success(`Generated ${data.totalPrompts} prompts!`);
        setTimeout(() => {
          router.push(`/agent/database/${monthYear}`);
        }, 1500);
      } else if (data.requiresUpgrade) {
        toast.error('Claude model requires Pro subscription');
        setStep('model');
      } else if ((data as any).rateLimited) {
        // Server-side rate limit triggered
        toast.error(data.error || 'Rate limit exceeded');
        setStep('model');
        // Optionally redirect to dashboard
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        toast.error(data.error || 'Generation failed');
        setStep('model');
      }
    },
    onError: (error) => {
      toast.error(error.message);
      setStep('model');
    },
  });

  const addBrandUrl = () => setBrandUrls([...brandUrls, '']);
  const removeBrandUrl = (index: number) => {
    const newUrls = brandUrls.filter((_, i) => i !== index);
    setBrandUrls(newUrls.length > 0 ? newUrls : ['']);
  };
  const updateBrandUrl = (index: number, value: string) => {
    const newUrls = [...brandUrls];
    newUrls[index] = value;
    setBrandUrls(newUrls);
  };

  const addCompetitorUrl = () => setCompetitorUrls([...competitorUrls, '']);

  const handleAnalyze = () => {
    const validUrls = brandUrls.filter(url => url.trim() !== '');
    if (validUrls.length === 0) {
      toast.error('Please add at least one brand URL');
      return;
    }

    analyzeContext.mutate({
      brandUrls: validUrls,
      competitorUrls: competitorUrls.filter(url => url.trim() !== ''),
      additionalContext: additionalContext || undefined,
    });
  };

  const handleGenerate = async () => {
    if (!startDate) {
      toast.error('Please select a start date');
      return;
    }

    // Check rate limit (only for free tier, excluding admins)
    const isPro = subscription?.tier === 'pro';
    if (!isAdmin && !isPro && subscription?.tier === 'free' && rateLimitCheck && !rateLimitCheck.canGenerate) {
      setShowRateLimitWarning(true);
      return;
    }

    // Check if user can use Claude
    if (useClaude && subscription?.tier === 'free') {
      toast.error('Claude model requires Pro subscription');
      return;
    }

    // Lock the user in generating mode
    setStep('generating');
    setGenerationProgress('Generating weekly themes...');

    // Calculate end date (30 days from start)
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 29); // 30 days total
    const endDate = end.toISOString().split('T')[0];

    try {
      // Generate themes first
      const themesResult = await generateThemes.mutateAsync({
        userPreferences: additionalContext || 'Follow the methodology provided in the context.',
        useClaude,
      });

      if (!themesResult.success) {
        setStep('model');
        toast.error(themesResult.error || 'Failed to generate themes');
        return;
      }

      setGenerationProgress('Generating 60 prompts (30 mornings + 30 evenings)...');

      // Then generate all prompts
      await generatePrompts.mutateAsync({
        startDate,
        endDate,
        useClaude,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Generation failed';
      toast.error(errorMessage);
      setStep('model');
    }
  };

  const confirmRateLimitBypass = () => {
    setShowRateLimitWarning(false);
    toast.info('Please edit your existing database or wait until next week');
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={step === 'generating'}
              >
                ← BACK
              </Button>
              <h1 className="text-4xl font-display">CREATE AI DATABASE</h1>
            </div>
            <div className="flex gap-3">
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
          <div className="text-sm text-gray-600 mb-4">
            <span className="cursor-pointer hover:text-black" onClick={() => router.push('/dashboard')}>Dashboard</span>
            <span className="mx-2">→</span>
            <span>Create Database</span>
          </div>

          {/* Progress Indicator */}
          <div className="mt-4 flex items-center gap-2">
            <div className={`px-3 py-1 text-sm font-display ${step === 'context' ? 'bg-black text-white' : 'bg-gray-200'}`}>
              1. CONTEXT
            </div>
            <div className="text-gray-400">→</div>
            <div className={`px-3 py-1 text-sm font-display ${step === 'model' ? 'bg-black text-white' : 'bg-gray-200'}`}>
              2. MODEL
            </div>
            <div className="text-gray-400">→</div>
            <div className={`px-3 py-1 text-sm font-display ${step === 'generating' ? 'bg-black text-white' : 'bg-gray-200'}`}>
              3. GENERATE
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Rate Limit Warning Modal */}
        {showRateLimitWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white border-4 border-black p-8 max-w-lg">
              <h2 className="text-3xl font-display mb-4">RATE LIMIT REACHED</h2>
              <p className="mb-6">
                Free users can generate 1 database per week to prevent spam and manage costs.
                Your last generation was {rateLimitCheck?.lastGeneration ? new Date(rateLimitCheck.lastGeneration).toLocaleDateString() : 'recently'}.
              </p>
              <div className="border-2 border-black p-4 mb-6 bg-gray-50">
                <div className="font-display mb-2">INSTEAD, YOU CAN:</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Edit your existing database manually</li>
                  <li>Wait until next week for another generation</li>
                  <li>Upgrade to Pro for unlimited generations</li>
                </ul>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowRateLimitWarning(false)} className="flex-1">
                  CANCEL
                </Button>
                <Button onClick={() => router.push('/dashboard')} className="flex-1">
                  VIEW MY DATABASES
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Context */}
        {step === 'context' && (
          <div className="border-2 border-black p-8">
            <h2 className="text-3xl font-display mb-6">DEFINE YOUR CONTEXT</h2>

            {/* Brand URLs */}
            <div className="mb-8">
              <label className="block font-display text-sm mb-3">
                BRAND URLS <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Your website, Substack, social profiles, or any content that represents your brand voice
              </p>

              <div className="space-y-3">
                {brandUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://yoursite.com"
                      value={url}
                      onChange={(e) => updateBrandUrl(index, e.target.value)}
                      className="flex-1"
                    />
                    {brandUrls.length > 1 && (
                      <Button
                        variant="outline"
                        onClick={() => removeBrandUrl(index)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={addBrandUrl}
                className="mt-3"
                size="sm"
              >
                + ADD URL
              </Button>
            </div>

            {/* Competitor/Inspiration URLs */}
            <div className="mb-8">
              <label className="block font-display text-sm mb-3">
                INSPIRATION URLS (OPTIONAL)
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Competitors or creators you admire. AI will analyze their themes.
              </p>

              {competitorUrls.length === 0 ? (
                <Button variant="outline" onClick={addCompetitorUrl} size="sm">
                  + ADD INSPIRATION URL
                </Button>
              ) : (
                <div className="space-y-3">
                  {competitorUrls.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://inspiration.com"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...competitorUrls];
                          newUrls[index] = e.target.value;
                          setCompetitorUrls(newUrls);
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCompetitorUrls(competitorUrls.filter((_, i) => i !== index));
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addCompetitorUrl} size="sm">
                    + ADD URL
                  </Button>
                </div>
              )}
            </div>

            {/* Additional Context */}
            <div className="mb-8">
              <label className="block font-display text-sm mb-3">
                ADDITIONAL CONTEXT (OPTIONAL)
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Specific themes, tone, audience notes, or goals
              </p>
              <textarea
                className="w-full border-2 border-black px-4 py-3 text-sm min-h-[120px]"
                placeholder="Example: Focus on digital sovereignty, creator economy, and platform power dynamics. Critical but constructive tone, empowering independent creators..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/agent')}
                className="flex-1"
              >
                ← CANCEL
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={analyzeContext.isPending}
                className="flex-1"
              >
                {analyzeContext.isPending ? 'ANALYZING...' : 'ANALYZE CONTEXT →'}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Model Selection */}
        {step === 'model' && analysis && (
          <div className="space-y-8">
            {/* Analysis Results */}
            <div className="border-2 border-black p-8">
              <h2 className="text-3xl font-display mb-6">ANALYSIS COMPLETE</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-display text-sm mb-2">CORE THEMES</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.coreThemes?.map((theme: string, i: number) => (
                      <span
                        key={i}
                        className="border-2 border-black px-3 py-1 text-sm"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-sm mb-2">BRAND VOICE</h3>
                  <p className="text-gray-700">{analysis.brandVoice}</p>
                </div>

                <div>
                  <h3 className="font-display text-sm mb-2">TARGET AUDIENCE</h3>
                  <p className="text-gray-700">{analysis.targetAudience}</p>
                </div>
              </div>
            </div>

            {/* Model Selection */}
            <div className="border-2 border-black p-8">
              <h2 className="text-3xl font-display mb-6">CHOOSE AI MODEL</h2>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => setUseClaude(false)}
                  className={`border-2 border-black p-6 text-left transition ${
                    !useClaude ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="font-display text-2xl mb-2">DEEPSEEK R1</div>
                  <div className={`text-sm mb-4 ${!useClaude ? 'text-gray-300' : 'text-gray-600'}`}>
                    Fast analysis, good quality prompts
                  </div>
                  <div className="font-display text-xl">FREE</div>
                </button>

                <button
                  onClick={() => {
                    if (subscription?.tier === 'free') {
                      toast.error('Upgrade to Pro to use Claude Sonnet 4.5');
                    } else {
                      setUseClaude(true);
                    }
                  }}
                  className={`border-2 border-black p-6 text-left transition relative ${
                    useClaude ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                  }`}
                  disabled={subscription?.tier === 'free'}
                >
                  <div className="font-display text-2xl mb-2">CLAUDE SONNET 4.5</div>
                  <div className={`text-sm mb-4 ${useClaude ? 'text-gray-300' : 'text-gray-600'}`}>
                    Best quality, nuanced understanding
                  </div>
                  <div className="font-display text-xl">PRO ONLY</div>

                  {subscription?.tier === 'free' && (
                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-sm text-gray-600 mb-2">Pro Plan Required</div>
                        <Button size="sm" onClick={(e) => {
                          e.stopPropagation();
                          toast.info('Upgrade modal coming soon');
                        }}>
                          UPGRADE →
                        </Button>
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {/* Date Selection */}
              <div className="mb-8">
                <label className="block font-display text-sm mb-3">
                  START DATE <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  First day of the month. AI will generate 30 days of prompts (60 total: morning + evening).
                </p>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              {/* Rate Limit Info */}
              {!isAdmin && subscription?.tier === 'free' && (
                <div className="border-2 border-yellow-500 bg-yellow-50 p-4 mb-6">
                  <div className="font-display text-sm mb-1">⚠️ FREE TIER LIMIT</div>
                  <div className="text-sm text-gray-700">
                    You can generate 1 database per week. After generation, you can manually edit prompts anytime.
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={() => setStep('context')}
                  className="flex-1"
                >
                  ← BACK
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!startDate || generateThemes.isPending || generatePrompts.isPending}
                  className="flex-1"
                >
                  {generateThemes.isPending || generatePrompts.isPending
                    ? 'GENERATING...'
                    : 'GENERATE DATABASE →'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Generating (LOCKED - No Going Back) */}
        {step === 'generating' && (
          <div className="border-2 border-black p-8">
            <h2 className="text-3xl font-display mb-6">GENERATING YOUR DATABASE</h2>

            <div className="space-y-6">
              <div className="border-2 border-black p-6 bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="animate-spin text-4xl">⚙️</div>
                  <div className="flex-1">
                    <div className="font-display text-lg mb-1">{generationProgress}</div>
                    <div className="text-sm text-gray-600">
                      This will take 2-3 minutes. Please don&apos;t close this page.
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-2 border-blue-500 bg-blue-50 p-4">
                <div className="font-display text-sm mb-2">💡 WHILE YOU WAIT</div>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• AI is analyzing your brand context</li>
                  <li>• Generating 4 weekly themes for the month</li>
                  <li>• Creating 60 unique prompts (30 mornings + 30 evenings)</li>
                  <li>• You&apos;ll be able to edit any prompt after generation</li>
                </ul>
              </div>

              {generatePrompts.isError && (
                <div className="border-2 border-red-500 p-4 bg-red-50">
                  <div className="font-display text-red-700">ERROR</div>
                  <div className="text-sm text-red-600">Generation failed. Please try again.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
