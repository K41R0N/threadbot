'use client';

import { SignInButton, SignUpButton, SignedIn, SignedOut, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // Redirect signed-in users to dashboard
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading state while checking auth
  if (isLoaded && isSignedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display mb-2">Redirecting...</h1>
          <p className="text-gray-600">Taking you to your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-white z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex justify-between items-center gap-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display">THREADBOT</h1>
            <div className="flex gap-2 sm:gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="ghost" className="text-xs sm:text-sm px-3 sm:px-4">SIGN IN</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="text-xs sm:text-sm px-3 sm:px-4">GET STARTED</Button>
                </SignUpButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20 text-center">
        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display mb-4 sm:mb-6 leading-tight">
          <span className="block">AI-POWERED DAILY</span>
          <span className="block">PROMPTS TO TELEGRAM</span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-6 sm:mb-8 text-gray-600 px-4">
          Generate personalized prompts with AI or use your Notion database. Receive them daily on Telegram and log your responses automatically.
        </p>
        <div className="mb-8 sm:mb-12">
          <div className="inline-flex flex-wrap justify-center gap-3 sm:gap-4 text-sm sm:text-base text-gray-700">
            <span className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span>AI-Generated Prompts</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <span>Notion Integration</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-2">
              <span className="text-lg">📱</span>
              <span>Telegram Delivery</span>
            </span>
          </div>
        </div>
        <SignedOut>
          <SignUpButton mode="modal">
            <Button size="lg" className="bg-white text-black border-white hover:bg-white hover:text-black text-sm sm:text-base px-6 sm:px-8">
              GET STARTED FREE
            </Button>
          </SignUpButton>
        </SignedOut>
      </section>

      {/* Features */}
      <section className="border-t-2 border-black py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
            <div className="border-2 border-black p-6 sm:p-8">
              <div className="text-4xl sm:text-5xl md:text-6xl font-display mb-3 sm:mb-4">01</div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 sm:mb-3">CHOOSE YOUR PATH</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Use AI to generate personalized prompts from your brand context, or connect your existing Notion database
              </p>
            </div>
            <div className="border-2 border-black p-6 sm:p-8">
              <div className="text-4xl sm:text-5xl md:text-6xl font-display mb-3 sm:mb-4">02</div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 sm:mb-3">CONNECT TELEGRAM</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Link your Telegram account with a simple verification code. No bot setup required
              </p>
            </div>
            <div className="border-2 border-black p-6 sm:p-8 sm:col-span-2 lg:col-span-1">
              <div className="text-4xl sm:text-5xl md:text-6xl font-display mb-3 sm:mb-4">03</div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 sm:mb-3">RECEIVE & RESPOND</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Get prompts twice daily at your chosen times. Reply directly in Telegram and responses are automatically logged
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t-2 border-black py-12 sm:py-16 md:py-20 bg-black text-white">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display mb-4 sm:mb-6">READY TO START?</h2>
          <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-gray-300 px-4">
            Create your first AI-generated prompt database or connect your Notion workspace. Set up in minutes.
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-black text-sm sm:text-base px-6 sm:px-8">
                GET STARTED FREE
              </Button>
            </SignUpButton>
          </SignedOut>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black py-6 sm:py-8">
        <div className="container mx-auto px-4 sm:px-6 text-center text-gray-600">
          <p className="text-xs sm:text-sm">© 2025 Threadbot. Built with Notion API and Telegram Bot API.</p>
        </div>
      </footer>
    </div>
  );
}
