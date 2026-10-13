import "server-only";

import type { Json } from "./database.types";
import { createSupabaseAdminClient } from "./server";
import {
  isOffsiteBackupConfigured,
  pruneExpiredOffsiteBackups,
  uploadOffsiteObject,
} from "./offsite-backup";

const BACKUP_BUCKET = "system-backups";
const STORAGE_TABLES = ["sample_files", "sample_images"] as const;
const TABLE_PAGE_SIZE = 1000;
const BACKUP_RETENTION_DAYS = 60;

type BackupWarning = {
  scope: string;
  message: string;
};

type StorageListEntry = {
  name: string;
  metadata?: Record<string, unknown> | null;
};

function backupStampDate(stamp: string) {
  const match = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function listStorageFolder(supabase: any, prefix: string) {
  const entries: StorageListEntry[] = [];
  for (let offset = 0; ; offset += TABLE_PAGE_SIZE) {
    const result = await supabase.storage.from(BACKUP_BUCKET).list(prefix, {
      limit: TABLE_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (result.error) throw new Error(`list ${BACKUP_BUCKET}/${prefix}: ${result.error.message}`);
    const page = (result.data ?? []) as StorageListEntry[];
    entries.push(...page);
    if (page.length < TABLE_PAGE_SIZE) break;
  }
  return entries;
}

async function collectBackupObjectPaths(supabase: any, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await listStorageFolder(supabase, prefix)) {
    const path = `${prefix}/${entry.name}`;
    if (entry.metadata) paths.push(path);
    else paths.push(...await collectBackupObjectPaths(supabase, path));
  }
  return paths;
}

async function pruneExpiredBackups(supabase: any, currentStamp: string) {
  const cutoff = Date.now() - (BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expired = (await listStorageFolder(supabase, "backups"))
    .filter((entry) => !entry.metadata && entry.name !== currentStamp)
    .map((entry) => ({ name: entry.name, date: backupStampDate(entry.name) }))
    .filter((entry): entry is { name: string; date: Date } => Boolean(entry.date && entry.date.getTime() < cutoff));

  let deletedObjects = 0;
  for (const backup of expired) {
    const paths = await collectBackupObjectPaths(supabase, `backups/${backup.name}`);
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const removed = await supabase.storage.from(BACKUP_BUCKET).remove(batch);
      if (removed.error) throw new Error(`prune backups/${backup.name}: ${removed.error.message}`);
      deletedObjects += batch.length;
    }
  }

  return { retentionDays: BACKUP_RETENTION_DAYS, deletedBackupSets: expired.length, deletedBackupObjects: deletedObjects };
}

async function readTable(supabase: any, table: string, columns = "*", tolerateMissing = false) {
  const rows: any[] = [];
  for (let from = 0; ; from += TABLE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + TABLE_PAGE_SIZE - 1);
    if (error) {
      if (tolerateMissing) return { rows: [], warning: { scope: `table:${table}`, message: error.message } };
      throw new Error(`${table}: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < TABLE_PAGE_SIZE) break;
  }
  return { rows, warning: null };
}

async function ensureBackupBucket(supabase: any) {
  const buckets = await supabase.storage.listBuckets();
  if (buckets.error) throw new Error(`storage buckets: ${buckets.error.message}`);
  const exists = (buckets.data ?? []).some((bucket: { name: string }) => bucket.name === BACKUP_BUCKET);
  if (exists) return;
  const created = await supabase.storage.createBucket(BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (created.error) throw new Error(`create ${BACKUP_BUCKET}: ${created.error.message}`);
}

function collectStorageRefs(tables: Record<string, any[]>) {
  const refs = new Map<string, { bucket: string; path: string; mimeType?: string | null }>();
  for (const table of STORAGE_TABLES) {
    for (const row of tables[table] ?? []) {
      const bucket = row.bucket_id || (table === "sample_images" ? "sample-images" : "sample-files");
      const path = row.storage_path;
      if (!bucket || !path) continue;
      refs.set(`${bucket}/${path}`, { bucket, path, mimeType: row.mime_type ?? null });
    }
  }
  return [...refs.values()];
}

export async function createSupabaseBackup() {
  const supabase = createSupabaseAdminClient() as any;
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const warnings: BackupWarning[] = [];
  const tables: Record<string, any[]> = {};

  for (const table of ["samples", "sample_timeline", "sample_size_specs", "sample_files", "sample_images"]) {
    const result = await readTable(supabase, table);
    tables[table] = result.rows;
  }

  const users = await readTable(supabase, "app_users", "id,username,display_name,role,profile_image_path,is_active,created_at,updated_at");
  tables.app_users = users.rows;

  const audit = await readTable(supabase, "audit_logs", "*", true);
  tables.audit_logs = audit.rows;
  if (audit.warning) warnings.push(audit.warning);

  const storageRefs = collectStorageRefs(tables);
  const databaseBackup = {
    generated_at: generatedAt,
    app: "jack-russel-production-sample-tracking",
    scope: "database-json-and-storage-object-backup",
    tables,
    storage_objects: storageRefs,
  };

  await ensureBackupBucket(supabase);

  const databasePath = `backups/${stamp}/database.json`;
  const databaseBuffer = Buffer.from(JSON.stringify(databaseBackup, null, 2), "utf8");
  const databaseUpload = await supabase.storage.from(BACKUP_BUCKET).upload(
    databasePath,
    databaseBuffer,
    { contentType: "application/json", upsert: true },
  );
  if (databaseUpload.error) throw new Error(`backup database upload: ${databaseUpload.error.message}`);

  const offsiteConfigured = isOffsiteBackupConfigured();
  let offsiteCopiedStorageObjects = 0;
  if (offsiteConfigured) {
    try {
      await uploadOffsiteObject(databasePath, databaseBuffer, "application/json");
    } catch (error) {
      warnings.push({
        scope: "offsite:database",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (process.env.NODE_ENV === "production") {
    warnings.push({
      scope: "offsite:configuration",
      message: "BLOB_READ_WRITE_TOKEN is not configured; the backup exists only in Supabase Storage.",
    });
  }

  let copiedStorageObjects = 0;
  for (const ref of storageRefs) {
    const downloaded = await supabase.storage.from(ref.bucket).download(ref.path);
    if (downloaded.error || !downloaded.data) {
      warnings.push({ scope: `storage:${ref.bucket}/${ref.path}`, message: downloaded.error?.message || "download returned no data" });
      continue;
    }
    const objectBuffer = Buffer.from(await downloaded.data.arrayBuffer());
    const backupPath = `backups/${stamp}/storage/${ref.bucket}/${ref.path}`;
    const uploaded = await supabase.storage.from(BACKUP_BUCKET).upload(
      backupPath,
      objectBuffer,
      { contentType: ref.mimeType || "application/octet-stream", upsert: true },
    );
    if (uploaded.error) {
      warnings.push({ scope: `storage-backup:${backupPath}`, message: uploaded.error.message });
      continue;
    }
    copiedStorageObjects += 1;

    if (offsiteConfigured) {
      try {
        await uploadOffsiteObject(backupPath, objectBuffer, ref.mimeType || "application/octet-stream");
        offsiteCopiedStorageObjects += 1;
      } catch (error) {
        warnings.push({
          scope: `offsite:${backupPath}`,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  let retention = { retentionDays: BACKUP_RETENTION_DAYS, deletedBackupSets: 0, deletedBackupObjects: 0 };
  try {
    retention = await pruneExpiredBackups(supabase, stamp);
  } catch (error) {
    warnings.push({
      scope: "backup-retention",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let offsiteRetention = { retentionDays: BACKUP_RETENTION_DAYS, deletedBackupObjects: 0 };
  if (offsiteConfigured) {
    try {
      offsiteRetention = await pruneExpiredOffsiteBackups(stamp);
    } catch (error) {
      warnings.push({
        scope: "offsite:retention",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const manifest = {
    generated_at: generatedAt,
    database_path: databasePath,
    table_counts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
    copied_storage_objects: copiedStorageObjects,
    expected_storage_objects: storageRefs.length,
    retention,
    offsite: {
      provider: "vercel-blob-private",
      configured: offsiteConfigured,
      database_copied: offsiteConfigured && !warnings.some((warning) => warning.scope === "offsite:database"),
      copied_storage_objects: offsiteCopiedStorageObjects,
      expected_storage_objects: storageRefs.length,
      retention: offsiteRetention,
    },
    warnings: warnings as Json,
  };
  const manifestPath = `backups/${stamp}/manifest.json`;
  const manifestUpload = await supabase.storage.from(BACKUP_BUCKET).upload(
    manifestPath,
    Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
    { contentType: "application/json", upsert: true },
  );
  if (manifestUpload.error) throw new Error(`backup manifest upload: ${manifestUpload.error.message}`);

  if (offsiteConfigured) {
    try {
      await uploadOffsiteObject(manifestPath, Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), "application/json");
    } catch (error) {
      warnings.push({
        scope: "offsite:manifest",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: warnings.length === 0,
    generatedAt,
    bucket: BACKUP_BUCKET,
    manifestPath,
    databasePath,
    tableCounts: Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length])),
    copiedStorageObjects,
    expectedStorageObjects: storageRefs.length,
    retention,
    offsite: {
      provider: "vercel-blob-private",
      configured: offsiteConfigured,
      copiedStorageObjects: offsiteCopiedStorageObjects,
      expectedStorageObjects: storageRefs.length,
      retention: offsiteRetention,
    },
    warnings,
  };
}
