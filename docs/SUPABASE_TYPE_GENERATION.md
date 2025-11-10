# Supabase Type Generation

This project automatically generates TypeScript types from your Supabase database schema before each build.

## How It Works

1. Before every build, `scripts/generate-types.sh` runs automatically
2. The script connects to your Supabase database using the Supabase CLI
3. Types are generated and saved to `lib/database.types.ts`
4. The build proceeds with up-to-date types

## Vercel Setup (Required)

To enable automatic type generation on Vercel, you need to add **one** environment variable:

### Option 1: Using Supabase Access Token (Recommended)

1. Go to [Supabase Access Tokens](https://app.supabase.com/account/tokens)
2. Click "Generate New Token"
3. Give it a name (e.g., "Vercel Type Generation")
4. Copy the token
5. In Vercel:
   - Go to your project settings
   - Navigate to Environment Variables
   - Add: `SUPABASE_ACCESS_TOKEN` = `<your-token>`
   - Apply to: Production, Preview, and Development

### Option 2: Using Database Connection (Alternative)

If you can't use an access token, the script will attempt to connect directly using your existing environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` (already set)
- `SUPABASE_SERVICE_ROLE_KEY` (already set)

This may not work in all cases due to network restrictions.

## Local Development

Generate types manually:

```bash
# Generate types from your database
pnpm types:generate

# Or run dev with auto-generation
pnpm dev
```

## Manual Scripts

```bash
# Generate types only
pnpm types:generate

# Build without generating types (faster for local testing)
pnpm build:skip-types

# Normal build with type generation
pnpm build
```

## Troubleshooting

### Error: "Could not extract project reference"
- Check that `NEXT_PUBLIC_SUPABASE_URL` is in the format: `https://xxxxx.supabase.co`

### Error: "Type generation failed"
- Ensure `SUPABASE_ACCESS_TOKEN` is set in Vercel environment variables
- Verify the token has read permissions for your project
- Check Vercel build logs for detailed error messages

### Types are outdated
- Types are regenerated on every build
- For local development, run `pnpm types:generate` after schema changes
- Consider adding a git pre-commit hook to regenerate types

## Benefits

✅ **Always up-to-date**: Types match your database schema exactly
✅ **Prevents type errors**: Catch schema mismatches at build time
✅ **No manual maintenance**: No need to manually update `database.types.ts`
✅ **Better DX**: Get accurate autocomplete and type checking

## Removing @ts-expect-error Comments

Once type generation is working and a new version of `@supabase/supabase-js` is released with fixed type inference, you can:

1. Upgrade Supabase: `pnpm update @supabase/supabase-js@latest`
2. Test the build: `pnpm build`
3. If successful, remove all `@ts-expect-error` comments from:
   - `server/routers.ts`
   - `server/routers/agent.ts`
   - `server/services/bot.ts`

## Related Files

- `scripts/generate-types.sh` - Generation script
- `lib/database.types.ts` - Generated types (auto-generated, don't edit manually)
- `package.json` - Build scripts configuration
