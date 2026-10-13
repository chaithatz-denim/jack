import { createClient } from "@supabase/supabase-js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const BACKUP_BUCKET = "system-backups";

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

function latestBackupDir() {
  const root = join(process.cwd(), "backups");
  if (!existsSync(root)) throw new Error("No backups folder found. Run npm run backup:readonly first.");
  const dirs = readdirSync(root)
    .filter((name) => name.startsWith("supabase-backup-"))
    .map((name) => join(root, name))
    .filter((path) => statSync(path).isDirectory())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!dirs[0]) throw new Error("No backup directory found. Run npm run backup:readonly first.");
  return dirs[0];
}

function walkFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walkFiles(path));
    else files.push(path);
  }
  return files;
}

function contentType(path) {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".pdf")) return "application/pdf";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

const env = loadDotEnv(".env.local");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const buckets = await supabase.storage.listBuckets();
if (buckets.error) throw new Error(`storage buckets: ${buckets.error.message}`);
if (!(buckets.data ?? []).some((bucket) => bucket.name === BACKUP_BUCKET)) {
  const created = await supabase.storage.createBucket(BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (created.error) throw new Error(`create ${BACKUP_BUCKET}: ${created.error.message}`);
}

const backupDir = process.argv[2] || latestBackupDir();
const backupName = backupDir.split(/[\\/]+/).pop()?.replace(/^supabase-backup-/, "") || new Date().toISOString().replace(/[:.]/g, "-");
const files = walkFiles(backupDir);
let uploaded = 0;

for (const file of files) {
  const rel = relative(backupDir, file).split(/[\\/]+/).join("/");
  const storagePath = `backups/${backupName}/${rel}`;
  const result = await supabase.storage.from(BACKUP_BUCKET).upload(storagePath, readFileSync(file), {
    contentType: contentType(file),
    upsert: true,
  });
  if (result.error) throw new Error(`upload ${storagePath}: ${result.error.message}`);
  uploaded += 1;
}

console.log(JSON.stringify({
  ok: true,
  bucket: BACKUP_BUCKET,
  source: backupDir,
  uploaded,
}, null, 2));
