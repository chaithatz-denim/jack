# Supabase setup for JACK RUSSEL Production Sample Tracking

This folder prepares the production database and private file storage layer.

## 1. Create a Supabase project

Create a new Supabase project from the Supabase Dashboard, then copy:

- Project URL
- anon public key
- service role key

## 2. Configure local environment

Copy `.env.local.example` to `.env.local` and fill the Supabase values.

```bash
cp .env.local.example .env.local
```

## 3. Create schema

Open Supabase Dashboard > SQL Editor and run:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/storage.sql`

## 4. Storage buckets

The SQL creates two private buckets:

- `sample-images` for product/profile images
- `sample-files` for Pattern PDFs and production evidence files

Files should be accessed with signed URLs in the application.

## 5. Vercel environment variables

Add the same variables in Vercel Project Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Redeploy after adding variables.

## Current status

Supabase client helpers and SQL schema are installed, but the existing UI still uses the in-memory mock store / standalone HTML prototype. The next implementation phase is replacing mock store actions with Supabase queries and upload APIs.
