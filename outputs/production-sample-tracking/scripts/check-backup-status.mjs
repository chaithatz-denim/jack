import { createClient } from "@supabase/supabase-js";
import { list } from "@vercel/blob";
import { readFileSync } from "node:fs";

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

const env = loadDotEnv(".env.local");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const audits = await supabase
  .from("audit_logs")
  .select("action,entity_id,metadata,created_at")
  .in("action", ["BACKUP_COMPLETED", "BACKUP_COMPLETED_WITH_WARNINGS", "BACKUP_FAILED"])
  .order("created_at", { ascending: false })
  .limit(5);

const folders = await supabase.storage.from("system-backups").list("backups", {
  limit: 1000,
  offset: 0,
  sortBy: { column: "name", order: "desc" },
});
const usage = await supabase.rpc("system_usage_metrics");

let offsite = { configured: false, manifests: [], error: null };
if (env.BLOB_READ_WRITE_TOKEN) {
  try {
    const listed = await list({ prefix: "backups/", limit: 1000, token: env.BLOB_READ_WRITE_TOKEN });
    offsite = {
      configured: true,
      manifests: listed.blobs
        .filter((blob) => blob.pathname.endsWith("/manifest.json"))
        .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
        .slice(0, 5)
        .map((blob) => ({ pathname: blob.pathname, uploadedAt: blob.uploadedAt })),
      error: null,
    };
  } catch (error) {
    offsite = { configured: true, manifests: [], error: error instanceof Error ? error.message : String(error) };
  }
}

console.log(JSON.stringify({
  ok: !audits.error && !folders.error,
  audits: audits.data ?? [],
  auditError: audits.error?.message ?? null,
  newestBackupFolders: (folders.data ?? []).slice(0, 5).map((entry) => entry.name),
  backupFolderCount: folders.data?.length ?? null,
  storageError: folders.error?.message ?? null,
  usage: usage.error ? { error: usage.error.message } : usage.data,
  offsite,
}, null, 2));
