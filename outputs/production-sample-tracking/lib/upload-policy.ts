export const FILE_INPUT_ACCEPT = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".dxf",
  ".ai",
  ".zip",
].join(",");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_EXTENSIONS = new Set(FILE_INPUT_ACCEPT.split(","));

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_UPLOAD_BYTES = 50 * 1024 * 1024;

export type UploadValidationCode = "unsupported" | "too-large";

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function isImageUpload(file: Pick<File, "name">) {
  return IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

export function validateUploadFile(file: Pick<File, "name" | "size">): UploadValidationCode | null {
  const extension = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) return "unsupported";
  const sizeLimit = IMAGE_EXTENSIONS.has(extension) ? MAX_IMAGE_UPLOAD_BYTES : MAX_DOCUMENT_UPLOAD_BYTES;
  return file.size > sizeLimit ? "too-large" : null;
}

export function storageContentType(file: Pick<File, "name" | "type">) {
  const extension = extensionOf(file.name);
  if (IMAGE_EXTENSIONS.has(extension)) {
    if (extension === ".png") return "image/png";
    if (extension === ".webp") return "image/webp";
    return "image/jpeg";
  }
  if (extension === ".pdf") return "application/pdf";
  // The private Supabase bucket intentionally stores other approved production
  // documents as binary data so Office/DXF/AI MIME variations remain portable.
  return "application/octet-stream";
}
