import "server-only";

import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "./server";
import { MIN_PASSWORD_LENGTH, validatePasswordStrength } from "../password-policy";

export { MIN_PASSWORD_LENGTH, validatePasswordStrength };

export type AppRole = "Admin" | "Pattern" | "Cutting" | "Mer" | "Viewer";
export interface AppUser {
  id: string;
  username: string;
  display_name: string;
  role: AppRole;
  profile_image_path: string | null;
  is_active: boolean;
}

const LOCAL_PROTOTYPE_PREVIEW_USER: AppUser = {
  id: "local-prototype-preview",
  username: "prototype-preview",
  display_name: "Prototype Preview",
  role: "Viewer",
  profile_image_path: null,
  is_active: true,
};

const COOKIE_NAME = "jr_sample_user";
const PASSWORD_FORMAT = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function legacySha256(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256").toString("base64url");
  return `${PASSWORD_FORMAT}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith(`${PASSWORD_FORMAT}$`)) {
    const [, iterationsRaw, salt, hash] = storedHash.split("$");
    const iterations = Number(iterationsRaw);
    if (!iterations || !salt || !hash) return false;
    const candidate = pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, "sha256").toString("base64url");
    return safeEqual(candidate, hash);
  }
  return safeEqual(legacySha256(password), storedHash);
}

export function needsPasswordRehash(storedHash: string) {
  if (!storedHash.startsWith(`${PASSWORD_FORMAT}$`)) return true;
  const iterations = Number(storedHash.split("$")[1]);
  return !iterations || iterations < PASSWORD_ITERATIONS;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required for production sessions.");
  }
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret && !fallback) throw new Error("SESSION_SECRET is required for sessions.");
  if (!secret && fallback) console.warn("SESSION_SECRET is not configured; using development-only fallback session secret.");
  return secret || fallback || "";
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function createSessionToken(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({
    userId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: randomBytes(12).toString("base64url"),
  }));
  const signature = signSessionPayload(payload);
  return `${payload}.${signature}`;
}

function parseSessionToken(value: string | undefined) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signSessionPayload(payload), signature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; exp?: number };
    if (!parsed.userId || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (process.env.NODE_ENV === "development" && process.env.LOCAL_PROTOTYPE_PREVIEW === "true") {
    return LOCAL_PROTOTYPE_PREVIEW_USER;
  }
  const cookieStore = await cookies();
  const userId = parseSessionToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!userId) return null;
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,display_name,role,profile_image_path,is_active")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as AppUser;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "Admin") throw new Error("Admin role required.");
  return user;
}

export function canCreateSample(role: AppRole) {
  return role === "Admin" || role === "Mer";
}

export async function requireSampleCreator() {
  const user = await requireUser();
  if (!canCreateSample(user.role)) throw new Error("Admin or Mer role required to create samples.");
  return user;
}

export function canWorkOnStage(role: AppRole, stage: string | null | undefined) {
  if (role === "Admin") return true;
  if (!stage) return false;
  if (role === "Pattern") return stage === "Pattern";
  if (role === "Cutting") return stage === "Cutting";
  if (role === "Mer") return ["Embellishment", "Sewing", "Washing", "QC", "General"].includes(stage);
  return false;
}

export async function requireStageAccess(stage: string | null | undefined) {
  const user = await requireUser();
  if (!canWorkOnStage(user.role, stage)) throw new Error(`Role ${user.role} cannot update ${stage}.`);
  return user;
}

export async function setUserCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    priority: "high",
  });
}

export async function clearUserCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
