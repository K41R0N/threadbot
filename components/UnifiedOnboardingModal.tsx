'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface UnifiedOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FlowStep = 'welcome' | 'how-it-works' | 'choose-workflow' | 'pick-path' | 'notion-setup' | 'telegram-setup' | 'schedule-setup';

export function UnifiedOnboardingModal({ isOpen, onClose }: UnifiedOnboardingModalProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [currentStep, setCurrentStep] = useState<FlowStep>('welcome');

  // Notion fields
  const [notionToken, setNotionToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  // Telegram fields
  const [telegramToken, setTelegramToken] = useState('');
  const [chatId, setChatId] = useState('');

  // Schedule fields
  const [timezone, setTimezone] = useState('America/New_York');
  const [morningTime, setMorningTime] = useState('09:00');
  const [eveningTime, setEveningTime] = useState('18:00');

  const completeOnboarding = trpc.agent.completeOnboarding.useMutation({
    onSuccess: async () => {
      await utils.agent.getOnboardingStatus.invalidate();
      toast.success('Welcome to Threadbot!');
      router.push('/agent/create');
    },
    onError: () => {
      toast.error('Failed to complete onboarding');
    },
  });

  const skipOnboarding = trpc.agent.skipOnboarding.useMutation({
    onSuccess: async () => {
      await utils.agent.getOnboardingStatus.invalidate();
      toast.info('You can set up anytime from the dashboard');
      onClose();
    },
    onError: () => {
      toast.error('Failed to skip onboarding');
    },
  });

  const createConfig = trpc.bot.createConfig.useMutation({
    onSuccess: () => {
      toast.success('Notion connected!');
      setCurrentStep('telegram-setup');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      if (currentStep === 'telegram-setup') {
        toast.success('Telegram connected!');
        setCurrentStep('schedule-setup');
      } else if (currentStep === 'schedule-setup') {
        toast.success('Setup complete! Bot is now active.');
        onClose();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const setupWebhook = trpc.bot.setupWebhookForUser.useMutation();

  if (!isOpen) return null;

  const handleWelcomeNext = () => {
    setCurrentStep('how-it-works');
  };

  const handleHowItWorksNext = () => {
    setCurrentStep('choose-workflow');
  };

  const handleChooseWorkflowNext = () => {
    setCurrentStep('pick-path');
  };

  const handlePickAI = () => {
    completeOnboarding.mutate();
  };

  const handlePickNotion = () => {
    setCurrentStep('notion-setup');
  };

  const handleNotionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notionToken || !databaseId) {
      toast.error('Please fill in all fields');
      return;
    }

    createConfig.mutate({
      notionToken,
      notionDatabaseId: databaseId,
      timezone,
      morningTime,
      eveningTime,
      isActive: false,
    });
  };

  const handleTelegramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramToken || !chatId) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      await setupWebhook.mutateAsync({ botToken: telegramToken });
      updateConfig.mutate({
        telegramBotToken: telegramToken,
        telegramChatId: chatId,
      });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig.mutate({
      timezone,
      morningTime,
      eveningTime,
      isActive: true,
    });
  };

  const handleSkip = () => {
    skipOnboarding.mutate();
  };

  const handleBack = () => {
    const stepFlow: Record<FlowStep, FlowStep> = {
      'welcome': 'welcome',
      'how-it-works': 'welcome',
      'choose-workflow': 'how-it-works',
      'pick-path': 'choose-workflow',
      'notion-setup': 'pick-path',
      'telegram-setup': 'notion-setup',
      'schedule-setup': 'telegram-setup',
    };
    setCurrentStep(stepFlow[currentStep]);
  };

  // Welcome Steps
  if (currentStep === 'welcome') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="h-2 bg-gray-200">
            <div className="h-full bg-black transition-all" style={{ width: '33%' }} />
          </div>
          <div className="p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4">🤖</div>
              <h2 className="text-4xl font-display mb-3">WELCOME TO THREADBOT</h2>
              <p className="text-lg text-gray-600">Your AI-powered journaling companion that delivers daily prompts to Telegram and logs your reflections.</p>
            </div>
            <div className="space-y-4 mb-8">
              {['AI generates personalized prompts based on your brand', 'Prompts delivered to Telegram twice daily', 'Responses automatically logged'].map((bullet, i) => (
                <div key={i} className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                  <p>{bullet}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-6 border-t-2 border-gray-200">
              <Button variant="outline" onClick={handleSkip}>SKIP FOR NOW</Button>
              <Button onClick={handleWelcomeNext}>NEXT →</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'how-it-works') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="h-2 bg-gray-200">
            <div className="h-full bg-black transition-all" style={{ width: '66%' }} />
          </div>
          <div className="p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4">⚡</div>
              <h2 className="text-4xl font-display mb-3">HOW IT WORKS</h2>
              <p className="text-lg text-gray-600">Threadbot makes daily reflection effortless with three simple steps:</p>
            </div>
            <div className="space-y-4 mb-8">
              {['1. Create an AI Database - Generate 60 prompts for the month', '2. Connect Telegram - Set up your bot and schedule', '3. Receive & Respond - Get prompts twice daily, reply directly in Telegram'].map((bullet, i) => (
                <div key={i} className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                  <p>{bullet}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-6 border-t-2 border-gray-200">
              <Button variant="outline" onClick={handleBack}>← BACK</Button>
              <Button onClick={handleHowItWorksNext}>NEXT →</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'choose-workflow') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="h-2 bg-gray-200">
            <div className="h-full bg-black transition-all" style={{ width: '100%' }} />
          </div>
          <div className="p-8 md:p-12">
            <div className="text-center mb-8">
              <div className="text-7xl mb-4">🎯</div>
              <h2 className="text-4xl font-display mb-3">CHOOSE YOUR WORKFLOW</h2>
              <p className="text-lg text-gray-600">Pick the approach that works best for you:</p>
            </div>
            <div className="space-y-4 mb-8">
              {['🤖 AI Agent - Let AI generate themed prompts (DeepSeek = Free, Claude = 1 credit)', '📝 Notion - Connect your own Notion database of prompts', 'You can switch between them anytime in Settings'].map((bullet, i) => (
                <div key={i} className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                  <p>{bullet}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-6 border-t-2 border-gray-200">
              <Button variant="outline" onClick={handleBack}>← BACK</Button>
              <Button onClick={handleChooseWorkflowNext}>CHOOSE →</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Path Selection
  if (currentStep === 'pick-path') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="border-b-2 border-black p-6 flex justify-between items-center">
            <h2 className="text-3xl font-display">CHOOSE YOUR PATH</h2>
            <button onClick={handleSkip} className="text-2xl hover:opacity-50" title="Close">×</button>
          </div>
          <div className="p-8 space-y-4">
            <button
              onClick={handlePickAI}
              disabled={completeOnboarding.isPending}
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
                    <li>• Generate 60 unique prompts (30 days)</li>
                    <li>• Free: DeepSeek R1 | Paid: Claude Sonnet 4</li>
                    <li>• Start immediately</li>
                  </ul>
                </div>
              </div>
            </button>

            <button
              onClick={handlePickNotion}
              className="w-full border-2 border-black p-6 text-left hover:bg-black hover:text-white transition group"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">📓</div>
                <div className="flex-1">
                  <div className="font-display text-2xl mb-2">NOTION DATABASE</div>
                  <div className="text-sm mb-3 group-hover:text-gray-300">
                    Connect your existing Notion database with prompts
                  </div>
                  <ul className="text-sm space-y-1 group-hover:text-gray-300">
                    <li>• Import existing prompts</li>
                    <li>• Set up Telegram delivery</li>
                    <li>• Requires Notion + Telegram setup</li>
                  </ul>
                </div>
              </div>
            </button>

            <div className="pt-4 border-t-2 border-gray-200">
              <Button variant="outline" onClick={handleBack} className="w-full">
                ← BACK TO INTRO
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Notion Setup Steps
  if (currentStep === 'notion-setup') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="border-b-2 border-black p-6 flex justify-between items-center">
            <h2 className="text-3xl font-display">NOTION SETUP</h2>
            <button onClick={handleSkip} className="text-2xl hover:opacity-50">×</button>
          </div>
          <div className="p-6 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center font-display text-sm">1</div>
              <span className="font-display text-sm">NOTION</span>
              <div className="flex-1 h-0.5 bg-gray-300" />
              <div className="w-8 h-8 border-2 border-gray-300 text-gray-300 flex items-center justify-center font-display text-sm">2</div>
              <span className="font-display text-sm text-gray-300">TELEGRAM</span>
              <div className="flex-1 h-0.5 bg-gray-300" />
              <div className="w-8 h-8 border-2 border-gray-300 text-gray-300 flex items-center justify-center font-display text-sm">3</div>
              <span className="font-display text-sm text-gray-300">SCHEDULE</span>
            </div>
          </div>
          <form onSubmit={handleNotionSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-display text-sm mb-2">NOTION INTEGRATION TOKEN</label>
              <Input type="password" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} placeholder="secret_..." required />
              <p className="text-xs text-gray-600 mt-1">Get your token from <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="underline">notion.so/my-integrations</a></p>
            </div>
            <div>
              <label className="block font-display text-sm mb-2">DATABASE ID</label>
              <Input type="text" value={databaseId} onChange={(e) => setDatabaseId(e.target.value)} placeholder="abc123..." required />
              <p className="text-xs text-gray-600 mt-1">Found in your database URL</p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleBack}>← BACK</Button>
              <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">SKIP</Button>
              <Button type="submit" disabled={createConfig.isPending}>
                {createConfig.isPending ? 'CONNECTING...' : 'NEXT →'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (currentStep === 'telegram-setup') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="border-b-2 border-black p-6 flex justify-between items-center">
            <h2 className="text-3xl font-display">TELEGRAM SETUP</h2>
            <button onClick={handleSkip} className="text-2xl hover:opacity-50">×</button>
          </div>
          <div className="p-6 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-2 border-black text-black flex items-center justify-center font-display text-sm">✓</div>
              <span className="font-display text-sm">NOTION</span>
              <div className="flex-1 h-0.5 bg-black" />
              <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center font-display text-sm">2</div>
              <span className="font-display text-sm">TELEGRAM</span>
              <div className="flex-1 h-0.5 bg-gray-300" />
              <div className="w-8 h-8 border-2 border-gray-300 text-gray-300 flex items-center justify-center font-display text-sm">3</div>
              <span className="font-display text-sm text-gray-300">SCHEDULE</span>
            </div>
          </div>
          <form onSubmit={handleTelegramSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-display text-sm mb-2">TELEGRAM BOT TOKEN</label>
              <Input type="password" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} placeholder="123456789:ABC..." required />
              <p className="text-xs text-gray-600 mt-1">Create a bot via <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a></p>
            </div>
            <div>
              <label className="block font-display text-sm mb-2">YOUR TELEGRAM CHAT ID</label>
              <Input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" required />
              <p className="text-xs text-gray-600 mt-1">Get your ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">@userinfobot</a></p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleBack}>← BACK</Button>
              <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">SKIP</Button>
              <Button type="submit" disabled={updateConfig.isPending || setupWebhook.isPending}>
                {updateConfig.isPending || setupWebhook.isPending ? 'CONNECTING...' : 'NEXT →'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (currentStep === 'schedule-setup') {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border-4 border-black max-w-2xl w-full">
          <div className="border-b-2 border-black p-6 flex justify-between items-center">
            <h2 className="text-3xl font-display">SCHEDULE SETUP</h2>
            <button onClick={handleSkip} className="text-2xl hover:opacity-50">×</button>
          </div>
          <div className="p-6 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border-2 border-black text-black flex items-center justify-center font-display text-sm">✓</div>
              <span className="font-display text-sm">NOTION</span>
              <div className="flex-1 h-0.5 bg-black" />
              <div className="w-8 h-8 border-2 border-black text-black flex items-center justify-center font-display text-sm">✓</div>
              <span className="font-display text-sm">TELEGRAM</span>
              <div className="flex-1 h-0.5 bg-black" />
              <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center font-display text-sm">3</div>
              <span className="font-display text-sm">SCHEDULE</span>
            </div>
          </div>
          <form onSubmit={handleScheduleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block font-display text-sm mb-2">TIMEZONE</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border-2 border-black px-4 py-2" required>
                <option value="America/New_York">Eastern Time (US)</option>
                <option value="America/Chicago">Central Time (US)</option>
                <option value="America/Denver">Mountain Time (US)</option>
                <option value="America/Los_Angeles">Pacific Time (US)</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div>
              <label className="block font-display text-sm mb-2">MORNING TIME</label>
              <Input type="time" value={morningTime} onChange={(e) => setMorningTime(e.target.value)} required />
            </div>
            <div>
              <label className="block font-display text-sm mb-2">EVENING TIME</label>
              <Input type="time" value={eveningTime} onChange={(e) => setEveningTime(e.target.value)} required />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleBack}>← BACK</Button>
              <Button type="submit" disabled={updateConfig.isPending} className="flex-1">
                {updateConfig.isPending ? 'ACTIVATING...' : 'ACTIVATE BOT'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
