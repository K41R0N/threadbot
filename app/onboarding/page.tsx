'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';

// Force dynamic rendering (requires authentication at runtime)
export const dynamic = 'force-dynamic';

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const { data: config, isLoading } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (!isLoaded || isLoading) return;

    if (!isSignedIn) {
      router.push('/');
      return;
    }

    // If config exists, redirect to dashboard
    if (config) {
      router.push('/dashboard');
    } else {
      // Start onboarding
      router.push('/setup/notion');
    }
  }, [isLoaded, isSignedIn, config, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl font-display mb-4">LOADING...</div>
      </div>
    </div>
  );
}
