'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { UnifiedOnboardingModal } from '@/components/UnifiedOnboardingModal';
import { trpc } from '@/lib/trpc';

export default function OnboardingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  const { data: onboardingStatus, isLoading: statusLoading } = trpc.agent.getOnboardingStatus.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const { data: config } = trpc.bot.getConfig.useQuery(undefined, {
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (!isLoaded || statusLoading) return;

    if (!isSignedIn) {
      router.push('/');
      return;
    }

    // If onboarding completed or skipped, go to dashboard
    if (onboardingStatus?.onboarding_completed || onboardingStatus?.onboarding_skipped) {
      router.push('/dashboard');
      return;
    }

    // If config exists (legacy flow), go to dashboard
    if (config) {
      router.push('/dashboard');
      return;
    }
  }, [isLoaded, isSignedIn, onboardingStatus, config, statusLoading, router]);

  const handleModalClose = () => {
    // Modal handles skipOnboarding internally
    router.push('/dashboard');
  };

  // Show unified modal - it handles welcome screens + path selection + setup
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <UnifiedOnboardingModal
        isOpen={true}
        onClose={handleModalClose}
      />
    </div>
  );
}
