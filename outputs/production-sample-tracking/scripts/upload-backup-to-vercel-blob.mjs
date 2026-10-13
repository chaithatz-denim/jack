import { put } from "@vercel/blob";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

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

function latestBackupDir(root) {
  if (!existsSync(root)) throw new Error(`Backup root not found: ${root}`);
  const dirs = readdirSync(root)
    .map((name) => join(root, name))
    .filter((path) => statSync(path).isDirectory() && basename(path).startsWith("supabase-backup-"))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  if (!dirs.length) throw new Error(`No supabase-backup-* folder found in ${root}`);
  return dirs[0];
}

function filesUnder(root) {
  const out = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else if (!entry.startsWith("restore-verification-")) out.push(path);
  }
  return out;
}

function contentType(path) {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".pdf")) return "application/pdf";
  if (/\.(png)$/i.test(path)) return "image/png";
  if (/\.(jpe?g)$/i.test(path)) return "image/jpeg";
  if (/\.(webp)$/i.test(path)) return "image/webp";
  return "application/octet-stream";
}

const env = loadDotEnv(".env.local");
if (!env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN is missing from .env.local");
const backupRoot = resolve(process.env.BACKUP_OUTPUT_DIR || join(process.cwd(), "backups"));
const backupDir = latestBackupDir(backupRoot);
const folderName = basename(backupDir).replace(/^supabase-backup-/, "");
const uploaded = [];

for (const filePath of filesUnder(backupDir)) {
  const relativePath = relative(backupDir, filePath).replaceAll("\\", "/");
  const pathname = `backups/${folderName}/${relativePath}`;
  const result = await put(pathname, readFileSync(filePath), {
    access: "private",
    addRandomSuffix: false,
    contentType: contentType(filePath),
    token: env.BLOB_READ_WRITE_TOKEN,
  });
  uploaded.push({ pathname: result.pathname, size: statSync(filePath).size });
}

console.log(JSON.stringify({
  ok: true,
  source: backupDir,
  destination: `vercel-blob-private/backups/${folderName}`,
  uploadedObjects: uploaded.length,
  uploadedBytes: uploaded.reduce((sum, item) => sum + item.size, 0),
  objects: uploaded,
}, null, 2));
