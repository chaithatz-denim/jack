import { NextRequest, NextResponse } from "next/server";
import { runRestoreDrill } from "@/lib/supabase/restore-drill";

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
    return NextResponse.json(await runRestoreDrill());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
