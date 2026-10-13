import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function loadDotEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

function latestBackupDirectory(root) {
  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("supabase-backup-"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (!directories.length) throw new Error(`No local backup found in ${root}`);
  return join(root, directories[0]);
}

const env = loadDotEnv(".env.local");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const backupRoot = resolve(process.env.BACKUP_OUTPUT_DIR || join(process.cwd(), "backups"));
const backupDir = latestBackupDirectory(backupRoot);
const databasePath = join(backupDir, "database.json");
const backup = JSON.parse(readFileSync(databasePath, "utf8"));
const source = backup.tables?.samples?.find((sample) =>
  backup.tables.sample_timeline?.some((row) => row.sample_id === sample.id)
  && backup.tables.sample_size_specs?.some((row) => row.sample_id === sample.id));
if (!source) throw new Error("Backup has no sample with timeline and size spec rows to restore.");

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const restoredSampleId = randomUUID();
const restoredCode = `RESTORE-TEST-${Date.now()}`;
const restoredAt = new Date().toISOString();
const sourceTimeline = backup.tables.sample_timeline.filter((row) => row.sample_id === source.id);
const sourceSpecs = backup.tables.sample_size_specs.filter((row) => row.sample_id === source.id);

const samplePayload = {
  ...source,
  id: restoredSampleId,
  sample_code: restoredCode,
  model_id: `RESTORE TEST · ${source.model_id || source.sample_code}`,
  note: `Temporary restore verification from ${backup.generated_at}`,
  created_by: null,
  updated_by: null,
  created_at: restoredAt,
  updated_at: restoredAt,
  archived_at: restoredAt,
};
const timelinePayload = sourceTimeline.map((row) => ({
  ...row,
  id: randomUUID(),
  sample_id: restoredSampleId,
  created_by: null,
  created_at: restoredAt,
}));
const specPayload = sourceSpecs.map((row) => ({
  ...row,
  id: randomUUID(),
  sample_id: restoredSampleId,
  created_by: null,
  updated_by: null,
  created_at: restoredAt,
  updated_at: restoredAt,
}));

let result;
try {
  const insertedSample = await supabase.from("samples").insert(samplePayload);
  if (insertedSample.error) throw new Error(`restore sample: ${insertedSample.error.message}`);
  if (timelinePayload.length) {
    const insertedTimeline = await supabase.from("sample_timeline").insert(timelinePayload);
    if (insertedTimeline.error) throw new Error(`restore timeline: ${insertedTimeline.error.message}`);
  }
  if (specPayload.length) {
    const insertedSpecs = await supabase.from("sample_size_specs").insert(specPayload);
    if (insertedSpecs.error) throw new Error(`restore size specs: ${insertedSpecs.error.message}`);
  }

  const [sampleCheck, timelineCheck, specCheck] = await Promise.all([
    supabase.from("samples").select("sample_code,model_id,fabric_name,block_id").eq("id", restoredSampleId).single(),
    supabase.from("sample_timeline").select("id", { count: "exact", head: true }).eq("sample_id", restoredSampleId),
    supabase.from("sample_size_specs").select("id", { count: "exact", head: true }).eq("sample_id", restoredSampleId),
  ]);
  if (sampleCheck.error || timelineCheck.error || specCheck.error) {
    throw new Error(sampleCheck.error?.message || timelineCheck.error?.message || specCheck.error?.message);
  }
  const verified = sampleCheck.data.sample_code === restoredCode
    && sampleCheck.data.fabric_name === source.fabric_name
    && timelineCheck.count === sourceTimeline.length
    && specCheck.count === sourceSpecs.length;
  if (!verified) throw new Error("Restored records did not match the backup source.");

  result = {
    ok: true,
    verified_at: restoredAt,
    backup_generated_at: backup.generated_at,
    source_sample_code: source.sample_code,
    temporary_sample_code: restoredCode,
    restored_timeline_rows: timelineCheck.count,
    restored_size_spec_rows: specCheck.count,
  };
} finally {
  const cleanup = await supabase.from("samples").delete().eq("id", restoredSampleId);
  if (cleanup.error) throw new Error(`restore test cleanup: ${cleanup.error.message}`);
}

const cleanupCheck = await supabase.from("samples").select("id", { count: "exact", head: true }).eq("id", restoredSampleId);
if (cleanupCheck.error || cleanupCheck.count !== 0) throw new Error("Restore test cleanup verification failed.");
result.cleanup_verified = true;

await supabase.from("audit_logs").insert({
  action: "RESTORE_TEST_COMPLETED",
  entity_type: "system_backup",
  entity_id: backup.generated_at,
  metadata: result,
});

const reportPath = join(backupDir, `restore-verification-${restoredAt.replace(/[:.]/g, "-")}.json`);
if (!existsSync(dirname(reportPath))) mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify({ ...result, reportPath }, null, 2));
