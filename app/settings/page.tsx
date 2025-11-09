'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  const { data: config, isLoading: configLoading } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const [notionToken, setNotionToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [timezone, setTimezone] = useState('');
  const [morningTime, setMorningTime] = useState('');
  const [eveningTime, setEveningTime] = useState('');
  const [promptSource, setPromptSource] = useState<'notion' | 'agent'>('notion');

  const [showNotionToken, setShowNotionToken] = useState(false);
  const [showTelegramToken, setShowTelegramToken] = useState(false);

  useEffect(() => {
    if (config) {
      setDatabaseId(config.notion_database_id || '');
      setTelegramChatId(config.telegram_chat_id || '');
      setTimezone(config.timezone || 'UTC');
      setMorningTime(config.morning_time || '09:00');
      setEveningTime(config.evening_time || '18:00');
      setPromptSource(config.prompt_source || 'notion');
    }
  }, [config]);

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      toast.success('Settings updated successfully!');
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const setupWebhookForUser = trpc.bot.setupWebhookForUser.useMutation();

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/');
    } else if (!configLoading && !config) {
      router.push('/onboarding');
    }
  }, [isLoaded, isSignedIn, config, configLoading, router]);

  if (!config) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updateData: any = {
      timezone,
      morningTime,
      eveningTime,
      promptSource,
    };

    // Only update Notion settings if using Notion source
    if (promptSource === 'notion') {
      if (notionToken) updateData.notionToken = notionToken;
      if (databaseId !== config.notion_database_id) updateData.notionDatabaseId = databaseId;
    }

    if (telegramChatId !== config.telegram_chat_id) updateData.telegramChatId = telegramChatId;

    // If telegram bot token is updated, reconfigure webhook
    const shouldUpdateWebhook = telegramBotToken.trim() !== '';
    if (shouldUpdateWebhook) {
      updateData.telegramBotToken = telegramBotToken;
    }

    try {
      await updateConfig.mutateAsync(updateData);

      // Reconfigure webhook if telegram token was updated
      if (shouldUpdateWebhook) {
        await setupWebhookForUser.mutateAsync();
      }
    } catch (error) {
      console.error('Settings update error:', error);
    }
  };

  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                ← BACK
              </Button>
              <h1 className="text-4xl font-display">SETTINGS</h1>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/agent')}
            >
              AGENT
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Prompt Source Selection */}
          <div className="border-2 border-black p-8">
            <h2 className="text-3xl font-display mb-4">PROMPT SOURCE</h2>
            <p className="text-gray-600 mb-6">
              Choose where your daily prompts come from
            </p>

            <div className="space-y-4">
              <label className="flex items-start gap-4 p-4 border-2 border-black cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="promptSource"
                  value="notion"
                  checked={promptSource === 'notion'}
                  onChange={(e) => setPromptSource(e.target.value as 'notion' | 'agent')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-display text-lg mb-1">NOTION DATABASE</div>
                  <div className="text-sm text-gray-600">
                    Fetch prompts from your Notion database. You manage prompts manually in Notion.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 border-2 border-black cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="promptSource"
                  value="agent"
                  checked={promptSource === 'agent'}
                  onChange={(e) => setPromptSource(e.target.value as 'notion' | 'agent')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-display text-lg mb-1">AI AGENT</div>
                  <div className="text-sm text-gray-600">
                    AI-generated prompts based on your brand context. Visit the Agent tab to set up.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Notion Settings */}
          {promptSource === 'notion' && (
            <div className="border-2 border-black p-8">
            <h2 className="text-3xl font-display mb-6">NOTION</h2>

            <div className="space-y-6">
              <div>
                <label className="block font-display text-sm mb-2">
                  NOTION TOKEN
                  <span className="text-gray-500 ml-2">(leave blank to keep current)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showNotionToken ? 'text' : 'password'}
                    placeholder="secret_..."
                    value={notionToken}
                    onChange={(e) => setNotionToken(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNotionToken(!showNotionToken)}
                  >
                    {showNotionToken ? 'HIDE' : 'SHOW'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block font-display text-sm mb-2">DATABASE ID</label>
                <Input
                  type="text"
                  placeholder="abc123def456..."
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  required={promptSource === 'notion'}
                />
              </div>
            </div>
          </div>
          )}

          {/* Telegram Settings */}
          <div className="border-2 border-black p-8">
            <h2 className="text-3xl font-display mb-6">TELEGRAM</h2>

            <div className="space-y-6">
              <div>
                <label className="block font-display text-sm mb-2">
                  BOT TOKEN
                  <span className="text-gray-500 ml-2">(leave blank to keep current)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    type={showTelegramToken ? 'text' : 'password'}
                    placeholder="1234567890:ABC..."
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTelegramToken(!showTelegramToken)}
                  >
                    {showTelegramToken ? 'HIDE' : 'SHOW'}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Changing the bot token will automatically reconfigure the webhook
                </p>
              </div>

              <div>
                <label className="block font-display text-sm mb-2">CHAT ID</label>
                <Input
                  type="text"
                  placeholder="123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="border-2 border-black p-8">
            <h2 className="text-3xl font-display mb-6">SCHEDULE</h2>

            <div className="space-y-6">
              <div>
                <label className="block font-display text-sm mb-2">TIMEZONE</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full border-2 border-black px-4 py-3 font-display text-sm"
                  required
                >
                  {commonTimezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
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
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="flex-1"
            >
              CANCEL
            </Button>
            <Button
              type="submit"
              disabled={updateConfig.isPending}
              className="flex-1"
            >
              {updateConfig.isPending ? 'SAVING...' : 'SAVE CHANGES'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
