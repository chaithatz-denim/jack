import { createClient } from "@supabase/supabase-js";
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
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[key]) throw new Error(`Missing ${key} in .env.local`);
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const checks = [];
for (const table of ["samples", "app_users", "audit_logs"]) {
  const result = await anon.from(table).select("id").limit(1);
  const blocked = Boolean(result.error) || (result.data ?? []).length === 0;
  checks.push({ name: `anon-select:${table}`, ok: blocked, detail: result.error?.message || `${result.data?.length ?? 0} rows visible` });
}

const rlsSampleCode = `RLS-TEST-${Date.now()}`;
const insert = await anon.from("samples").insert({ sample_code: rlsSampleCode, fabric_name: "RLS_TEST" }).select("id").maybeSingle();
checks.push({ name: "anon-insert:samples", ok: Boolean(insert.error) || !insert.data, detail: insert.error?.message || (insert.data ? "unexpected insert succeeded" : "blocked") });
if (insert.data?.id) await admin.from("samples").delete().eq("id", insert.data.id);

const storagePath = `security-tests/${Date.now()}-rls.pdf`;
const storageInsert = await anon.storage.from("sample-files").upload(storagePath, Buffer.from("%PDF-1.4 RLS test"), {
  contentType: "application/pdf",
  upsert: false,
});
checks.push({ name: "anon-upload:sample-files", ok: Boolean(storageInsert.error), detail: storageInsert.error?.message || "unexpected upload succeeded" });
if (!storageInsert.error) await admin.storage.from("sample-files").remove([storagePath]);

const users = await admin.from("app_users").select("password_hash,is_active");
if (users.error) throw new Error(`password policy audit: ${users.error.message}`);
const activeUsers = (users.data ?? []).filter((user) => user.is_active);
const legacyHashes = activeUsers.filter((user) => !user.password_hash.startsWith("pbkdf2-sha256$")).length;
checks.push({
  name: "password-hash:active-users",
  ok: legacyHashes === 0,
  detail: `${activeUsers.length} active users; ${legacyHashes} legacy SHA-256 hashes`,
});

const failed = checks.filter((check) => !check.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checkedAt: new Date().toISOString(), checks, failed }, null, 2));
if (failed.length) process.exitCode = 1;
