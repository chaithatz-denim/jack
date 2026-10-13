# JACK RUSSEL Sample Tracking Backup / Restore Plan

This plan is backend-only and does not affect the application UI.

## Backup scope

- Supabase database tables:
  - `samples`
  - `sample_timeline`
  - `sample_size_specs`
  - `sample_files`
  - `sample_images`
  - `app_users` without `password_hash`
  - `audit_logs`
- Supabase Storage objects and metadata:
  - `sample-files`
  - `sample-images`
- Supabase Storage backup bucket:
  - `system-backups`

## Operating policy

- Run a manual export before any bulk data operation, migration, or workflow rewrite.
- Vercel cron runs automatic backup every day at 02:00 Asia/Bangkok (`/api/cron/backup`).
- Automatic backups in `system-backups` retain the latest 60 days. Every successful backup removes older sets.
- Every successful production backup is copied to the private Vercel Blob store `jack-russel-backups`, outside Supabase, with the same 60-day retention policy.
- Vercel cron runs monitoring every hour (`/api/cron/monitor`).
- Vercel cron runs a non-destructive restore drill monthly (`/api/cron/restore-drill`). The temporary restored sample is archived during verification and deleted immediately after row-count checks pass.
- Set `CRON_SECRET` in Vercel production so cron endpoints are not public.
- Set `ALERT_WEBHOOK_URL` if alerts should be sent outside Vercel logs.
- Keep Supabase PITR / scheduled backups enabled in Supabase if the project plan supports it.
- Treat JSON exports as operational backups only. Full disaster recovery should use Supabase project backups or database dumps.
- Do not commit generated backup files to Git.

## Manual local backup

From `outputs/production-sample-tracking`:

```powershell
npm run backup:readonly
```

The script writes a timestamped folder under `backups/`:

- `database.json`
- `manifest.json`
- `storage/sample-files/...`
- `storage/sample-images/...`

To keep an off-platform copy on the company computer, set `BACKUP_OUTPUT_DIR` before running the command:

```powershell
$env:BACKUP_OUTPUT_DIR='C:\Users\User\Documents\Codex\JACK-RUSSEL-Backups'
npm run backup:readonly
```

## Automatic Supabase Storage backup

The production cron endpoint writes backups to the private `system-backups` bucket:

- `backups/<timestamp>/database.json`
- `backups/<timestamp>/manifest.json`
- `backups/<timestamp>/storage/sample-files/...`
- `backups/<timestamp>/storage/sample-images/...`
- Backup sets older than 60 days are deleted only after the new database and Storage copy succeeds.

## Non-destructive restore verification

`npm run test:restore-backup` restores one archived temporary sample together with its timeline and size-spec rows, verifies the restored values and row counts, then deletes the temporary sample and verifies cleanup. Set `BACKUP_OUTPUT_DIR` to select the off-platform backup folder. The script writes a `restore-verification-*.json` report beside the tested backup.

## Restore approach

1. Stop users from writing new data during restore.
2. Export current data again before restoring.
3. Restore database tables in this order:
   - `app_users`
   - `samples`
   - `sample_timeline`
   - `sample_size_specs`
   - `sample_files`
   - `sample_images`
4. Restore Storage objects from `system-backups` or the local `backups/` folder if binary files were affected.
5. Verify:
   - active sample count
   - user login
   - sample detail page
   - timeline update
   - file signed URL generation
   - size spec save

## Current limitations

- Password hashes are intentionally excluded from local JSON exports.
- Production-grade restore should still use Supabase managed backups or database dump tooling when available.
- Alert delivery depends on `ALERT_WEBHOOK_URL`; without it, degraded checks are recorded in `audit_logs`, Vercel function logs, and the protected `/api/health/deep` endpoint.
- On the Supabase Free Plan, managed daily backups and PITR are unavailable and low-activity projects may be paused. The operational JSON/Storage backup and the off-platform copy must therefore remain enabled and periodically restore-tested.

## Free Plan readiness record

- On 13 October 2026, the owner accepted that a Free Plan project may be paused after a low-activity period and must be resumed manually.
- Remote backup retention was set to 60 days and verified by pruning 47 expired sets; 61 sets remained, with the oldest dated 14 August 2026.
- A complete off-platform backup was saved to `C:\Users\User\Documents\Codex\JACK-RUSSEL-Backups` with all 4 referenced Storage objects.
- A restore drill restored an archived temporary sample from backup with 7 timeline rows and 9 size-spec rows, verified it, and removed the temporary records successfully.
- Downgrade is approved only after the Supabase Usage dashboard confirms database size is below the Free Plan 500 MB limit.

## Verification record — 13 October 2026

- Supabase database: 17,173,651 bytes (16.38 MB), below the 70% alert threshold of the Free Plan 500 MB limit.
- Supabase Storage: 125,727,346 bytes (119.90 MB), below the 70% alert threshold of the Free Plan 1 GB limit.
- New backup `2026-10-13T07-38-42-423Z` completed with 191 samples, 2,116 timeline rows, 1,775 size-spec rows, 5 file records, 6 users, and 4,861 audit rows.
- All 5 referenced Storage files were copied to both `system-backups` and the private Vercel Blob store with no warnings.
- The 60-day retention task remained active; the earlier retention run removed 47 expired backup sets and 185 objects.
- Controlled write test passed: active Admin lookup, sample create, timeline update, Size Spec save, file upload, signed download SHA-256 verification, archive, and five expected audit actions.
- Monthly restore drill passed from the latest remote backup: 7 timeline rows and 9 Size Spec rows were restored, verified, and cleaned up.
- Anonymous database reads returned no rows; anonymous sample inserts and Storage uploads were blocked by RLS. All 6 active users use PBKDF2-SHA256 password hashes.
- Monitoring passed all checks: Supabase and offsite backup age, database/storage thresholds, table/bucket availability, environment configuration, and recent failure count.
- Production deployment `dpl_HbJGkreKx3yLsxaA4tx3yZUENKLF` completed successfully and is aliased to both `jackrussel-sample.com` and `www.jackrussel-sample.com`.
- The deployed monitoring cron returned healthy, the deployed backup cron created `2026-10-13T07-46-28-737Z` with all 5 referenced Storage objects in Supabase Storage and private Vercel Blob, and the deployed restore drill restored and cleaned up its temporary records successfully.
- The next automated backup is scheduled daily at 02:00 Asia/Bangkok; monitoring runs hourly and the restore drill runs monthly.
