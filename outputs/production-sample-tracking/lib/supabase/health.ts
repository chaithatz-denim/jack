import "server-only";

import { getLatestOffsiteBackup, isOffsiteBackupConfigured } from "./offsite-backup";
import { createSupabaseAdminClient } from "./server";

type HealthCheck = {
  name: string;
  ok: boolean;
  detail?: string;
  count?: number | null;
  value?: number | null;
  threshold?: number | null;
};

const DATABASE_FREE_LIMIT_BYTES = 500 * 1024 * 1024;
const STORAGE_FREE_LIMIT_BYTES = 1024 * 1024 * 1024;
const USAGE_ALERT_RATIO = 0.7;

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function backupStampDate(stamp: string) {
  const match = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function countRows(supabase: any, table: string): Promise<HealthCheck> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  return { name: `table:${table}`, ok: !error, detail: error?.message, count: error ? null : count ?? 0 };
}

async function probeTable(supabase: any, table: string): Promise<HealthCheck> {
  const { error } = await supabase.from(table).select("id").limit(1);
  return { name: `probe:${table}`, ok: !error, detail: error?.message };
}

async function checkSupabaseBackupFreshness(supabase: any): Promise<HealthCheck> {
  const maxAgeHours = numberFromEnv("BACKUP_MAX_AGE_HOURS", 24);
  const listed = await supabase.storage.from("system-backups").list("backups", {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  });
  if (listed.error) return { name: "backup:supabase:freshness", ok: false, detail: listed.error.message };
  const latest = (listed.data ?? [])
    .map((entry: { name: string }) => ({ name: entry.name, date: backupStampDate(entry.name) }))
    .filter((entry: { name: string; date: Date | null }): entry is { name: string; date: Date } => Boolean(entry.date))
    .sort((left: { date: Date }, right: { date: Date }) => right.date.getTime() - left.date.getTime())[0];
  if (!latest) return { name: "backup:supabase:freshness", ok: false, detail: "No backup set found." };
  const ageHours = (Date.now() - latest.date.getTime()) / (60 * 60 * 1000);
  return {
    name: "backup:supabase:freshness",
    ok: ageHours <= maxAgeHours,
    detail: `latest=${latest.date.toISOString()} ageHours=${ageHours.toFixed(2)}`,
    value: Number(ageHours.toFixed(2)),
    threshold: maxAgeHours,
  };
}

async function checkOffsiteBackupFreshness(): Promise<HealthCheck> {
  const maxAgeHours = numberFromEnv("BACKUP_MAX_AGE_HOURS", 24);
  if (!isOffsiteBackupConfigured()) {
    return {
      name: "backup:offsite:freshness",
      ok: process.env.NODE_ENV !== "production",
      detail: "BLOB_READ_WRITE_TOKEN is not configured.",
      threshold: maxAgeHours,
    };
  }
  try {
    const latest = await getLatestOffsiteBackup();
    if (!latest) return { name: "backup:offsite:freshness", ok: false, detail: "No offsite manifest found." };
    const ageHours = (Date.now() - latest.uploadedAt.getTime()) / (60 * 60 * 1000);
    return {
      name: "backup:offsite:freshness",
      ok: ageHours <= maxAgeHours,
      detail: `latest=${latest.uploadedAt.toISOString()} ageHours=${ageHours.toFixed(2)}`,
      value: Number(ageHours.toFixed(2)),
      threshold: maxAgeHours,
    };
  } catch (error) {
    return { name: "backup:offsite:freshness", ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function checkUsage(supabase: any): Promise<HealthCheck[]> {
  const { data, error } = await supabase.rpc("system_usage_metrics");
  if (error) return [{ name: "usage:metrics", ok: false, detail: error.message }];
  const metrics = Array.isArray(data) ? data[0] : data;
  const databaseBytes = Number(metrics?.database_bytes ?? 0);
  const storageBytes = Number(metrics?.storage_bytes ?? 0);
  const databaseThreshold = DATABASE_FREE_LIMIT_BYTES * USAGE_ALERT_RATIO;
  const storageThreshold = STORAGE_FREE_LIMIT_BYTES * USAGE_ALERT_RATIO;
  return [
    {
      name: "usage:database",
      ok: databaseBytes < databaseThreshold,
      detail: `${(databaseBytes / 1024 / 1024).toFixed(2)} MB of 500 MB; alert at 70%`,
      value: databaseBytes,
      threshold: databaseThreshold,
    },
    {
      name: "usage:storage",
      ok: storageBytes < storageThreshold,
      detail: `${(storageBytes / 1024 / 1024).toFixed(2)} MB of 1024 MB; alert at 70%`,
      value: storageBytes,
      threshold: storageThreshold,
    },
  ];
}

async function checkRecentFailures(supabase: any): Promise<HealthCheck> {
  const failureThreshold = numberFromEnv("MONITOR_FAILURE_THRESHOLD", 5);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .in("action", ["BACKUP_FAILED", "UPLOAD_FILE_FAILED", "SUPABASE_CONNECTION_FAILED"])
    .gte("created_at", since);
  if (error) return { name: "failures:last-hour", ok: false, detail: error.message };
  return {
    name: "failures:last-hour",
    ok: (count ?? 0) < failureThreshold,
    detail: `${count ?? 0} failures in the last hour; alert at ${failureThreshold}`,
    count: count ?? 0,
    threshold: failureThreshold,
  };
}

export async function runLightHealthChecks() {
  const checks: HealthCheck[] = [
    { name: "env:NEXT_PUBLIC_SUPABASE_URL", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: "env:SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    {
      name: "env:SESSION_SECRET",
      ok: process.env.NODE_ENV !== "production" ? Boolean(process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY) : Boolean(process.env.SESSION_SECRET),
      detail: process.env.SESSION_SECRET ? "configured" : "required in production",
    },
  ];
  let supabase: any;
  try {
    supabase = createSupabaseAdminClient() as any;
  } catch (error) {
    checks.push({ name: "supabase:admin-client", ok: false, detail: error instanceof Error ? error.message : String(error) });
    return summarizeHealth(checks);
  }
  checks.push(await probeTable(supabase, "samples"));
  return summarizeHealth(checks);
}

export async function runHealthChecks() {
  const checks: HealthCheck[] = [
    { name: "env:NEXT_PUBLIC_SUPABASE_URL", ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: "env:SUPABASE_SERVICE_ROLE_KEY", ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    {
      name: "env:SESSION_SECRET",
      ok: process.env.NODE_ENV !== "production" ? Boolean(process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY) : Boolean(process.env.SESSION_SECRET),
      detail: process.env.SESSION_SECRET ? "configured" : "required in production",
    },
    {
      name: "env:CRON_SECRET",
      ok: process.env.NODE_ENV !== "production" || Boolean(process.env.CRON_SECRET),
      detail: process.env.CRON_SECRET ? "configured" : "required for production cron protection",
    },
    {
      name: "env:BLOB_READ_WRITE_TOKEN",
      ok: process.env.NODE_ENV !== "production" || Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      detail: process.env.BLOB_READ_WRITE_TOKEN ? "configured" : "required for production offsite backup",
    },
  ];
  let supabase: any;
  try {
    supabase = createSupabaseAdminClient() as any;
  } catch (error) {
    checks.push({ name: "supabase:admin-client", ok: false, detail: error instanceof Error ? error.message : String(error) });
    return summarizeHealth(checks);
  }
  for (const table of ["samples", "sample_timeline", "sample_size_specs", "sample_files", "sample_images", "app_users", "audit_logs"]) {
    checks.push(await countRows(supabase, table));
  }
  const buckets = await supabase.storage.listBuckets();
  if (buckets.error) {
    checks.push({ name: "storage:buckets", ok: false, detail: buckets.error.message });
  } else {
    const names = new Set((buckets.data ?? []).map((bucket: { name: string }) => bucket.name));
    for (const bucket of ["sample-files", "sample-images", "system-backups"]) {
      checks.push({ name: `storage:${bucket}`, ok: names.has(bucket), detail: names.has(bucket) ? "available" : "missing" });
    }
  }
  checks.push(await checkSupabaseBackupFreshness(supabase));
  checks.push(await checkOffsiteBackupFreshness());
  checks.push(...await checkUsage(supabase));
  checks.push(await checkRecentFailures(supabase));
  return summarizeHealth(checks);
}

function summarizeHealth(checks: HealthCheck[]) {
  const failed = checks.filter((check) => !check.ok);
  return { status: failed.length ? "degraded" : "ok", generatedAt: new Date().toISOString(), checks, failed };
}
