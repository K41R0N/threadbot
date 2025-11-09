'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DashboardPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();
  
  const { data: config, isLoading: configLoading } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });
  
  const { data: state } = trpc.bot.getState.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      toast.success('Bot status updated');
    },
  });

  const testPrompt = trpc.bot.testPrompt.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Test prompt sent!');
      } else {
        toast.error(result.message || 'Failed to send test prompt');
      }
    },
  });

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      router.push('/');
    } else if (!configLoading && !config) {
      router.push('/onboarding');
    }
  }, [isLoaded, isSignedIn, config, configLoading, router]);

  if (!config) return null;

  const toggleBot = () => {
    updateConfig.mutate({
      isActive: !config.is_active,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-4xl font-display">THREADBOT</h1>
          <div className="flex items-center gap-4">
            <UserButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Status Card */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-4xl font-display mb-2">BOT STATUS</h2>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${config.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="font-display text-xl">
                  {config.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
            </div>
            <Button
              onClick={toggleBot}
              variant={config.is_active ? 'outline' : 'default'}
              disabled={updateConfig.isPending}
            >
              {config.is_active ? 'DEACTIVATE' : 'ACTIVATE'}
            </Button>
          </div>

          {state?.last_prompt_sent_at && (
            <div className="border-t-2 border-black pt-6">
              <h3 className="font-display text-lg mb-3">LAST PROMPT</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Type:</span>
                  <span className="ml-2 font-medium uppercase">{state.last_prompt_type}</span>
                </div>
                <div>
                  <span className="text-gray-600">Sent:</span>
                  <span className="ml-2 font-medium">
                    {format(new Date(state.last_prompt_sent_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Configuration */}
        <div className="border-2 border-black p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-display">CONFIGURATION</h2>
            <Button
              variant="outline"
              onClick={() => router.push('/settings')}
            >
              EDIT SETTINGS
            </Button>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-display text-sm mb-2 text-gray-600">MORNING TIME</h3>
                <p className="text-2xl font-display">{config.morning_time}</p>
              </div>
              <div>
                <h3 className="font-display text-sm mb-2 text-gray-600">EVENING TIME</h3>
                <p className="text-2xl font-display">{config.evening_time}</p>
              </div>
            </div>

            <div>
              <h3 className="font-display text-sm mb-2 text-gray-600">TIMEZONE</h3>
              <p className="text-xl">{config.timezone}</p>
            </div>

            <div>
              <h3 className="font-display text-sm mb-2 text-gray-600">NOTION DATABASE</h3>
              <p className="font-mono text-sm bg-gray-100 p-3 break-all">
                {config.notion_database_id}
              </p>
            </div>

            <div>
              <h3 className="font-display text-sm mb-2 text-gray-600">TELEGRAM CHAT ID</h3>
              <p className="font-mono text-sm bg-gray-100 p-3">
                {config.telegram_chat_id}
              </p>
            </div>
          </div>
        </div>

        {/* Test Prompts */}
        <div className="border-2 border-black p-8">
          <h2 className="text-3xl font-display mb-4">TEST PROMPTS</h2>
          <p className="text-gray-600 mb-6">
            Send a test prompt to verify your bot is working correctly
          </p>
          
          <div className="flex gap-4">
            <Button
              onClick={() => testPrompt.mutate({ type: 'morning' })}
              disabled={testPrompt.isPending}
              variant="outline"
              className="flex-1"
            >
              TEST MORNING
            </Button>
            <Button
              onClick={() => testPrompt.mutate({ type: 'evening' })}
              disabled={testPrompt.isPending}
              variant="outline"
              className="flex-1"
            >
              TEST EVENING
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
