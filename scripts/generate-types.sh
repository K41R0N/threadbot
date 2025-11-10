#!/bin/bash
set -e

# Script to generate Supabase types from database schema
# Runs automatically before Vercel builds

echo "🔄 Generating Supabase types..."

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL is not set"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY is not set"
  exit 1
fi

# Extract project reference from URL
# Format: https://xxxxx.supabase.co -> xxxxx
PROJECT_REF=$(echo "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Error: Could not extract project reference from NEXT_PUBLIC_SUPABASE_URL"
  exit 1
fi

echo "📋 Project Reference: $PROJECT_REF"

# Generate types using Supabase CLI
# Using the project-id flag with direct database connection
npx supabase@latest gen types typescript \
  --project-id "$PROJECT_REF" \
  --db-url "postgresql://postgres:[password]@db.${PROJECT_REF}.supabase.co:5432/postgres" \
  > lib/database.types.ts 2>/dev/null || {
    echo "⚠️  Direct connection failed, trying with access token..."

    # Alternative: Use Supabase access token if available
    if [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
      npx supabase@latest gen types typescript \
        --project-id "$PROJECT_REF" \
        --token "$SUPABASE_ACCESS_TOKEN" \
        > lib/database.types.ts
    else
      echo "❌ Error: Type generation failed. Set SUPABASE_ACCESS_TOKEN in Vercel environment variables."
      echo "💡 Get your access token from: https://app.supabase.com/account/tokens"
      exit 1
    fi
  }

# Check if types were generated successfully
if [ -s lib/database.types.ts ]; then
  echo "✅ Types generated successfully!"
  echo "📝 File: lib/database.types.ts"
  echo ""
  wc -l lib/database.types.ts
else
  echo "❌ Error: Type generation failed - file is empty or missing"
  exit 1
fi
