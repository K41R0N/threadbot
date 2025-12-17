'use client';

import { useRouter } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AuthenticatedLayoutProps {
  children: ReactNode;
  // Simple mode for dashboard/settings
  currentPage?: 'dashboard' | 'settings';
  showSettingsButton?: boolean;
  // Advanced mode for custom pages
  pageTitle?: string;
  pageSubtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  showBackButton?: boolean;
  backButtonHref?: string;
  backButtonDisabled?: boolean;
  rightActions?: ReactNode;
  headerExtra?: ReactNode; // For progress indicators, etc.
}

/**
 * Shared authenticated layout for all authenticated pages
 * Provides consistent header, navigation, and breadcrumb structure
 */
export function AuthenticatedLayout({
  children,
  currentPage,
  showSettingsButton = true,
  pageTitle,
  pageSubtitle,
  breadcrumbs,
  showBackButton = false,
  backButtonHref = '/dashboard',
  backButtonDisabled = false,
  rightActions,
  headerExtra,
}: AuthenticatedLayoutProps) {
  const router = useRouter();

  // Simple mode: use currentPage for dashboard/settings
  const pageLabels: Record<'dashboard' | 'settings', string> = {
    dashboard: 'Dashboard',
    settings: 'Settings',
  };

  // Build breadcrumbs
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (breadcrumbs) return breadcrumbs;
    
    if (currentPage === 'settings') {
      return [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Settings' },
      ];
    }
    
    if (currentPage === 'dashboard') {
      return [{ label: 'Dashboard' }];
    }
    
    // Default: Dashboard as first item if custom page
    if (pageTitle) {
      return [{ label: 'Dashboard', href: '/dashboard' }, { label: pageTitle }];
    }
    
    return [];
  };

  const finalBreadcrumbs = getBreadcrumbs();
  const displayTitle = pageTitle || (currentPage ? pageLabels[currentPage] : '');
  const showDefaultActions = !rightActions;

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Navigation */}
      <header className="border-b border-gray-200 sticky top-0 bg-white z-50">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Main header row */}
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Logo + Back Button + Breadcrumb */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center group flex-shrink-0"
              >
                <h1 className="text-lg sm:text-xl md:text-2xl font-display text-black group-hover:text-gray-700 transition-colors tracking-tight">
                  THREADBOT
                </h1>
              </button>
              
              {/* Back Button */}
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(backButtonHref)}
                  disabled={backButtonDisabled}
                  className="text-xs sm:text-sm h-7 sm:h-8 px-2 font-display hover:bg-gray-100 flex-shrink-0"
                >
                  ← Back
                </Button>
              )}

              {/* Breadcrumb */}
              {finalBreadcrumbs.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
                  <span className="text-gray-300">/</span>
                  {finalBreadcrumbs.map((crumb, index) => {
                    const isLast = index === finalBreadcrumbs.length - 1;
                    return (
                      <span key={index} className="flex items-center gap-2">
                        {crumb.href && !isLast ? (
                          <button
                            onClick={() => router.push(crumb.href!)}
                            className="text-gray-500 hover:text-black transition-colors font-display whitespace-nowrap"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span className="text-black font-display font-medium whitespace-nowrap">
                            {crumb.label}
                          </span>
                        )}
                        {!isLast && <span className="text-gray-300">/</span>}
                      </span>
                    );
                  })}
                </div>
              )}
              
              {/* Mobile Breadcrumb */}
              <div className="sm:hidden flex items-center gap-1.5 text-xs text-gray-500">
                <span>/</span>
                <span className="font-display">{displayTitle}</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {showDefaultActions && (
                <>
                  {showSettingsButton && currentPage !== 'settings' && !pageTitle && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/settings')}
                      className="text-xs sm:text-sm h-8 px-2 sm:px-3 font-display hover:bg-gray-100"
                    >
                      Settings
                    </Button>
                  )}
                  {currentPage === 'settings' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push('/dashboard')}
                      className="text-xs sm:text-sm h-8 px-2 sm:px-3 font-display hover:bg-gray-100"
                    >
                      ← Dashboard
                    </Button>
                  )}
                  {pageTitle && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/settings')}
                        className="text-xs sm:text-sm h-8 px-2 sm:px-3 font-display hover:bg-gray-100 hidden sm:inline-flex"
                      >
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/dashboard')}
                        className="text-xs sm:text-sm h-8 px-2 sm:px-3 font-display hover:bg-gray-100"
                      >
                        Dashboard
                      </Button>
                    </>
                  )}
                </>
              )}
              
              {/* Custom right actions */}
              {rightActions}
              
              <div className="flex items-center">
                <UserButton />
              </div>
            </div>
          </div>

          {/* Page Title & Subtitle (for custom pages) */}
          {(pageTitle || pageSubtitle) && (
            <div className="pb-3 sm:pb-4 border-b border-gray-100">
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-display text-black">
                  {pageTitle}
                </h2>
                {pageSubtitle && (
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    {pageSubtitle}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Header Extra (progress indicators, etc.) */}
          {headerExtra && (
            <div className="pb-3 sm:pb-4">
              {headerExtra}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      {children}
    </div>
  );
}
