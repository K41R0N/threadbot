'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

import { toast } from 'sonner';

// Get bot username from environment or use default
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'threadbot_bot';

export default function SetupTelegramPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  
  // Auto-detect timezone from browser
  const [detectedTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'America/New_York'; // Fallback
    }
  });

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const generateCode = trpc.bot.generateVerificationCode.useMutation({
    onSuccess: (data) => {
      setVerificationCode(data.code);
      setIsWaiting(true);
      toast.success('Verification code generated!');
    },
    onError: (error) => {
      toast.error(`Failed to generate code: ${error.message}`);
    },
  });

  // Poll to check if chat ID was linked
  const { data: linkStatus } = trpc.bot.checkChatIdLinked.useQuery(undefined, {
    enabled: isWaiting && !!verificationCode,
    refetchInterval: 2000, // Check every 2 seconds
  });

  useEffect(() => {
    if (!isSignedIn) {
      router.push('/');
    } else if (!config) {
      router.push('/setup/notion');
    }
  }, [isSignedIn, config, router]);

  useEffect(() => {
    if (linkStatus?.linked) {
      toast.success('Telegram connected!');
      router.push('/setup/schedule');
    }
  }, [linkStatus, router]);

  const handleOpenTelegram = () => {
    // Pass detected timezone to the mutation
    generateCode.mutate({ timezone: detectedTimezone });
    // Open Telegram app or web
    const telegramUrl = `https://t.me/${BOT_USERNAME}`;
    window.open(telegramUrl, '_blank');
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

          <div className="space-y-6">
            {!verificationCode ? (
              <>
                <div className="border-2 border-black p-6 bg-gray-50">
                  <h3 className="font-display text-xl mb-3">AUTOMATIC CONNECTION</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Click the button below to open Telegram and we'll automatically link your account when you say "hello"!
                  </p>
                  <Button
                    onClick={handleOpenTelegram}
                    disabled={generateCode.isPending}
                    size="lg"
                    className="w-full"
                  >
                    {generateCode.isPending ? 'GENERATING CODE...' : '📱 OPEN TELEGRAM'}
                  </Button>
                </div>

                <div className="border-t-2 border-gray-200 pt-6">
                  <p className="text-sm text-gray-600 mb-4 text-center">OR</p>
                  <div className="border-2 border-black p-6">
                    <h3 className="font-display text-xl mb-3">MANUAL SETUP</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm mb-4">
                      <li>Get your Chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline">@userinfobot</a></li>
                      <li>Enter it below and continue</li>
                    </ol>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/setup/schedule')}
                      className="w-full"
                    >
                      SKIP FOR NOW
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="border-2 border-black p-8 bg-gray-50">
                <div className="text-center mb-6">
                  <div className="text-6xl font-display mb-4 tracking-wider border-4 border-black p-6 bg-white">
                    {verificationCode}
                  </div>
                  <p className="text-lg font-display mb-2">YOUR VERIFICATION CODE</p>
                  <p className="text-sm text-gray-600 mb-6">
                    Send this code to <strong>@{BOT_USERNAME}</strong> on Telegram, or just say "hello"
                  </p>
                </div>

                {isWaiting && (
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
                    <p className="text-sm text-gray-600">Waiting for you to send the code...</p>
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setVerificationCode(null);
                      setIsWaiting(false);
                    }}
                    className="flex-1"
                  >
                    CANCEL
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      const telegramUrl = `https://t.me/${BOT_USERNAME}`;
                      window.open(telegramUrl, '_blank');
                    }}
                    className="flex-1"
                  >
                    OPEN TELEGRAM
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/setup/notion')}
              >
                BACK
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
