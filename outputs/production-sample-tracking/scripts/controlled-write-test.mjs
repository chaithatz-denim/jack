import { createClient } from "@supabase/supabase-js";
import { createHash, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

function loadDotEnv(path) {
  const out = {};
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
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

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPassword(password, storedHash) {
  if (storedHash.startsWith("pbkdf2-sha256$")) {
    const [, iterationsRaw, salt, hash] = storedHash.split("$");
    const candidate = pbkdf2Sync(password, salt, Number(iterationsRaw), 32, "sha256").toString("base64url");
    return safeEqual(candidate, hash);
  }
  return safeEqual(createHash("sha256").update(password).digest("hex"), storedHash);
}

async function audit(supabase, input) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_user_id: input.actorUserId ?? null,
    actor_username: input.actorUsername ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    sample_id: input.sampleId ?? null,
    metadata: input.metadata ?? {},
  });
  return error ? error.message : null;
}

const env = loadDotEnv(".env.local");
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const preferredUsername = process.env.CONTROLLED_TEST_USERNAME || "jack";
let { data: actor, error: actorError } = await supabase
  .from("app_users")
  .select("id,username,display_name,role,password_hash,is_active")
  .eq("username", preferredUsername)
  .maybeSingle();

if (!actor) {
  const fallback = await supabase
    .from("app_users")
    .select("id,username,display_name,role,password_hash,is_active")
    .eq("role", "Admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  actor = fallback.data;
  actorError = fallback.error;
}

if (actorError) throw new Error(`login lookup: ${actorError.message}`);
if (!actor || !actor.is_active || actor.role !== "Admin") throw new Error("No active Admin user available for controlled write test.");

const passwordProvided = Boolean(process.env.CONTROLLED_TEST_PASSWORD);
const passwordVerified = passwordProvided ? verifyPassword(process.env.CONTROLLED_TEST_PASSWORD, actor.password_hash) : null;
if (passwordProvided && !passwordVerified) throw new Error("CONTROLLED_TEST_PASSWORD did not match the selected Admin user.");

const cleanupTime = new Date().toISOString();
await supabase
  .from("samples")
  .update({ archived_at: cleanupTime, updated_at: cleanupTime })
  .eq("model_id", "CONTROLLED-WRITE-TEST")
  .is("archived_at", null);

const now = new Date();
const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const sampleCode = `TEST-${stamp}`;

const sampleInsert = await supabase.from("samples").insert({
  sample_code: sampleCode,
  model_id: "CONTROLLED-WRITE-TEST",
  block_id: "TEST-BLOCK",
  cutting: "Controlled test",
  fabric_name: "CONTROLLED_TEST_DENIM",
  thread_color: "TEST",
  fly: "Zip",
  washing: "Controlled wash",
  priority: "Urgent",
  status: "Pattern",
  current_stage: "Pattern",
  start_date: now.toISOString().slice(0, 10),
  due_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  note: "Controlled write test sample. Safe to keep archived.",
  size_mode: "numeric",
  sample_size: "32",
}).select("id,sample_code,status").single();
if (sampleInsert.error) throw new Error(`create sample: ${sampleInsert.error.message}`);
const sample = sampleInsert.data;

const auditWarnings = [];
let auditError = await audit(supabase, {
  actorUserId: actor.id,
  actorUsername: actor.username,
  action: "CONTROLLED_TEST_CREATE_SAMPLE",
  entityType: "sample",
  entityId: sample.id,
  sampleId: sample.id,
  metadata: { sample_code: sample.sample_code },
});
if (auditError) auditWarnings.push(auditError);

const timelineCreate = await supabase.from("sample_timeline").insert({
  sample_id: sample.id,
  stage: "Pattern",
  action: "CONTROLLED_TEST_CREATE_SAMPLE",
  note: "Controlled write test created sample.",
  to_status: "Pattern",
});
if (timelineCreate.error) throw new Error(`create timeline: ${timelineCreate.error.message}`);

const stageUpdate = await supabase.from("samples").update({
  status: "Cutting",
  current_stage: "Cutting",
  block_id: "TEST-BLOCK-UPDATED",
  updated_at: new Date().toISOString(),
}).eq("id", sample.id);
if (stageUpdate.error) throw new Error(`update timeline stage: ${stageUpdate.error.message}`);

const timelineUpdate = await supabase.from("sample_timeline").insert({
  sample_id: sample.id,
  stage: "Pattern",
  action: "CONTROLLED_TEST_UPDATE_TIMELINE",
  note: "Controlled write test completed Pattern and moved to Cutting.",
  from_status: "Pattern",
  to_status: "Cutting",
});
if (timelineUpdate.error) throw new Error(`insert update timeline: ${timelineUpdate.error.message}`);

auditError = await audit(supabase, {
  actorUserId: actor.id,
  actorUsername: actor.username,
  action: "CONTROLLED_TEST_UPDATE_TIMELINE",
  entityType: "sample",
  entityId: sample.id,
  sampleId: sample.id,
  metadata: { from_status: "Pattern", to_status: "Cutting" },
});
if (auditError) auditWarnings.push(auditError);

const sizeSpecInsert = await supabase.from("sample_size_specs").insert({
  sample_id: sample.id,
  measurement_point: "เอว",
  description: "วัดรอบเอวตามแนวขอบเอว",
  tolerance: "±1/4",
  values: { "32": "32" },
}).select("id,measurement_point,values").single();
if (sizeSpecInsert.error) throw new Error(`save size spec: ${sizeSpecInsert.error.message}`);

const timelineSizeSpec = await supabase.from("sample_timeline").insert({
  sample_id: sample.id,
  stage: "Size Spec",
  action: "CONTROLLED_TEST_SAVE_SIZE_SPEC",
  note: "Controlled write test saved Size Spec.",
});
if (timelineSizeSpec.error) throw new Error(`insert size spec timeline: ${timelineSizeSpec.error.message}`);

auditError = await audit(supabase, {
  actorUserId: actor.id,
  actorUsername: actor.username,
  action: "CONTROLLED_TEST_SAVE_SIZE_SPEC",
  entityType: "sample_size_spec",
  entityId: sizeSpecInsert.data.id,
  sampleId: sample.id,
  metadata: { measurement_point: sizeSpecInsert.data.measurement_point, values: sizeSpecInsert.data.values },
});
if (auditError) auditWarnings.push(auditError);

const fileBody = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF
Controlled write test file for ${sample.sample_code} at ${new Date().toISOString()}
`, "utf8");
const filePath = `${sample.id}/controlled-write-test-${Date.now()}.pdf`;
const upload = await supabase.storage.from("sample-files").upload(filePath, fileBody, {
  contentType: "application/pdf",
  upsert: false,
});
if (upload.error) throw new Error(`upload file: ${upload.error.message}`);

const signed = await supabase.storage.from("sample-files").createSignedUrl(filePath, 60);
if (signed.error || !signed.data?.signedUrl) throw new Error(`create file download URL: ${signed.error?.message || "missing URL"}`);
const downloaded = await fetch(signed.data.signedUrl);
if (!downloaded.ok) throw new Error(`download file: HTTP ${downloaded.status}`);
const downloadedBody = Buffer.from(await downloaded.arrayBuffer());
const sourceHash = createHash("sha256").update(fileBody).digest("hex");
const downloadedHash = createHash("sha256").update(downloadedBody).digest("hex");
if (sourceHash !== downloadedHash) throw new Error("download file: SHA-256 mismatch");

const fileRecord = await supabase.from("sample_files").insert({
  sample_id: sample.id,
  bucket_id: "sample-files",
  storage_path: filePath,
  file_name: "controlled-write-test.pdf",
  mime_type: "application/pdf",
  file_size: fileBody.length,
  stage: "Controlled Test",
}).select("id").single();
if (fileRecord.error) throw new Error(`insert file record: ${fileRecord.error.message}`);

const timelineFile = await supabase.from("sample_timeline").insert({
  sample_id: sample.id,
  stage: "Controlled Test",
  action: "CONTROLLED_TEST_UPLOAD_FILE",
  note: "Controlled write test uploaded sample file.",
  to_status: "Controlled Test",
});
if (timelineFile.error) throw new Error(`insert file timeline: ${timelineFile.error.message}`);

auditError = await audit(supabase, {
  actorUserId: actor.id,
  actorUsername: actor.username,
  action: "CONTROLLED_TEST_UPLOAD_FILE",
  entityType: "sample_file",
  entityId: fileRecord.data.id,
  sampleId: sample.id,
  metadata: { bucket: "sample-files", storage_path: filePath, file_size: fileBody.length },
});
if (auditError) auditWarnings.push(auditError);

const archivedAt = new Date().toISOString();
const archive = await supabase.from("samples").update({
  archived_at: archivedAt,
  updated_at: archivedAt,
}).eq("id", sample.id);
if (archive.error) throw new Error(`archive sample: ${archive.error.message}`);

const timelineArchive = await supabase.from("sample_timeline").insert({
  sample_id: sample.id,
  stage: "Archive",
  action: "CONTROLLED_TEST_ARCHIVE_SAMPLE",
  note: "Controlled write test archived sample.",
});
if (timelineArchive.error) throw new Error(`insert archive timeline: ${timelineArchive.error.message}`);

auditError = await audit(supabase, {
  actorUserId: actor.id,
  actorUsername: actor.username,
  action: "CONTROLLED_TEST_ARCHIVE_SAMPLE",
  entityType: "sample",
  entityId: sample.id,
  sampleId: sample.id,
  metadata: { archived_at: archivedAt },
});
if (auditError) auditWarnings.push(auditError);

const auditVerification = await supabase
  .from("audit_logs")
  .select("action")
  .eq("sample_id", sample.id)
  .in("action", [
    "CONTROLLED_TEST_CREATE_SAMPLE",
    "CONTROLLED_TEST_UPDATE_TIMELINE",
    "CONTROLLED_TEST_SAVE_SIZE_SPEC",
    "CONTROLLED_TEST_UPLOAD_FILE",
    "CONTROLLED_TEST_ARCHIVE_SAMPLE",
  ]);
if (auditVerification.error) throw new Error(`verify audit log: ${auditVerification.error.message}`);
const recordedAuditActions = new Set((auditVerification.data ?? []).map((row) => row.action));
const missingAuditActions = [
  "CONTROLLED_TEST_CREATE_SAMPLE",
  "CONTROLLED_TEST_UPDATE_TIMELINE",
  "CONTROLLED_TEST_SAVE_SIZE_SPEC",
  "CONTROLLED_TEST_UPLOAD_FILE",
  "CONTROLLED_TEST_ARCHIVE_SAMPLE",
].filter((action) => !recordedAuditActions.has(action));
if (missingAuditActions.length) throw new Error(`verify audit log: missing ${missingAuditActions.join(", ")}`);

console.log(JSON.stringify({
  ok: true,
  login: {
    username: actor.username,
    role: actor.role,
    activeUserVerified: true,
    passwordVerified,
    passwordCheckSkipped: !passwordProvided,
  },
  sample: {
    id: sample.id,
    sample_code: sample.sample_code,
    archived_at: archivedAt,
  },
  timeline: {
    created: true,
    updated: true,
    sizeSpecSaved: true,
    archived: true,
  },
  sizeSpec: {
    id: sizeSpecInsert.data.id,
    measurementPoint: sizeSpecInsert.data.measurement_point,
    values: sizeSpecInsert.data.values,
  },
  file: {
    bucket: "sample-files",
    storage_path: filePath,
    record_id: fileRecord.data.id,
    downloadVerified: true,
    sha256: sourceHash,
  },
  audit: {
    verified: true,
    actions: [...recordedAuditActions].sort(),
  },
  auditWarnings,
}, null, 2));
