'use client';

import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  currentPage: 'dashboard' | 'settings';
  showSettingsButton?: boolean;
}

/**
 * Shared authenticated layout for dashboard and settings pages
 * Provides consistent header, navigation, and breadcrumb structure
 */
export function AuthenticatedLayout({
  children,
  currentPage,
  showSettingsButton = true,
}: AuthenticatedLayoutProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <header className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-4">
            <h1
              className="text-4xl font-display cursor-pointer hover:text-gray-700 transition"
              onClick={() => router.push('/dashboard')}
            >
              THREADBOT
            </h1>
            <div className="flex items-center gap-3">
              {showSettingsButton && currentPage !== 'settings' && (
                <Button
                  variant="outline"
                  onClick={() => router.push('/settings')}
                >
                  SETTINGS
                </Button>
              )}
              {currentPage === 'settings' && (
                <Button
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                >
                  ← DASHBOARD
                </Button>
              )}
              <UserButton />
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="text-sm text-gray-600">
            <span className="font-display">
              {currentPage === 'dashboard' ? 'Dashboard' : 'Settings'}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      {children}
    </div>
  );
}
