# Supabase Type Generation

This project automatically generates TypeScript types from your Supabase database schema before each build.

## How It Works

1. Before every build, `scripts/generate-types.sh` runs automatically
2. The script connects to your Supabase database using the Supabase CLI
3. Types are generated and saved to `lib/database.ts`
4. The build proceeds with up-to-date types

## Vercel Setup

Type generation uses your **existing environment variables** - no additional setup required!

The script automatically uses:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` (already set)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (already set)

The service role key provides database access for type generation.

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
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Vercel
- Check that the service role key has not expired
- Check Vercel build logs for detailed error messages

### Types are outdated
- Types are regenerated on every build
- For local development, run `pnpm types:generate` after schema changes
- Consider adding a git pre-commit hook to regenerate types
- Types file: `lib/database.ts`

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
- `lib/database.ts` - Generated types (auto-generated, don't edit manually)
- `package.json` - Build scripts configuration
