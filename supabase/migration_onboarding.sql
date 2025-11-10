-- ========================================
-- MIGRATION: Add Onboarding Tracking
-- Run this in Supabase SQL Editor
-- ========================================

-- Add onboarding tracking columns to user_subscriptions table
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN user_subscriptions.onboarding_completed IS 'Whether user has completed the onboarding tutorial';
COMMENT ON COLUMN user_subscriptions.onboarding_skipped IS 'Whether user skipped the onboarding tutorial';
