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
    out[key] = value.replaceAll("\\n", "\n");
  }
  return out;
}

const envPath = process.env.VERCEL_ENV_FILE || ".env.production.test";
const env = process.env.CRON_SECRET ? process.env : loadDotEnv(envPath);
if (!env.CRON_SECRET) throw new Error(`CRON_SECRET is missing from the process environment and ${envPath}`);
const path = process.env.CRON_PATH || "/api/cron/monitor";
if (!path.startsWith("/api/cron/")) throw new Error("CRON_PATH must target /api/cron/*");
const baseUrl = (process.env.PRODUCTION_URL || "https://www.jackrussel-sample.com").replace(/\/$/, "");
const startedAt = Date.now();
const response = await fetch(`${baseUrl}${path}`, {
  headers: { authorization: `Bearer ${env.CRON_SECRET}`, "user-agent": "jack-russel-controlled-cron-test/1.0" },
});
const body = await response.json().catch(async () => ({ text: await response.text() }));
console.log(JSON.stringify({
  ok: response.ok,
  status: response.status,
  url: `${baseUrl}${path}`,
  durationMs: Date.now() - startedAt,
  body,
}, null, 2));
if (!response.ok) process.exitCode = 1;
