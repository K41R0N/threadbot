import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
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
              <SignedIn>
                <Link href="/dashboard">
                  <Button className="text-xs sm:text-sm px-3 sm:px-4">DASHBOARD</Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20 text-center">
        <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display mb-4 sm:mb-6 leading-tight">
          <span className="block">AUTOMATE YOUR</span>
          <span className="block">NOTION PROMPTS</span>
        </h2>
        <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 text-gray-600 px-4">
          Send scheduled prompts from your Notion database to Telegram and automatically log replies back. 
          Perfect for daily journaling, reflection, and habit tracking.
        </p>
        <SignedOut>
          <SignUpButton mode="modal">
            <Button size="lg" className="bg-white text-black border-white hover:bg-white hover:text-black text-sm sm:text-base px-6 sm:px-8">
              GET STARTED FREE
            </Button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard">
            <Button size="lg" className="text-sm sm:text-base px-6 sm:px-8">GO TO DASHBOARD</Button>
          </Link>
        </SignedIn>
      </section>

      {/* Features */}
      <section className="border-t-2 border-black py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
            <div className="border-2 border-black p-6 sm:p-8">
              <div className="text-4xl sm:text-5xl md:text-6xl font-display mb-3 sm:mb-4">01</div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 sm:mb-3">CONNECT NOTION</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Link your Notion workspace and select the database with your prompts
              </p>
            </div>
            <div className="border-2 border-black p-6 sm:p-8">
              <div className="text-4xl sm:text-5xl md:text-6xl font-display mb-3 sm:mb-4">02</div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 sm:mb-3">SETUP TELEGRAM</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Create your bot and configure message delivery
              </p>
            </div>
            <div className="border-2 border-black p-6 sm:p-8 sm:col-span-2 lg:col-span-1">
              <div className="text-4xl sm:text-5xl md:text-6xl font-display mb-3 sm:mb-4">03</div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 sm:mb-3">SET SCHEDULE</h3>
              <p className="text-sm sm:text-base text-gray-600">
                Choose when you want to receive your prompts
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
            Set up your bot in less than 5 minutes
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-black text-sm sm:text-base px-6 sm:px-8">
                GET STARTED FREE
              </Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-black text-sm sm:text-base px-6 sm:px-8">
                GO TO DASHBOARD
              </Button>
            </Link>
          </SignedIn>
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
