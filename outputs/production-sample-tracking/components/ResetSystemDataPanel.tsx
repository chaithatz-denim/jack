"use client";

import { Trash2 } from "lucide-react";
import { clearCacheAction, clearSystemDataAction } from "@/lib/supabase/actions";

export function ResetSystemDataPanel({ variant = "panel" }: { variant?: "panel" | "inline" }) {
  const body = <>
    <div className="panel-head">
      <div>
        <h2><span data-th>ล้างข้อมูลในระบบ</span><span data-en>Reset system data</span></h2>
        <p className="muted"><span data-th>ซ่อนรายการตัวอย่างทั้งหมดออกจากระบบใช้งานจริง เหมือนปุ่ม Reset ใน Prototype</span><span data-en>Archive all active sample records, matching the prototype reset behavior.</span></p>
      </div>
    </div>
    <div className="settings-maintenance-actions">
      <form
        action={clearCacheAction}
        onSubmit={(event) => {
          if (!window.confirm("ยืนยันล้าง Cache และ Refresh ข้อมูลหน้าระบบ?")) event.preventDefault();
        }}
      >
        <button className="btn" type="submit"><span data-th>ล้าง Cache / Refresh</span><span data-en>Clear cache / refresh</span></button>
        <small className="muted"><span data-th>ไม่ลบข้อมูล ใช้กรณีลบแล้วหน้าจอยังค้างข้อมูลเดิม</span><span data-en>Does not delete data. Use when deleted records still appear stale.</span></small>
      </form>
      <form
        action={clearSystemDataAction}
        onSubmit={(event) => {
          if (!window.confirm("ยืนยันล้างรายการตัวอย่างทั้งหมดในระบบ?")) event.preventDefault();
        }}
      >
        <button className="btn danger" type="submit"><Trash2 size={14}/> <span data-th>ล้างข้อมูลในระบบ</span><span data-en>Reset system data</span></button>
        <small className="muted"><span data-th>สำหรับ Admin เท่านั้น ระบบจะ archive รายการตัวอย่าง ไม่ลบไฟล์ออกจาก Storage โดยตรง</span><span data-en>Admin only. Samples are archived; Storage files are not hard-deleted.</span></small>
      </form>
    </div>
  </>;

  if (variant === "inline") return <div className="settings-reset-inline" id="resetSystemDataPanel">{body}</div>;
  return <section className="panel settings-reset-panel" id="resetSystemDataPanel">{body}</section>;
}
