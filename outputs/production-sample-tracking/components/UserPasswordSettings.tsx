"use client";

import Link from "next/link";
import { type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createUserAction, deleteUserAction, updateUserAction } from "@/lib/supabase/user-actions";
import type { AppRole, AppUser } from "@/lib/supabase/auth";
import { formatShortDateBangkok } from "@/lib/time";
import { MIN_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";

type SettingsUser = AppUser & { created_at: string; updated_at: string };

const roles: AppRole[] = ["Admin", "Pattern", "Cutting", "Mer", "Viewer"];

const roleLabelsTh: Record<AppRole, string> = {
  Admin: "Admin",
  Pattern: "ช่าง Pattern",
  Cutting: "ช่างตัด",
  Mer: "Mer",
  Viewer: "ดูอย่างเดียว",
};

const roleLabelsEn: Record<AppRole, string> = {
  Admin: "Admin",
  Pattern: "Pattern",
  Cutting: "Cutting",
  Mer: "Mer",
  Viewer: "Viewer",
};

function RoleLabel({ role }: { role: AppRole }) {
  return <><span data-th>{roleLabelsTh[role]}</span><span data-en>{roleLabelsEn[role]}</span></>;
}

function RoleOptions() {
  return <>
    {roles.map((role) => <option key={role} value={role}>{roleLabelsEn[role]}</option>)}
  </>;
}

function formatUpdated(value: string) {
  return formatShortDateBangkok(value);
}

function validatePasswordChange(event: FormEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
  const confirmInput = form.elements.namedItem("password_confirm") as HTMLInputElement | null;
  const password = passwordInput?.value ?? "";
  const confirm = confirmInput?.value ?? "";

  if (!password && !confirm) return;
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    event.preventDefault();
    window.alert(`Password ต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
    passwordInput?.focus();
    return;
  }
  if (password !== confirm) {
    event.preventDefault();
    window.alert("Password ใหม่และช่องยืนยัน Password ต้องตรงกัน");
    confirmInput?.focus();
  }
}

export function UserPasswordSettings({ users, currentUserId, dialogUserId }: { users: SettingsUser[]; currentUserId: string; dialogUserId?: string | null }) {
  const createOpen = dialogUserId === "new";
  const editingUser = users.find((user) => user.id === dialogUserId) ?? null;
  const adminCount = users.filter((user) => user.role === "Admin" && user.is_active).length;

  return <section className="panel wide-panel" id="userSettingsPanel">
    <div className="panel-head">
      <div>
        <h2><span data-th>ตั้งค่า User / Password</span><span data-en>User / Password settings</span></h2>
        <p className="muted"><span data-th>Admin สร้าง แก้ไข ลบ User และกำหนด Role ได้ในหน้านี้</span><span data-en>Admins can create, edit, delete users, and assign roles here.</span></p>
      </div>
      <Link className="btn primary" href="/settings?user=new"><Plus size={14}/> <span data-th>เพิ่ม User</span><span data-en>Add user</span></Link>
    </div>

    <div className="table-wrap">
      <table className="data user-settings-table">
        <thead>
          <tr>
            <th><span data-th>ชื่อผู้ใช้</span><span data-en>User name</span></th>
            <th><span data-th>ชื่อ</span><span data-en>Name</span></th>
            <th><span data-th>สิทธิ์</span><span data-en>Role</span></th>
            <th><span data-th>รหัสผ่าน</span><span data-en>Password</span></th>
            <th><span data-th>อัพเดทล่าสุด</span><span data-en>Updated</span></th>
            <th><span data-th>จัดการ</span><span data-en>Action</span></th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && <tr><td colSpan={6}><div className="empty"><b><span data-th>ยังไม่มี User ในระบบ</span><span data-en>No users found</span></b><p><span data-th>กด + เพิ่ม User เพื่อสร้างบัญชีเข้าใช้งาน</span><span data-en>Click + Add user to create a login account.</span></p></div></td></tr>}
          {users.map((user) => {
            const isCurrent = user.id === currentUserId;
            const isLastAdmin = user.role === "Admin" && adminCount <= 1;
            const disableDelete = isCurrent || isLastAdmin;
            const deleteTitle = isCurrent ? "ลบ User ที่กำลังใช้งานไม่ได้" : isLastAdmin ? "ต้องเหลือ Admin อย่างน้อย 1 คน" : "";
            return <tr key={user.id}>
              <td><span className="code">{user.username}</span></td>
              <td><b>{user.display_name || "—"}</b></td>
              <td><RoleLabel role={user.role}/></td>
              <td className="user-password">••••••</td>
              <td className="nowrap">{formatUpdated(user.updated_at)}<small>{user.is_active ? <><span data-th>ใช้งานอยู่</span><span data-en>Active</span></> : <><span data-th>ปิดใช้งาน</span><span data-en>Inactive</span></>}</small></td>
              <td>
                <div className="user-table-actions">
                  <Link className="btn small" href={`/settings?user=${encodeURIComponent(user.id)}`}><span data-th>แก้ไข</span><span data-en>Edit</span></Link>
                  <form action={deleteUserAction.bind(null, user.id)} onSubmit={(event) => {
                    if (disableDelete || !window.confirm(`ยืนยันลบ User ${user.username}?`)) event.preventDefault();
                  }}>
                    <button className="btn danger small" type="submit" disabled={disableDelete} title={deleteTitle}><Trash2 size={13}/> <span data-th>ลบ</span><span data-en>Delete</span></button>
                  </form>
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>

    {createOpen && <div className="modal-backdrop" role="presentation">
      <form action={createUserAction} className="modal user-settings-modal">
        <div className="modal-head"><h2><span data-th>สร้าง User</span><span data-en>Create user</span></h2><Link className="modal-close-link" href="/settings" aria-label="Close">×</Link></div>
        <div className="modal-body">
          <div className="user-credential-form">
            <label className="field"><span><span data-th>ชื่อผู้ใช้ *</span><span data-en>User name *</span></span><input name="username" required autoComplete="off" placeholder="pattern1"/></label>
            <label className="field"><span><span data-th>ชื่อ *</span><span data-en>Name *</span></span><input name="display_name" required autoComplete="off" placeholder="Pattern 1"/></label>
            <label className="field"><span><span data-th>รหัสผ่าน *</span><span data-en>Password *</span></span><input name="password" required type="password" autoComplete="new-password" placeholder="รหัสผ่าน"/></label>
            <label className="field"><span><span data-th>สิทธิ์ *</span><span data-en>Role *</span></span><select name="role" defaultValue="Pattern"><RoleOptions/></select><small className="muted"><span data-th>Role ใช้กำหนดสิทธิ์และงานที่เห็นในหน้า My Task</span><span data-en>Role controls permissions and tasks shown in My Task.</span></small></label>
          </div>
        </div>
        <div className="modal-foot"><Link className="btn" href="/settings"><span data-th>ยกเลิก</span><span data-en>Cancel</span></Link><button className="btn primary" type="submit"><span data-th>ยืนยัน</span><span data-en>Confirm</span></button></div>
      </form>
    </div>}

    {editingUser && <div className="modal-backdrop" role="presentation">
      <form action={updateUserAction.bind(null, editingUser.id)} className="modal user-settings-modal" onSubmit={validatePasswordChange}>
        <div className="modal-head"><h2><span data-th>แก้ไข User</span><span data-en>Edit user</span></h2><Link className="modal-close-link" href="/settings" aria-label="Close">×</Link></div>
        <div className="modal-body">
          <div className="user-credential-form">
            <label className="field"><span><span data-th>ชื่อผู้ใช้ *</span><span data-en>User name *</span></span><input name="username" required autoComplete="off" defaultValue={editingUser.username}/></label>
            <label className="field"><span><span data-th>ชื่อ *</span><span data-en>Name *</span></span><input name="display_name" required autoComplete="off" defaultValue={editingUser.display_name}/></label>
            <label className="field"><span><span data-th>รหัสผ่านใหม่</span><span data-en>New password</span></span><input name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}/><small className="muted"><span data-th>เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน Password</span><span data-en>Leave blank if you do not want to change the password.</span></small></label>
            <label className="field"><span><span data-th>ยืนยันรหัสผ่านใหม่</span><span data-en>Confirm new password</span></span><input name="password_confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} placeholder="พิมพ์ Password ใหม่อีกครั้ง"/></label>
            <label className="field"><span><span data-th>สิทธิ์ *</span><span data-en>Role *</span></span><select name="role" defaultValue={editingUser.role}><RoleOptions/></select><small className="muted"><span data-th>Role ใช้กำหนดสิทธิ์และงานที่เห็นในหน้า My Task</span><span data-en>Role controls permissions and tasks shown in My Task.</span></small></label>
            <label className="choice field full"><input name="is_active" type="checkbox" defaultChecked={editingUser.is_active}/> <span><span data-th>เปิดใช้งาน</span><span data-en>Active</span></span></label>
          </div>
        </div>
        <div className="modal-foot"><Link className="btn" href="/settings"><span data-th>ยกเลิก</span><span data-en>Cancel</span></Link><button className="btn primary" type="submit"><span data-th>ยืนยัน</span><span data-en>Confirm</span></button></div>
      </form>
    </div>}
  </section>;
}
