'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout';
import { useLocalStoragePersistence } from '@/lib/hooks/use-local-storage-persistence';
import type { BotConfig } from '@/lib/supabase';


export default function SettingsPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  const { data: config, isLoading: configLoading } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const [notionToken, setNotionToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [timezone, setTimezone] = useState('');
  const [morningTime, setMorningTime] = useState('');
  const [eveningTime, setEveningTime] = useState('');
  const [promptSource, setPromptSource] = useState<'notion' | 'agent'>('notion');

  const [showNotionToken, setShowNotionToken] = useState(false);
  const [shouldClearNotionToken, setShouldClearNotionToken] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [showTestLogs, setShowTestLogs] = useState(false);
  const hasInitialized = useRef(false);
  const shouldSaveToStorage = useRef(false); // Track when to start saving to localStorage

  // Persist form state to localStorage (only for user edits, not server data)
  // Note: enabled is always true to allow restoration, but we control saving via shouldSave
  const { clear: clearPersistence } = useLocalStoragePersistence(
    'threadbot:settings',
    {
      notionToken,
      databaseId,
      telegramChatId,
      timezone,
      morningTime,
      eveningTime,
      promptSource,
    },
    {
      enabled: true, // Always enabled to allow restoration
      onRestore: (restored) => {
        // Only restore if we haven't initialized from server yet
        // This preserves user edits if they navigate away before saving
        if (!hasInitialized.current) {
          if (restored.databaseId) setDatabaseId(restored.databaseId);
          if (restored.telegramChatId) setTelegramChatId(restored.telegramChatId);
          if (restored.timezone) setTimezone(restored.timezone);
          if (restored.morningTime) setMorningTime(restored.morningTime);
          if (restored.eveningTime) setEveningTime(restored.eveningTime);
          if (restored.promptSource) setPromptSource(restored.promptSource);
          if (restored.notionToken) setNotionToken(restored.notionToken);
          // Check if any values were restored
          const hasRestoredValues = Object.values(restored).some(v => v !== '' && v !== null && v !== undefined);
          if (hasRestoredValues) {
            toast.info('Your unsaved changes have been restored');
          }
        }
      },
      // Only save after initialization is complete (prevents saving server data as user edits)
      shouldSave: () => shouldSaveToStorage.current,
    }
  );

  useEffect(() => {
    // Initialize from server config or defaults
    if (!hasInitialized.current && !configLoading) {
      if (config) {
        const botConfig = config as BotConfig;
        setDatabaseId(botConfig.notion_database_id || '');
        setTelegramChatId(botConfig.telegram_chat_id || '');
        // Match server default: 'America/New_York' instead of 'UTC'
        setTimezone(botConfig.timezone || 'America/New_York');
        setMorningTime(botConfig.morning_time || '09:00');
        setEveningTime(botConfig.evening_time || '18:00');
        setPromptSource(botConfig.prompt_source || 'notion');
        // Note: notionToken is intentionally not loaded from server for security
        // Users must re-enter it if they want to update it
      } else {
        // Set defaults for AI-only users without bot_config
        // Match server default: 'America/New_York' instead of 'UTC'
        setTimezone('America/New_York');
        setMorningTime('09:00');
        setEveningTime('18:00');
        setPromptSource('agent'); // Default to agent for AI-only users
      }
      hasInitialized.current = true;
      // Enable saving to localStorage after initialization is complete
      shouldSaveToStorage.current = true;
    }
  }, [config, configLoading]);

  const updateConfig = trpc.bot.updateConfig.useMutation({
    onSuccess: () => {
      // Clear persisted data on successful save
      clearPersistence();
      // Reset clear flags only after successful save
      setShouldClearNotionToken(false);
      toast.success('Settings updated successfully!');
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const setupWebhookForUser = trpc.bot.setupWebhookForUser.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Webhook configured successfully!');
      } else {
        toast.warning(`Webhook setup: ${data.message}`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to setup webhook: ${error.message}`);
    },
  });

  const testTelegramPrompt = trpc.bot.testTelegramPrompt.useMutation({
    onSuccess: (data) => {
      setTestLogs(data.logs || []);
      setShowTestLogs(true);
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      setTestLogs([`❌ Error: ${error.message}`]);
      setShowTestLogs(true);
      toast.error(`Test failed: ${error.message}`);
    },
  });

  const purgeData = trpc.bot.purgeData.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        router.push('/dashboard');
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(`Failed to purge data: ${error.message}`);
    },
  });

  const deleteAccount = trpc.bot.deleteAccount.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        // Redirect to home after account deletion
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/');
    }
    // Note: Allow access to Settings even without bot_config
    // AI-only users need to be able to configure Telegram/Notion later
  }, [isLoaded, isSignedIn, router]);

  // Loading state - only show loader while fetching, not if config is null
  if (configLoading && config === undefined) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b-2 border-black">
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-4xl font-display">THREADBOT</h1>
              <div className="w-24 h-10 bg-gray-200 animate-pulse rounded" />
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-display">Settings</span>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <div className="border-2 border-gray-200 p-8 mb-6 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 mb-6 rounded" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </div>

          <div className="border-2 border-gray-200 p-8 mb-6 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 mb-6 rounded" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </div>

          <div className="border-2 border-gray-200 p-8 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 mb-6 rounded" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Note: config may be null for AI-only users who haven't set up Telegram/Notion
  const botConfig: BotConfig | null = config || null;

  const handleClearNotionToken = () => {
    setShouldClearNotionToken(true);
    setNotionToken('');
    toast.info('Notion token will be cleared when you save');
  };

  // Reset clear flags when user starts typing again
  const handleNotionTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNotionToken(e.target.value);
    if (e.target.value.trim() && shouldClearNotionToken) {
      setShouldClearNotionToken(false);
      toast.info('Clear cancelled - new token will be saved');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Note: config may be null for AI-only users
    const botConfig: BotConfig | null = config || null;

    // Type-safe update data matching server schema
    type ConfigUpdate = {
      timezone: string;
      morningTime: string;
      eveningTime: string;
      promptSource: 'notion' | 'agent';
      notionToken?: string | null;
      notionDatabaseId?: string | null;
      telegramChatId?: string;
    };

    const updateData: ConfigUpdate = {
      timezone,
      morningTime,
      eveningTime,
      promptSource,
    };

    // Only update Notion settings if using Notion source
    if (promptSource === 'notion') {
      // Handle Notion token: check explicit clear flag
      if (shouldClearNotionToken) {
        updateData.notionToken = null; // Clear token
        // Flag will be reset in onSuccess callback
      } else if (notionToken.trim()) {
        updateData.notionToken = notionToken; // Update token
      }

      // Handle database ID
      const currentDatabaseId = botConfig ? (botConfig as BotConfig).notion_database_id : '';
      if (databaseId !== (currentDatabaseId || '')) {
        if (databaseId === '') {
          updateData.notionDatabaseId = null; // Clear database ID
        } else {
          updateData.notionDatabaseId = databaseId;
        }
      }
    }

    const currentChatId = botConfig ? (botConfig as BotConfig).telegram_chat_id : '';
    if (telegramChatId !== (currentChatId || '')) {
      updateData.telegramChatId = telegramChatId;
      // Update webhook when chat ID changes (to ensure routing works)
      try {
        await updateConfig.mutateAsync(updateData);
        // Setup webhook after successful config update
        // Errors are handled by mutation callbacks, but we catch here to prevent crashes
        try {
          await setupWebhookForUser.mutateAsync();
        } catch (webhookError) {
          // Error already handled by onError callback, but log for debugging
          console.error('Webhook setup error:', webhookError);
          // Don't throw - config update succeeded, webhook can be retried later
          toast.warning('Settings saved, but webhook setup failed. You can retry webhook setup from the test button.');
        }
        return;
      } catch (error) {
        // Config update failed - error handled by updateConfig.onError callback
        console.error('Config update error:', error);
        // Don't rethrow - let the mutation's error handler deal with it
        return;
      }
    }

    try {
      await updateConfig.mutateAsync(updateData);
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
    <AuthenticatedLayout currentPage="settings" showSettingsButton={false}>
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
                    onChange={handleNotionTokenChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNotionToken(!showNotionToken)}
                  >
                    {showNotionToken ? 'HIDE' : 'SHOW'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearNotionToken}
                    className="text-red-600 hover:bg-red-50"
                  >
                    CLEAR
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
              <div className="border-2 border-gray-200 p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Shared Bot:</strong> All users share the same Telegram bot (@Threadbot). 
                  You only need to provide your Chat ID to receive messages.
                </p>
              </div>

              <div>
                <label className="block font-display text-sm mb-2">YOUR TELEGRAM CHAT ID</label>
                <Input
                  type="text"
                  placeholder="123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Get your Chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">@userinfobot</a>
                </p>
              </div>

              {/* Test Button */}
              <div className="border-t-2 border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-lg mb-1">TEST YOUR BOT</h3>
                    <p className="text-sm text-gray-600">
                      Send a test prompt to verify your Telegram bot is working
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => testTelegramPrompt.mutate()}
                    disabled={testTelegramPrompt.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {testTelegramPrompt.isPending ? 'TESTING...' : '🧪 TEST NOW'}
                  </Button>
                </div>

                {/* Test Logs */}
                {showTestLogs && testLogs.length > 0 && (
                  <div className="bg-gray-50 border-2 border-gray-200 p-4 rounded">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display text-sm">Test Results:</h4>
                      <button
                        type="button"
                        onClick={() => setShowTestLogs(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        CLOSE
                      </button>
                    </div>
                    <div className="space-y-2">
                      {testLogs.map((log, index) => (
                        <div key={index} className="text-sm font-mono">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

          {/* DANGER ZONE */}
          <div className="border-2 border-red-600 p-8 bg-red-50">
            <h2 className="text-3xl font-display mb-2 text-red-600">⚠️ DANGER ZONE</h2>
            <p className="text-sm text-red-700 mb-6">
              These actions are irreversible. Please be certain before proceeding.
            </p>

            <div className="space-y-6">
              {/* Purge Data */}
              <div className="bg-white border-2 border-red-300 p-6 rounded">
                <h3 className="font-display text-lg mb-2">PURGE ALL DATA</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Remove all your configurations, prompts, and bot data. Your generation credits will be preserved.
                </p>
                <ul className="text-xs text-gray-600 mb-4 space-y-1 list-disc list-inside">
                  <li>Deletes: Telegram/Notion tokens, bot configurations, generated prompts, themes, context</li>
                  <li>Keeps: Generation credits, Stripe billing info</li>
                  <li>You can start fresh while maintaining your credits</li>
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm(
                      'Are you sure you want to purge all your data?\n\n' +
                      'This will delete:\n' +
                      '• All bot configurations and tokens\n' +
                      '• All generated prompts and themes\n' +
                      '• All brand context and settings\n\n' +
                      'Your subscription and credits will be preserved.\n\n' +
                      'This action CANNOT be undone.'
                    )) {
                      purgeData.mutate();
                    }
                  }}
                  disabled={purgeData.isPending}
                  className="border-red-600 text-red-600 hover:bg-red-100"
                >
                  {purgeData.isPending ? 'PURGING...' : 'PURGE ALL DATA'}
                </Button>
              </div>

              {/* Delete Account */}
              <div className="bg-white border-2 border-red-600 p-6 rounded">
                <h3 className="font-display text-lg mb-2 text-red-600">DELETE ACCOUNT</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Permanently delete your account and all associated data from our database.
                </p>
                <ul className="text-xs text-gray-600 mb-4 space-y-1 list-disc list-inside">
                  <li>Deletes: ALL data including subscription, credits, and billing info</li>
                  <li>Does NOT delete your Clerk authentication account (you must do this separately)</li>
                  <li>This action is permanent and cannot be undone</li>
                </ul>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const firstConfirm = window.confirm(
                      '⚠️ DELETE ACCOUNT - FIRST CONFIRMATION\n\n' +
                      'This will PERMANENTLY delete:\n' +
                      '• All bot configurations and tokens\n' +
                      '• All generated prompts and themes\n' +
                      '• All brand context and settings\n' +
                      '• Your subscription and credits\n' +
                      '• All billing information\n\n' +
                      'Are you absolutely sure you want to continue?'
                    );

                    if (firstConfirm) {
                      const secondConfirm = window.confirm(
                        '⚠️ FINAL CONFIRMATION\n\n' +
                        'This is your last chance to cancel.\n\n' +
                        'After this, your account data will be permanently deleted from our database.\n\n' +
                        'Type "DELETE" in the next prompt to confirm.'
                      );

                      if (secondConfirm) {
                        const typeConfirm = window.prompt(
                          'Type DELETE (in capital letters) to confirm account deletion:'
                        );

                        if (typeConfirm === 'DELETE') {
                          deleteAccount.mutate();
                        } else {
                          toast.info('Account deletion cancelled');
                        }
                      }
                    }
                  }}
                  disabled={deleteAccount.isPending}
                  className="bg-red-600 text-white hover:bg-red-700 border-red-600"
                >
                  {deleteAccount.isPending ? 'DELETING...' : 'DELETE ACCOUNT'}
                </Button>
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
    </AuthenticatedLayout>
  );
}
