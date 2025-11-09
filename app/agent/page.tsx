'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main dashboard (databases are now shown there)
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-display mb-2">Redirecting...</h1>
        <p className="text-gray-600">Taking you to your dashboard</p>
      </div>
    </div>
  );
}
