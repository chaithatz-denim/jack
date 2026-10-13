import { DisplaySettingsControls } from "@/components/DisplayPrefs";
import { UserPasswordSettings } from "@/components/UserPasswordSettings";
import { ResetSystemDataPanel } from "@/components/ResetSystemDataPanel";
import { getAppUsers } from "@/lib/supabase/data";
import { requireUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams?: Promise<{ user?: string }> }) {
  const user = await requireUser();
  const query = await searchParams;
  const isAdmin = user.role === "Admin";
  const users = isAdmin ? await getAppUsers() : [];

  return <section className="page active" id="settingsPage">
    <div className="page-head">
      <div>
        <span className="eyebrow"><span data-th>ควบคุมระบบ</span><span data-en>System Control</span></span>
        <h1><span data-th>ตั้งค่า</span><span data-en>Settings</span></h1>
        <p><span data-th>ตั้งค่าภาษา ขนาดตัวอักษร ผู้ใช้งาน สิทธิ์ และการล้างข้อมูล</span><span data-en>Configure language, screen size, users, permissions, and system reset.</span></p>
      </div>
    </div>

    <div className="settings-grid">
      <section className="panel settings-control-card">
        <div className="panel-head"><h2><span data-th>ตั้งค่าการแสดงผล</span><span data-en>Display settings</span></h2></div>
        <DisplaySettingsControls/>
        {isAdmin && <ResetSystemDataPanel variant="inline"/>}
      </section>

      {isAdmin && <UserPasswordSettings users={users} currentUserId={user.id} dialogUserId={query?.user ?? null}/>}

      {isAdmin && <section className="panel" id="permissionRulesPanel">
        <div className="panel-head"><h2><span data-th>กฎสิทธิ์การใช้งาน</span><span data-en>Permission rules</span></h2></div>
        <div className="permission-matrix">
          <div><b>Admin</b><span><span data-th>ควบคุมและแก้ไขได้ทุกอย่าง</span><span data-en>Full control over all functions.</span></span></div>
          <div><b>Pattern</b><span><span data-th>อัพเดทเฉพาะงานแพทเทิร์น</span><span data-en>Can update pattern work only.</span></span></div>
          <div><b>Cutting</b><span><span data-th>อัพเดทเฉพาะงานตัด</span><span data-en>Can update cutting work only.</span></span></div>
          <div><b>Mer</b><span><span data-th>อัพเดทงานปัก/สกรีน เย็บ ฟอก และ QC</span><span data-en>Can update embellishment, sewing, washing, and QC.</span></span></div>
        </div>
      </section>}
    </div>
  </section>;
}
