import "server-only";

import { del, list, put } from "@vercel/blob";

const OFFSITE_PREFIX = "backups/";
const OFFSITE_RETENTION_DAYS = 60;

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

function backupStampDate(pathname: string) {
  const match = pathname.match(/^backups\/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\//);
  if (!match) return null;
  const parsed = new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isOffsiteBackupConfigured() {
  return Boolean(token());
}

export async function uploadOffsiteObject(pathname: string, body: Buffer, contentType: string) {
  const blobToken = token();
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  return put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    contentType,
    token: blobToken,
  });
}

async function listAllOffsiteBlobs() {
  const blobToken = token();
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  const blobs: Array<{ pathname: string; url: string; uploadedAt: Date }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix: OFFSITE_PREFIX,
      limit: 1000,
      cursor,
      token: blobToken,
    });
    blobs.push(...page.blobs.map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
      uploadedAt: blob.uploadedAt,
    })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function pruneExpiredOffsiteBackups(currentStamp: string) {
  const blobToken = token();
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  const cutoff = Date.now() - (OFFSITE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const blobs = await listAllOffsiteBlobs();
  const expiredUrls = blobs
    .filter((blob) => !blob.pathname.startsWith(`${OFFSITE_PREFIX}${currentStamp}/`))
    .filter((blob) => {
      const stamp = backupStampDate(blob.pathname);
      return Boolean(stamp && stamp.getTime() < cutoff);
    })
    .map((blob) => blob.url);

  for (let index = 0; index < expiredUrls.length; index += 100) {
    await del(expiredUrls.slice(index, index + 100), { token: blobToken });
  }

  return {
    retentionDays: OFFSITE_RETENTION_DAYS,
    deletedBackupObjects: expiredUrls.length,
  };
}

export async function getLatestOffsiteBackup() {
  if (!isOffsiteBackupConfigured()) return null;
  const manifests = (await listAllOffsiteBlobs())
    .filter((blob) => blob.pathname.endsWith("/manifest.json"))
    .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime());
  return manifests[0] ?? null;
}
