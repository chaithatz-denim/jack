import { NextRequest, NextResponse } from "next/server";
import { createSupabaseBackup } from "@/lib/supabase/backup";
import { writeAuditLog } from "@/lib/supabase/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const result = await createSupabaseBackup();
    try {
      await writeAuditLog(createSupabaseAdminClient() as any, {
        action: result.ok ? "BACKUP_COMPLETED" : "BACKUP_COMPLETED_WITH_WARNINGS",
        entityType: "system_backup",
        entityId: result.manifestPath,
        metadata: result,
      });
    } catch (auditError) {
      console.error("Backup audit failed:", auditError);
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    try {
      await writeAuditLog(createSupabaseAdminClient() as any, {
        action: "BACKUP_FAILED",
        entityType: "system_backup",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    } catch (auditError) {
      console.error("Backup failure audit failed:", auditError);
    }
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
