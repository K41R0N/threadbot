'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function SetupTelegramPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      toast.success('Telegram connected!');
      router.push('/setup/schedule');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!isSignedIn) {
      router.push('/');
    } else if (!config) {
      router.push('/setup/notion');
    }
  }, [isSignedIn, config, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!botToken || !chatId) {
      toast.error('Please fill in all fields');
      return;
    }

    updateConfig.mutate({
      telegramBotToken: botToken,
      telegramChatId: chatId,
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
            <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-display text-xl">
              2
            </div>
            <span className="font-display text-2xl">TELEGRAM</span>
            <div className="flex-1 h-0.5 bg-gray-300" />
            <div className="w-10 h-10 border-2 border-gray-300 flex items-center justify-center font-display text-xl text-gray-300">
              3
            </div>
            <span className="font-display text-2xl text-gray-300">SCHEDULE</span>
          </div>
        </div>

        <div className="border-2 border-black p-8">
          <h2 className="text-4xl font-display mb-4">SETUP TELEGRAM</h2>
          <p className="text-gray-600 mb-8">
            Create your bot and configure message delivery
          </p>

          <div className="space-y-6 mb-8">
            <div className="border-2 border-black p-6">
              <h3 className="font-display text-xl mb-3">STEP 1: CREATE BOT</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open Telegram and search for @BotFather</li>
                <li>Send /newbot command</li>
                <li>Choose a name and username</li>
                <li>Copy the bot token (long string starting with numbers)</li>
              </ol>
            </div>

            <div className="border-2 border-black p-6">
              <h3 className="font-display text-xl mb-3">STEP 2: GET CHAT ID</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Search for @userinfobot on Telegram</li>
                <li>Start a chat with it</li>
                <li>Copy your Chat ID (numbers only)</li>
                <li>Then start a chat with YOUR bot (the one you just created)</li>
              </ol>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-display text-sm mb-2">BOT TOKEN</label>
              <Input
                type="password"
                placeholder="123456:ABC-DEF..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block font-display text-sm mb-2">CHAT ID</label>
              <Input
                type="text"
                placeholder="123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/setup/notion')}
              >
                BACK
              </Button>
              <Button type="submit" disabled={updateConfig.isPending} className="flex-1">
                {updateConfig.isPending ? 'CONNECTING...' : 'CONTINUE TO SCHEDULE'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
