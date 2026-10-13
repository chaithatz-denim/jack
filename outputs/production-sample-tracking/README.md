# JACK RUSSEL — Production Sample Tracking

A functional front-end prototype for garment sample development from Product Brief through Bulk Approval. It uses realistic seed data and a centralized mock workflow store; no backend is required.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Use `npm run typecheck` and `npm run build` for verification.

## Project structure

- `app/` — Next.js App Router pages: Sample List, New Sample, Sample Detail, My Tasks, Approval Center and Stage Configuration.
- `components/` — application shell plus reusable status, progress, avatar, due-date, alert, metric and confirmation components.
- `lib/types.ts` — type-safe domain entities and status unions.
- `lib/seed.ts` — realistic users, products, factories, stages, size runs, files, tasks, approvals, size specs and activity records.
- `lib/workflow.ts` — progress calculation, transition guards and derived sample status.
- `lib/store.tsx` — React Context mock API/state layer and mutation audit logging.

## Sample workflow

The default workflow has ten stages: Product Brief; Material & Trim Confirmation; Pattern / Size Spec Setup; First Sample Production; First Sample QC Review; Revision Required; Size Run Sample Production; Size Run QC Review; Final Sample Approval; Bulk Approval.

QC rejection marks the review stage rejected, activates the zero-weight Revision Required stage and writes the reason into the audit trail. Size Run QC cannot pass until every required size is approved. Final Sample Approval requires passed Size Run QC; Bulk Approval requires passed Final Sample Approval.

## Progress rules

`calculateSampleProgress()` is the only progress source. Approved/Completed stages receive full weight; In Progress receives 50%; Rejected receives zero. Revision Required always weighs zero. A skipped stage only receives weight when explicitly marked `approvedSkipped`. Progress is capped at 99% until Bulk Approval is approved.

Default weights are 5 / 10 / 10 / 15 / 10 / 0 / 15 / 15 / 10 / 10 = 100%.

## Mock data behavior

All changes live in React Context for the current browser session and reset on refresh. The “Reset demo” control restores the seed. Stage and task mutations update the shared views immediately; workflow mutations append immutable activity entries. Mock upload buttons demonstrate UI behavior but do not persist binary files.

## Production integration notes

Replace the store commands with authenticated API calls while retaining the domain types and workflow helpers. Enforce role permissions, transition guards and append-only audit records again on the server. Add persistent storage, object storage, optimistic concurrency, notification jobs and automated workflow tests before production use.

## Supabase integration scaffold

Supabase client support has been added for the production phase.

- `.env.local.example` contains the required environment variables.
- `lib/supabase/client.ts` creates the browser client.
- `lib/supabase/server.ts` creates the service-role admin client for server-only code.
- `lib/supabase/database.types.ts` defines the core database table types.
- `supabase/migrations/0001_initial_schema.sql` creates production tables and row-level security policies.
- `supabase/storage.sql` creates private storage buckets for sample images and pattern/work files.

The current prototype UI still uses mock state. The next step is replacing `lib/store.tsx` with Supabase-backed API calls and file upload flows.
