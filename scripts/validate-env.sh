#!/bin/bash
set -e

# Validate required environment variables before build
# This prevents deploying with missing configuration

echo "🔍 Validating environment variables..."

# Define required environment variables
required_vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  "CLERK_SECRET_KEY"
  "NEXT_PUBLIC_APP_URL"
  "CRON_SECRET"
  "TELEGRAM_WEBHOOK_SECRET"
)

# Track validation failures
missing_vars=()

# Check each required variable
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  else
    echo "  ✅ $var is set"
  fi
done

# Report results
if [ ${#missing_vars[@]} -eq 0 ]; then
  echo "✅ All required environment variables are set"
  exit 0
else
  echo ""
  echo "❌ Missing required environment variables:"
  for var in "${missing_vars[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Please set these variables in your environment or .env file."
  echo "See README.md for details on each variable."
  exit 1
fi
