'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function SetupNotionPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [notionToken, setNotionToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  const createConfig = trpc.bot.createConfig.useMutation({
    onSuccess: () => {
      toast.success('Notion connected successfully!');
      router.push('/setup/telegram');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });

  if (!isSignedIn) {
    router.push('/');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!notionToken || !databaseId) {
      toast.error('Please fill in all fields');
      return;
    }

    createConfig.mutate({
      notionToken,
      notionDatabaseId: databaseId,
      telegramBotToken: '',
      telegramChatId: '',
      timezone: 'UTC',
      morningTime: '09:00',
      eveningTime: '18:00',
      isActive: false,
    });
  };

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
            <div className="w-10 h-10 border-2 border-black flex items-center justify-center font-display text-xl">
              1
            </div>
            <span className="font-display text-2xl">NOTION</span>
            <div className="flex-1 h-0.5 bg-gray-300" />
            <div className="w-10 h-10 border-2 border-gray-300 flex items-center justify-center font-display text-xl text-gray-300">
              2
            </div>
            <span className="font-display text-2xl text-gray-300">TELEGRAM</span>
            <div className="flex-1 h-0.5 bg-gray-300" />
            <div className="w-10 h-10 border-2 border-gray-300 flex items-center justify-center font-display text-xl text-gray-300">
              3
            </div>
            <span className="font-display text-2xl text-gray-300">SCHEDULE</span>
          </div>
        </div>

        <div className="border-2 border-black p-8">
          <h2 className="text-4xl font-display mb-4">CONNECT NOTION</h2>
          <p className="text-gray-600 mb-8">
            Link your Notion workspace and select the database with your prompts
          </p>

          <div className="space-y-6 mb-8">
            <div className="border-2 border-black p-6">
              <h3 className="font-display text-xl mb-3">STEP 1: CREATE INTEGRATION</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener" className="underline">notion.so/my-integrations</a></li>
                <li>Click "+ New integration"</li>
                <li>Name it "Threadbot"</li>
                <li>Copy the "Internal Integration Secret"</li>
              </ol>
            </div>

            <div className="border-2 border-black p-6">
              <h3 className="font-display text-xl mb-3">STEP 2: SHARE DATABASE</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open your Notion database</li>
                <li>Click "..." → "Connections"</li>
                <li>Add your "Threadbot" integration</li>
              </ol>
            </div>

            <div className="border-2 border-black p-6">
              <h3 className="font-display text-xl mb-3">STEP 3: GET DATABASE ID</h3>
              <p className="text-sm mb-2">Copy the 32-character ID from your database URL:</p>
              <p className="font-mono text-xs bg-gray-100 p-2">
                notion.so/workspace/<span className="bg-yellow-200">abc123...</span>?v=...
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-display text-sm mb-2">NOTION TOKEN</label>
              <Input
                type="password"
                placeholder="secret_..."
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block font-display text-sm mb-2">DATABASE ID</label>
              <Input
                type="text"
                placeholder="abc123def456..."
                value={databaseId}
                onChange={(e) => setDatabaseId(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={createConfig.isPending} className="w-full">
              {createConfig.isPending ? 'CONNECTING...' : 'CONTINUE TO TELEGRAM'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
