'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

/**
 * Redirect to Settings Telegram tab
 * This page exists for backward compatibility with old links/bookmarks
 */
export default function SetupTelegramPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        router.replace('/');
      } else {
        // Redirect to Settings with telegram tab open
        router.replace('/settings?tab=telegram');
      }
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading state during redirect
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-black mb-4"></div>
        <p className="text-gray-600">Redirecting to Settings...</p>
      </div>
    </div>
  );
}
