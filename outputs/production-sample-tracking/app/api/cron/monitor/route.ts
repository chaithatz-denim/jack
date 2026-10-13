import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/supabase/health";
import { writeAuditLog } from "@/lib/supabase/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendAlert(payload: unknown) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return { sent: false, reason: "ALERT_WEBHOOK_URL is not configured" };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: "JACK RUSSEL Sample Tracking monitoring alert",
      content: "JACK RUSSEL Sample Tracking monitoring alert",
      payload,
    }),
  });
  return { sent: response.ok, status: response.status };
}

async function writeMonitorAudit(health: Awaited<ReturnType<typeof runHealthChecks>>, alert: unknown) {
  try {
    const supabase = createSupabaseAdminClient() as any;
    await writeAuditLog(supabase, {
      action: health.status === "ok" ? "MONITORING_OK" : "MONITORING_DEGRADED",
      entityType: "system",
      metadata: {
        status: health.status,
        failed: health.failed,
        alert,
      },
    });
  } catch (error) {
    console.error("Monitoring audit failed:", error);
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  const health = await runHealthChecks();
  const alert = health.status === "ok" ? { sent: false, reason: "system healthy" } : await sendAlert(health);
  await writeMonitorAudit(health, alert);

  return NextResponse.json({
    ok: health.status === "ok",
    health,
    alert,
  }, {
    status: health.status === "ok" ? 200 : 503,
  });
}
