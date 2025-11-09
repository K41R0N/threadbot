import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b-2 border-black">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <h1 className="text-4xl font-display">THREADBOT</h1>
          <div className="flex gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost">SIGN IN</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>GET STARTED</Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button>DASHBOARD</Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-7xl font-display mb-6">
          AUTOMATE YOUR<br />NOTION PROMPTS
        </h2>
        <p className="text-xl max-w-2xl mx-auto mb-12 text-gray-600">
          Send scheduled prompts from your Notion database to Telegram and automatically log replies back. 
          Perfect for daily journaling, reflection, and habit tracking.
        </p>
        <SignedOut>
          <SignUpButton mode="modal">
            <Button size="lg" className="bg-white text-black border-white hover:bg-white hover:text-black">GET STARTED FREE</Button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <Link href="/dashboard">
            <Button size="lg">GO TO DASHBOARD</Button>
          </Link>
        </SignedIn>
      </section>

      {/* Features */}
      <section className="border-t-2 border-black py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="border-2 border-black p-8">
              <div className="text-6xl font-display mb-4">01</div>
              <h3 className="text-2xl font-display mb-3">CONNECT NOTION</h3>
              <p className="text-gray-600">
                Link your Notion workspace and select the database with your prompts
              </p>
            </div>
            <div className="border-2 border-black p-8">
              <div className="text-6xl font-display mb-4">02</div>
              <h3 className="text-2xl font-display mb-3">SETUP TELEGRAM</h3>
              <p className="text-gray-600">
                Create your bot and configure message delivery
              </p>
            </div>
            <div className="border-2 border-black p-8">
              <div className="text-6xl font-display mb-4">03</div>
              <h3 className="text-2xl font-display mb-3">SET SCHEDULE</h3>
              <p className="text-gray-600">
                Choose when you want to receive your prompts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t-2 border-black py-20 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-5xl font-display mb-6">READY TO START?</h2>
          <p className="text-xl mb-8 text-gray-300">
            Set up your bot in less than 5 minutes
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-black">
                GET STARTED FREE
              </Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-black">
                GO TO DASHBOARD
              </Button>
            </Link>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© 2025 Threadbot. Built with Notion API and Telegram Bot API.</p>
        </div>
      </footer>
    </div>
  );
}
