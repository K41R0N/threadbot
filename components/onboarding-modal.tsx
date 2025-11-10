'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const completeOnboarding = trpc.agent.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success('Welcome to Threadbot!');
      onClose();
    },
  });

  const skipOnboarding = trpc.agent.skipOnboarding.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to Threadbot',
      icon: '🤖',
      description: 'Your AI-powered journaling companion that delivers daily prompts to Telegram and logs your reflections.',
      bullets: [
        'AI generates personalized prompts based on your brand',
        'Prompts delivered to Telegram twice daily',
        'Responses automatically logged',
      ],
    },
    {
      title: 'How It Works',
      icon: '⚡',
      description: 'Threadbot makes daily reflection effortless with three simple steps:',
      bullets: [
        '1. Create an AI Database - Generate 60 prompts for the month',
        '2. Connect Telegram - Set up your bot and schedule',
        '3. Receive & Respond - Get prompts twice daily, reply directly in Telegram',
      ],
    },
    {
      title: 'Choose Your Workflow',
      icon: '🎯',
      description: 'Pick the approach that works best for you:',
      bullets: [
        '🤖 AI Agent - Let AI generate themed prompts (DeepSeek = Free, Claude = 1 credit)',
        '📝 Notion - Connect your own Notion database of prompts',
        'You can switch between them anytime in Settings',
      ],
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding.mutate();
    }
  };

  const handleSkip = () => {
    skipOnboarding.mutate();
  };

  const handleGetStarted = () => {
    completeOnboarding.mutate();
    router.push('/agent/create');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white border-4 border-black max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Progress Bar */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* Icon & Title */}
          <div className="text-center mb-8">
            <div className="text-7xl mb-4">{currentStepData.icon}</div>
            <h2 className="text-4xl font-display mb-3">{currentStepData.title}</h2>
            <p className="text-lg text-gray-600">{currentStepData.description}</p>
          </div>

          {/* Bullets */}
          <div className="space-y-4 mb-8">
            {currentStepData.bullets.map((bullet, index) => (
              <div
                key={index}
                className="flex items-start gap-3 text-gray-700 animate-in slide-in-from-left duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                <p className="text-base">{bullet}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t-2 border-gray-200">
            <Button variant="outline" onClick={handleSkip} disabled={skipOnboarding.isPending}>
              SKIP FOR NOW
            </Button>

            <div className="flex items-center gap-2">
              {/* Step Indicators */}
              <div className="flex gap-2 mr-4">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentStep ? 'bg-black w-6' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              {currentStep === steps.length - 1 ? (
                <Button onClick={handleGetStarted} disabled={completeOnboarding.isPending}>
                  GET STARTED →
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  NEXT →
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
