import { NextResponse } from "next/server";
import { runLightHealthChecks } from "@/lib/supabase/health";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";

export async function GET() {
  const health = await runLightHealthChecks();
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
  });
}
