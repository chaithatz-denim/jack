"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "./server";
import { clearUserCookie, getCurrentUser, hashPassword, needsPasswordRehash, requireAdmin, setUserCookie, validatePasswordStrength, verifyPassword } from "./auth";
import { writeAuditLog } from "./audit";
import type { AppRole } from "./auth";
import { nowIso } from "../time";

const roles: AppRole[] = ["Admin", "Pattern", "Cutting", "Mer", "Viewer"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function passwordText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function roleValue(formData: FormData): AppRole {
  const role = text(formData, "role") as AppRole;
  return roles.includes(role) ? role : "Viewer";
}

function revalidateSettingsViews() {
  revalidatePath("/settings");
  revalidatePath("/stages");
}

async function tooManyFailedLogins(supabase: any, username: string) {
  if (!username) return false;
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "LOGIN_FAILED")
    .eq("metadata->>username", username)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= 8;
}

export async function signInAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const username = text(formData, "username");
  const password = passwordText(formData, "password");
  const supabase = createSupabaseAdminClient() as any;

  if (await tooManyFailedLogins(supabase, username)) {
    await writeAuditLog(supabase, {
      action: "LOGIN_RATE_LIMITED",
      entityType: "auth",
      metadata: { username },
    });
    return { error: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่" };
  }

  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,password_hash,is_active")
    .eq("username", username)
    .maybeSingle();
  if (error || !data || !data.is_active || !verifyPassword(password, data.password_hash)) {
    await writeAuditLog(supabase, {
      action: "LOGIN_FAILED",
      entityType: "auth",
      metadata: {
        username,
        reason: error ? "query_error" : !data ? "user_not_found" : !data.is_active ? "inactive_user" : "invalid_password",
      },
    });
    return { error: "Username หรือ Password ไม่ถูกต้อง" };
  }
  if (needsPasswordRehash(data.password_hash)) {
    await supabase.from("app_users").update({
      password_hash: hashPassword(password),
      updated_at: nowIso(),
    }).eq("id", data.id);
  }
  await writeAuditLog(supabase, {
    actorUserId: data.id,
    actorUsername: data.username,
    action: "LOGIN_SUCCESS",
    entityType: "auth",
    entityId: data.id,
  });
  await setUserCookie(data.id);
  redirect("/");
}

export async function signOutAction() {
  const user = await getCurrentUser();
  const supabase = createSupabaseAdminClient() as any;
  if (user) {
    await writeAuditLog(supabase, {
      actorUserId: user.id,
      actorUsername: user.username,
      action: "LOGOUT",
      entityType: "auth",
      entityId: user.id,
    });
  }
  await clearUserCookie();
  redirect("/login");
}

export async function createUserAction(formData: FormData) {
  const currentUser = await requireAdmin();
  const username = text(formData, "username");
  const password = passwordText(formData, "password");
  const displayName = text(formData, "display_name");
  if (!username || !password || !displayName) throw new Error("username, display name and password are required.");
  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw new Error(passwordError);
  const supabase = createSupabaseAdminClient() as any;
  const { data: createdUser, error } = await supabase.from("app_users").insert({
    username,
    display_name: displayName,
    role: roleValue(formData),
    password_hash: hashPassword(password),
    is_active: true,
  }).select("id,username,role,is_active").single();
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    actorUserId: currentUser.id,
    actorUsername: currentUser.username,
    action: "CREATE_USER",
    entityType: "app_user",
    entityId: createdUser.id,
    metadata: {
      username: createdUser.username,
      role: createdUser.role,
      is_active: createdUser.is_active,
    },
  });
  revalidateSettingsViews();
  redirect("/settings");
}

export async function updateUserAction(userId: string, formData: FormData) {
  const currentUser = await requireAdmin();
  const username = text(formData, "username");
  const displayName = text(formData, "display_name");
  const password = passwordText(formData, "password");
  const passwordConfirm = passwordText(formData, "password_confirm");
  const role = roleValue(formData);
  const isActive = formData.get("is_active") === "on";

  if (!username || !displayName) throw new Error("username and display name are required.");
  if (password || passwordConfirm) {
    if (!password) throw new Error("New password is required.");
    if (password !== passwordConfirm) throw new Error("Password confirmation does not match.");
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new Error(passwordError);
  }

  const supabase = createSupabaseAdminClient() as any;
  const { data: target, error: targetError } = await supabase
    .from("app_users")
    .select("id,username,role,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("User not found.");
  if (userId === currentUser.id && (role !== "Admin" || !isActive)) {
    throw new Error("Cannot remove Admin access or deactivate the signed-in user.");
  }

  if (target.role === "Admin" && (role !== "Admin" || !isActive)) {
    const { count, error: countError } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "Admin")
      .eq("is_active", true);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) <= 1) throw new Error("At least one active Admin is required.");
  }

  const payload: Record<string, unknown> = {
    username,
    display_name: displayName,
    role,
    is_active: isActive,
    updated_at: nowIso(),
  };
  if (password) payload.password_hash = hashPassword(password);
  const { error } = await supabase.from("app_users").update(payload).eq("id", userId);
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    actorUserId: currentUser.id,
    actorUsername: currentUser.username,
    action: "UPDATE_USER",
    entityType: "app_user",
    entityId: userId,
    metadata: {
      previous_username: target.username,
      previous_role: target.role,
      previous_is_active: target.is_active,
      username,
      role,
      is_active: isActive,
      password_changed: Boolean(password),
    },
  });
  revalidateSettingsViews();
  redirect("/settings");
}

export async function deleteUserAction(userId: string) {
  const currentUser = await requireAdmin();
  const supabase = createSupabaseAdminClient() as any;
  const { data: target, error: targetError } = await supabase
    .from("app_users")
    .select("id,username,role,is_active")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("User not found.");
  if (target.id === currentUser.id) throw new Error("Cannot delete the signed-in user.");

  if (target.role === "Admin" && target.is_active) {
    const { count, error: countError } = await supabase
      .from("app_users")
      .select("id", { count: "exact", head: true })
      .eq("role", "Admin")
      .eq("is_active", true);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) <= 1) throw new Error("At least one active Admin is required.");
  }

  const { error } = await supabase.from("app_users").delete().eq("id", userId);
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    actorUserId: currentUser.id,
    actorUsername: currentUser.username,
    action: "DELETE_USER",
    entityType: "app_user",
    entityId: userId,
    metadata: {
      username: target.username,
      role: target.role,
      was_active: target.is_active,
    },
  });
  revalidateSettingsViews();
  redirect("/settings");
}
