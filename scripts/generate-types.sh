#!/bin/bash
set -e

# Script to generate Supabase types from database schema
# Uses SUPABASE_SERVICE_ROLE_KEY for direct database access (project-scoped, secure)

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
  echo "Expected format: https://xxxxx.supabase.co"
  exit 1
fi

echo "📋 Project Reference: $PROJECT_REF"

# Build direct database connection URL using service role key
# This is more secure than an access token (project-scoped vs account-wide)
DB_URL="postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres"

# Generate types using Supabase CLI
echo "🔗 Connecting to database..."
npx supabase@latest gen types typescript --db-url "$DB_URL" > lib/database.types.ts

# Check if types were generated successfully
if [ -s lib/database.types.ts ]; then
  echo "✅ Types generated successfully!"
  echo "📝 File: lib/database.types.ts ($(wc -l < lib/database.types.ts) lines)"
else
  echo "❌ Error: Type generation failed - file is empty or missing"
  echo "Check that:"
  echo "  1. SUPABASE_SERVICE_ROLE_KEY is correct"
  echo "  2. Database is accessible from this network"
  echo "  3. Project reference matches your Supabase project"
  exit 1
fi
