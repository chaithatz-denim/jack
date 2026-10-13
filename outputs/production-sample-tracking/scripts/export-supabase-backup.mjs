import { createClient } from "@supabase/supabase-js";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const TABLE_PAGE_SIZE = 1000;

function loadDotEnv(path) {
  const out = {};
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
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

async function readTable(supabase, table, columns = "*", tolerateMissing = false) {
  const rows = [];
  for (let from = 0; ; from += TABLE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + TABLE_PAGE_SIZE - 1);
    if (error) {
      if (tolerateMissing) return { rows: [], warning: `${table}: ${error.message}` };
      throw new Error(`${table}: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < TABLE_PAGE_SIZE) break;
  }
  return { rows, warning: null };
}

function storageRefs(tables) {
  const refs = new Map();
  for (const row of tables.sample_files ?? []) {
    if (row.bucket_id && row.storage_path) refs.set(`${row.bucket_id}/${row.storage_path}`, {
      bucket: row.bucket_id,
      path: row.storage_path,
      mimeType: row.mime_type,
    });
  }
  for (const row of tables.sample_images ?? []) {
    if (row.bucket_id && row.storage_path) refs.set(`${row.bucket_id}/${row.storage_path}`, {
      bucket: row.bucket_id,
      path: row.storage_path,
      mimeType: "image/*",
    });
  }
  return [...refs.values()];
}

function safePathParts(path) {
  return path.split(/[\\/]+/).filter((part) => part && part !== "." && part !== "..");
}

const env = loadDotEnv(".env.local");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = {};
for (const table of ["samples", "sample_timeline", "sample_size_specs", "sample_files", "sample_images"]) {
  tables[table] = (await readTable(supabase, table)).rows;
}
tables.app_users = (await readTable(supabase, "app_users", "id,username,display_name,role,profile_image_path,is_active,created_at,updated_at")).rows;
const audit = await readTable(supabase, "audit_logs", "*", true);
tables.audit_logs = audit.rows;

const generatedAt = new Date().toISOString();
const refs = storageRefs(tables);
const backup = {
  generated_at: generatedAt,
  app: "jack-russel-production-sample-tracking",
  scope: "database-json-and-storage-object-backup",
  tables,
  storage_objects: refs,
  warnings: audit.warning ? [audit.warning] : [],
};

const configuredBackupRoot = process.env.BACKUP_OUTPUT_DIR?.trim();
const backupRoot = configuredBackupRoot
  ? (isAbsolute(configuredBackupRoot) ? configuredBackupRoot : resolve(process.cwd(), configuredBackupRoot))
  : join(process.cwd(), "backups");
if (!existsSync(backupRoot)) mkdirSync(backupRoot, { recursive: true });

const stamp = generatedAt.replace(/[:.]/g, "-");
const backupDir = join(backupRoot, `supabase-backup-${stamp}`);
mkdirSync(backupDir, { recursive: true });

const databasePath = join(backupDir, "database.json");
writeFileSync(databasePath, JSON.stringify(backup, null, 2), "utf8");

let downloadedStorageObjects = 0;
for (const ref of refs) {
  const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
  if (error || !data) {
    backup.warnings.push(`storage:${ref.bucket}/${ref.path}: ${error?.message || "download returned no data"}`);
    continue;
  }
  const destination = join(backupDir, "storage", ref.bucket, ...safePathParts(ref.path));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, Buffer.from(await data.arrayBuffer()));
  downloadedStorageObjects += 1;
}

writeFileSync(join(backupDir, "manifest.json"), JSON.stringify({
  generated_at: generatedAt,
  database_path: databasePath,
  table_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
  downloaded_storage_objects: downloadedStorageObjects,
  expected_storage_objects: refs.length,
  warnings: backup.warnings,
}, null, 2), "utf8");

console.log(JSON.stringify({
  backupDir,
  databasePath,
  samples: tables.samples.length,
  timeline: tables.sample_timeline.length,
  sizeSpecs: tables.sample_size_specs.length,
  files: tables.sample_files.length,
  images: tables.sample_images.length,
  users: tables.app_users.length,
  auditLogs: tables.audit_logs.length,
  downloadedStorageObjects,
  expectedStorageObjects: refs.length,
  warnings: backup.warnings,
}, null, 2));
