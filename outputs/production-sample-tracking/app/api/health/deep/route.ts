import { NextRequest, NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/supabase/health";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized health request." }, { status: 401 });
  }
  const health = await runHealthChecks();
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
  });
}
