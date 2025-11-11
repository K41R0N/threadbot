'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type Step = 'notion' | 'telegram' | 'schedule';

interface SetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SetupModal({ isOpen, onClose }: SetupModalProps) {
  const [step, setStep] = useState<Step>('notion');

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

  const createConfig = trpc.bot.createConfig.useMutation({
    onSuccess: () => {
      if (step === 'notion') {
        toast.success('Notion connected!');
        setStep('telegram');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      if (step === 'telegram') {
        toast.success('Telegram connected!');
        setStep('schedule');
      } else if (step === 'schedule') {
        toast.success('Setup complete!');
        onClose();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const setupWebhook = trpc.bot.setupWebhookForUser.useMutation();

  if (!isOpen) return null;

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
      // Set up webhook first
      await setupWebhook.mutateAsync({
        botToken: telegramToken,
      });

      // Then update config
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
      isActive: true, // Activate bot after schedule is set
    });
  };

  const handleSkip = () => {
    toast.info('You can set this up later from Settings');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-4 border-black max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b-2 border-black p-6 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-3xl font-display">BOT SETUP</h2>
          <button
            onClick={handleSkip}
            className="text-2xl hover:opacity-50 transition"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Progress Steps */}
        <div className="p-6 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 border-2 ${step === 'notion' ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-300'} flex items-center justify-center font-display text-sm`}>
              1
            </div>
            <span className={`font-display text-sm ${step === 'notion' ? 'text-black' : 'text-gray-300'}`}>NOTION</span>
            <div className="flex-1 h-0.5 bg-gray-300" />
            <div className={`w-8 h-8 border-2 ${step === 'telegram' ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-300'} flex items-center justify-center font-display text-sm`}>
              2
            </div>
            <span className={`font-display text-sm ${step === 'telegram' ? 'text-black' : 'text-gray-300'}`}>TELEGRAM</span>
            <div className="flex-1 h-0.5 bg-gray-300" />
            <div className={`w-8 h-8 border-2 ${step === 'schedule' ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-300'} flex items-center justify-center font-display text-sm`}>
              3
            </div>
            <span className={`font-display text-sm ${step === 'schedule' ? 'text-black' : 'text-gray-300'}`}>SCHEDULE</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {step === 'notion' && (
            <form onSubmit={handleNotionSubmit} className="space-y-6">
              <div>
                <label className="block font-display text-sm mb-2">NOTION INTEGRATION TOKEN</label>
                <Input
                  type="password"
                  value={notionToken}
                  onChange={(e) => setNotionToken(e.target.value)}
                  placeholder="secret_..."
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Get your token from{' '}
                  <a
                    href="https://www.notion.so/my-integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    notion.so/my-integrations
                  </a>
                </p>
              </div>

              <div>
                <label className="block font-display text-sm mb-2">DATABASE ID</label>
                <Input
                  type="text"
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  placeholder="abc123def456..."
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Found in your database URL after the workspace name
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">
                  SKIP FOR NOW
                </Button>
                <Button type="submit" disabled={createConfig.isPending} className="flex-1">
                  {createConfig.isPending ? 'CONNECTING...' : 'NEXT →'}
                </Button>
              </div>
            </form>
          )}

          {step === 'telegram' && (
            <form onSubmit={handleTelegramSubmit} className="space-y-6">
              <div>
                <label className="block font-display text-sm mb-2">TELEGRAM BOT TOKEN</label>
                <Input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="123456789:ABC..."
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Create a bot via{' '}
                  <a
                    href="https://t.me/botfather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    @BotFather
                  </a>
                </p>
              </div>

              <div>
                <label className="block font-display text-sm mb-2">YOUR TELEGRAM CHAT ID</label>
                <Input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="123456789"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Get your ID from{' '}
                  <a
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    @userinfobot
                  </a>
                </p>
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep('notion')}>
                  ← BACK
                </Button>
                <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">
                  SKIP
                </Button>
                <Button type="submit" disabled={updateConfig.isPending || setupWebhook.isPending}>
                  {updateConfig.isPending || setupWebhook.isPending ? 'CONNECTING...' : 'NEXT →'}
                </Button>
              </div>
            </form>
          )}

          {step === 'schedule' && (
            <form onSubmit={handleScheduleSubmit} className="space-y-6">
              <div>
                <label className="block font-display text-sm mb-2">TIMEZONE</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border-2 border-black px-4 py-2"
                  required
                >
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
                <Input
                  type="time"
                  value={morningTime}
                  onChange={(e) => setMorningTime(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block font-display text-sm mb-2">EVENING TIME</label>
                <Input
                  type="time"
                  value={eveningTime}
                  onChange={(e) => setEveningTime(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep('telegram')}>
                  ← BACK
                </Button>
                <Button type="submit" disabled={updateConfig.isPending} className="flex-1">
                  {updateConfig.isPending ? 'ACTIVATING...' : 'ACTIVATE BOT'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
