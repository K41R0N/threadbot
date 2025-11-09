'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

export default function SetupSchedulePage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [morningTime, setMorningTime] = useState('09:00');
  const [eveningTime, setEveningTime] = useState('18:00');
  const [timezone, setTimezone] = useState('UTC');

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: async () => {
      // Set up webhook
      if (config?.telegram_bot_token && user?.id) {
        const webhookUrl = `${window.location.origin}/api/webhook/${user.id}`;
        try {
          await setupWebhook.mutateAsync({
            botToken: config.telegram_bot_token,
            webhookUrl,
          });
        } catch (error) {
          console.error('Webhook setup failed:', error);
        }
      }
      
      toast.success('Bot activated!');
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  const setupWebhook = trpc.bot.setupWebhook.useMutation();

  useEffect(() => {
    if (!isSignedIn) {
      router.push('/');
    } else if (!config) {
      router.push('/setup/notion');
    } else if (!config.telegram_bot_token) {
      router.push('/setup/telegram');
    }
  }, [isSignedIn, config, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateConfig.mutate({
      morningTime,
      eveningTime,
      timezone,
      isActive: true,
    });
  };

  if (!config) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-4xl font-display">THREADBOT</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-display text-xl bg-black text-white">
              ✓
            </div>
            <span className="font-display text-2xl">NOTION</span>
            <div className="flex-1 h-0.5 bg-black" />
            <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-display text-xl bg-black text-white">
              ✓
            </div>
            <span className="font-display text-2xl">TELEGRAM</span>
            <div className="flex-1 h-0.5 bg-black" />
            <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-display text-xl">
              3
            </div>
            <span className="font-display text-2xl">SCHEDULE</span>
          </div>
        </div>

        <div className="border-2 border-black p-8">
          <h2 className="text-4xl font-display mb-4">SET SCHEDULE</h2>
          <p className="text-gray-600 mb-8">
            Choose when you want to receive your prompts
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div>
              <label className="block font-display text-sm mb-2">TIMEZONE</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-12 w-full border-2 border-black bg-white px-4 py-2 text-sm"
                required
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-2 border-black bg-black text-white p-6">
              <h3 className="font-display text-xl mb-2">READY TO START</h3>
              <p className="text-sm text-gray-300">
                Your bot will send prompts from Notion at the times you've chosen.
                When you reply in Telegram, responses will be logged back to Notion.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/setup/telegram')}
              >
                BACK
              </Button>
              <Button type="submit" disabled={updateConfig.isPending} className="flex-1">
                {updateConfig.isPending ? 'ACTIVATING...' : 'ACTIVATE BOT'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
