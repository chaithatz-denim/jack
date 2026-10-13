"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Boxes, ClipboardCheck, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { SampleEditSubmitConfirm } from "@/components/ConfirmSubmitButton";
import { DisplayPrefsRuntime } from "@/components/DisplayPrefs";
import { signOutAction } from "@/lib/supabase/user-actions";
import type { AppUser } from "@/lib/supabase/auth";

const nav = [
  ["Samples", "รายการตัวอย่าง", "/samples", Boxes],
  ["My Tasks", "งานของฉัน", "/my-task", ClipboardCheck],
  ["Daily Report", "รายงานรายวัน", "/daily-report", BarChart3],
  ["Settings", "ตั้งค่า", "/settings", Settings2],
] as const;

export function AppShell({ children, user }: { children: ReactNode; user: AppUser | null }) {
  const path = usePathname();
  if (!user) return <><DisplayPrefsRuntime/><main>{children}</main></>;

  return <div className="app-shell top-menu-shell" id="appShell">
    <DisplayPrefsRuntime/>
    <SampleEditSubmitConfirm/>
    <header className="top-menu">
      <Link href="/samples" className="brand top-brand">
        <div className="brand-logo-wrap">
          <img className="brand-logo" src="/assets/jack-russel-logo-white.png" alt="JACK RUSSEL"/>
        </div>
        <div><b>JACK RUSSEL</b><small>Production Sample Tracking</small></div>
      </Link>

      <nav className="nav top-nav" aria-label="Main navigation">
        {nav.map(([labelEn, labelTh, href, Icon]) => {
          const active =
            href === "/samples" ? path === "/" || path.startsWith("/samples")
            : href === "/my-task" ? path.startsWith("/my-task") || path.startsWith("/tasks")
            : href === "/daily-report" ? path.startsWith("/daily-report")
            : href === "/settings" ? path.startsWith("/settings") || path.startsWith("/stages")
            : path.startsWith(href);
          return <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`}>
            <Icon className="nav-glyph" size={18}/><span><span data-th>{labelTh}</span><span data-en>{labelEn}</span></span>
          </Link>;
        })}
      </nav>

      <div className="top-user">
        <button className="icon-btn has-dot" aria-label="Notifications" type="button"><Bell size={17}/></button>
        <span className="avatar">{user.display_name.slice(0, 2).toUpperCase()}</span>
        <span className="user-meta"><b>{user.display_name}</b><small className="role-chip">{user.role}</small></span>
        <form action={signOutAction}><button className="header-btn" type="submit"><span data-th>ออกจากระบบ</span><span data-en>Logout</span></button></form>
      </div>
    </header>

    <main className="content">{children}</main>
  </div>;
}
