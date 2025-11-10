#!/bin/bash
set -e

# Script to generate Supabase types from database schema
# Uses existing SUPABASE_SERVICE_ROLE_KEY for authentication

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

# Build database URL using the service role key
# Format: postgresql://postgres.{ref}:{service_role_key}@aws-0-{region}.pooler.supabase.com:6543/postgres
DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Generate types using Supabase CLI with linked project
echo "🔗 Generating types using service role key..."
npx supabase@latest gen types typescript \
  --db-url "$DB_URL" \
  > lib/database.types.ts 2>&1 || {
    echo "⚠️  Connection pooler failed, trying direct connection..."

    # Try direct connection format
    DB_URL_DIRECT="postgresql://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${PROJECT_REF}.supabase.co:5432/postgres"
    npx supabase@latest gen types typescript \
      --db-url "$DB_URL_DIRECT" \
      > lib/database.types.ts 2>&1 || {
        echo "❌ Error: Type generation failed with both connection methods"
        echo "💡 Check that SUPABASE_SERVICE_ROLE_KEY is correct"
        exit 1
      }
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
