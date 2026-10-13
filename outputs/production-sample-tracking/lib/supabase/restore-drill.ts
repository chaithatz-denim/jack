import "server-only";

import { writeAuditLog } from "./audit";
import { createSupabaseAdminClient } from "./server";

const BACKUP_BUCKET = "system-backups";

function backupStampDate(stamp: string) {
  const match = stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function latestBackupFolder(supabase: any) {
  const listed = await supabase.storage.from(BACKUP_BUCKET).list("backups", {
    limit: 1000,
    offset: 0,
    sortBy: { column: "name", order: "desc" },
  });
  if (listed.error) throw new Error(`list backups: ${listed.error.message}`);
  const latest = (listed.data ?? [])
    .map((entry: { name: string }) => ({ name: entry.name, date: backupStampDate(entry.name) }))
    .filter((entry: { name: string; date: Date | null }): entry is { name: string; date: Date } => Boolean(entry.date))
    .sort((left: { date: Date }, right: { date: Date }) => right.date.getTime() - left.date.getTime())[0];
  if (!latest) throw new Error("No backup set is available for restore drill.");
  return latest.name;
}

function samplePayload(source: Record<string, unknown>, sampleCode: string) {
  const allowed = [
    "model_id", "block_id", "cutting", "fabric_name", "thread_color", "fly", "washing",
    "priority", "status", "current_stage", "start_date", "due_date", "note", "washing_factory",
    "size_mode", "sample_size", "embellishment_shop", "sewer_name", "fabric_shop",
  ];
  return Object.fromEntries([
    ["sample_code", sampleCode],
    ...allowed.filter((key) => key in source).map((key) => [key, source[key]]),
    ["archived_at", new Date().toISOString()],
  ]);
}

export async function runRestoreDrill() {
  const supabase = createSupabaseAdminClient() as any;
  const folder = await latestBackupFolder(supabase);
  const databasePath = `backups/${folder}/database.json`;
  const downloaded = await supabase.storage.from(BACKUP_BUCKET).download(databasePath);
  if (downloaded.error || !downloaded.data) throw new Error(`download ${databasePath}: ${downloaded.error?.message || "empty response"}`);
  const backup = JSON.parse(await downloaded.data.text()) as { tables?: Record<string, any[]>; generated_at?: string };
  const tables = backup.tables ?? {};
  const samples = tables.samples ?? [];
  const timelines = tables.sample_timeline ?? [];
  const specs = tables.sample_size_specs ?? [];
  const source = samples.find((sample) =>
    timelines.some((row) => row.sample_id === sample.id) && specs.some((row) => row.sample_id === sample.id),
  ) ?? samples[0];
  if (!source) throw new Error("Backup contains no sample to restore.");

  const stamp = Date.now();
  const drillCode = `RESTORE-DRILL-${stamp}`;
  let restoredId: string | null = null;
  try {
    const inserted = await supabase
      .from("samples")
      .insert(samplePayload(source, drillCode))
      .select("id,sample_code,model_id,block_id")
      .single();
    if (inserted.error) throw new Error(`restore sample: ${inserted.error.message}`);
    restoredId = inserted.data.id;

    const sourceTimeline = timelines.filter((row) => row.sample_id === source.id).slice(0, 25);
    if (sourceTimeline.length) {
      const restoredTimeline = sourceTimeline.map((row) => ({
        sample_id: restoredId,
        stage: row.stage,
        action: row.action,
        note: row.note,
        from_status: row.from_status,
        to_status: row.to_status,
      }));
      const result = await supabase.from("sample_timeline").insert(restoredTimeline);
      if (result.error) throw new Error(`restore timeline: ${result.error.message}`);
    }

    const sourceSpecs = specs.filter((row) => row.sample_id === source.id).slice(0, 25);
    if (sourceSpecs.length) {
      const restoredSpecs = sourceSpecs.map((row) => ({
        sample_id: restoredId,
        measurement_point: row.measurement_point,
        description: row.description,
        tolerance: row.tolerance,
        values: row.values,
      }));
      const result = await supabase.from("sample_size_specs").insert(restoredSpecs);
      if (result.error) throw new Error(`restore size specs: ${result.error.message}`);
    }

    const [sampleCheck, timelineCheck, specCheck] = await Promise.all([
      supabase.from("samples").select("id,sample_code", { count: "exact" }).eq("id", restoredId).single(),
      supabase.from("sample_timeline").select("id", { count: "exact", head: true }).eq("sample_id", restoredId),
      supabase.from("sample_size_specs").select("id", { count: "exact", head: true }).eq("sample_id", restoredId),
    ]);
    if (sampleCheck.error || sampleCheck.data?.sample_code !== drillCode) throw new Error("restore verification: sample mismatch");
    if ((timelineCheck.count ?? 0) !== sourceTimeline.length) throw new Error("restore verification: timeline count mismatch");
    if ((specCheck.count ?? 0) !== sourceSpecs.length) throw new Error("restore verification: size spec count mismatch");

    const removed = await supabase.from("samples").delete().eq("id", restoredId);
    if (removed.error) throw new Error(`restore cleanup: ${removed.error.message}`);
    const cleanup = await supabase.from("samples").select("id", { count: "exact", head: true }).eq("id", restoredId);
    if (cleanup.error || (cleanup.count ?? 0) !== 0) throw new Error("restore cleanup verification failed");

    const result = {
      ok: true,
      sourceBackup: databasePath,
      sourceGeneratedAt: backup.generated_at ?? null,
      sourceSampleCode: source.sample_code,
      restoredSampleCode: drillCode,
      restoredTimelineRows: sourceTimeline.length,
      restoredSizeSpecRows: sourceSpecs.length,
      cleanupVerified: true,
      completedAt: new Date().toISOString(),
    };
    await writeAuditLog(supabase, {
      action: "RESTORE_DRILL_COMPLETED",
      entityType: "system_backup",
      entityId: databasePath,
      metadata: result,
    });
    return result;
  } catch (error) {
    if (restoredId) await supabase.from("samples").delete().eq("id", restoredId);
    const message = error instanceof Error ? error.message : String(error);
    await writeAuditLog(supabase, {
      action: "RESTORE_DRILL_FAILED",
      entityType: "system_backup",
      entityId: databasePath,
      metadata: { error: message, restoredSampleId: restoredId },
    });
    throw error;
  }
}
