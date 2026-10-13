import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { LocalizedSelect } from "@/components/LocalizedSelect";
import { requireUser } from "@/lib/supabase/auth";
import { getDailyCompletionReport, type DailyCompletionRow } from "@/lib/supabase/data";
import { formatDateTimeBangkok, formatShortDateBangkok, todayBangkokDate } from "@/lib/time";

export const dynamic = "force-dynamic";

function T({ th, en }: { th: string; en: string }) {
  return <><span data-th>{th}</span><span data-en>{en}</span></>;
}

const stageNames: Record<string, { th: string; en: string }> = {
  Pattern: { th: "สร้างแพทเทิร์น", en: "Pattern" },
  Cutting: { th: "ตัดงาน", en: "Cutting" },
  Embellishment: { th: "ปัก/สกรีน", en: "Embroidery / Screen" },
  Sewing: { th: "เย็บ", en: "Sewing" },
  Washing: { th: "ฟอก", en: "Washing" },
  QC: { th: "QC", en: "QC" },
};

const roleNames: Record<string, { th: string; en: string }> = {
  Pattern: { th: "ช่าง Pattern", en: "Pattern" },
  Cutting: { th: "ช่างตัด", en: "Cutting" },
  Mer: { th: "Mer", en: "Mer" },
  Admin: { th: "Admin", en: "Admin" },
};

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00+07:00`);
  value.setUTCDate(value.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function timeOnly(value: string) {
  return formatDateTimeBangkok(value).split(",").at(-1)?.trim() ?? formatDateTimeBangkok(value);
}

function countRole(rows: DailyCompletionRow[], role: string) {
  return rows.filter((row) => row.role === role).length;
}

function countStage(rows: DailyCompletionRow[], stage: string) {
  return rows.filter((row) => row.stage === stage).length;
}

function reportHref(date: string, role: string) {
  const query = new URLSearchParams({ date });
  if (role) query.set("role", role);
  return `/daily-report?${query.toString()}`;
}

function matchesResponsibility(row: { role: string; stage: string }, filter: string) {
  if (!filter) return true;
  return row.role === filter;
}

export default async function DailyReportPage({ searchParams }: { searchParams?: Promise<{ date?: string; role?: string }> }) {
  await requireUser();
  const params = await searchParams;
  const report = await getDailyCompletionReport(params?.date);
  const today = todayBangkokDate();
  const selectedRole = ["Pattern", "Cutting", "Mer"].includes(params?.role ?? "") ? params!.role! : "";
  const visibleRows = report.rows.filter((row) => matchesResponsibility(row, selectedRole));
  const selectedSummaryRole = selectedRole;
  const maxRoleCount = Math.max(1, ...["Pattern", "Cutting", "Mer"].map((role) => countRole(visibleRows, role)));

  return <section className="page active" id="dailyReportPage">
    <div className="page-head daily-report-head">
      <div>
        <span className="eyebrow">Daily Production Output</span>
        <h1><T th="รายงานงานเสร็จรายวัน" en="Daily Completed Work"/></h1>
        <p><T th="ตรวจสอบว่าในแต่ละวัน แต่ละหน้าที่ทำงานเสร็จไปกี่งาน" en="See how many jobs each responsibility completes in one day."/></p>
      </div>
      <form className="daily-date-filter" action="/daily-report">
        <label htmlFor="dailyReportDate"><CalendarDays size={17}/><T th="เลือกวันที่" en="Select date"/></label>
        <div>
          <Link className="date-step" href={reportHref(moveDate(report.date, -1), selectedRole)} aria-label="Previous day"><ChevronLeft size={18}/></Link>
          <input id="dailyReportDate" type="date" name="date" defaultValue={report.date} max={today}/>
          {report.date < today
            ? <Link className="date-step" href={reportHref(moveDate(report.date, 1), selectedRole)} aria-label="Next day"><ChevronRight size={18}/></Link>
            : <span className="date-step disabled" aria-hidden="true"><ChevronRight size={18}/></span>}
          <label className="daily-role-filter"><span><T th="หน้าที่" en="Responsibility"/></span><LocalizedSelect
            className="daily-role-select"
            name="role"
            defaultValue={selectedRole}
            options={[
              { value: "", th: "ทุกหน้าที่", en: "All responsibilities" },
              { value: "Pattern", th: "ช่าง Pattern", en: "Pattern" },
              { value: "Cutting", th: "ช่างตัด", en: "Cutting" },
              { value: "Mer", th: "Mer", en: "Mer" },
            ]}
          /></label>
          <button className="btn primary" type="submit"><T th="ดูรายงาน" en="View report"/></button>
        </div>
      </form>
    </div>

    {report.isPrototypeData && <div className="prototype-data-note"><b><T th="ข้อมูลตัวอย่างสำหรับ Prototype" en="Prototype sample data"/></b><span><T th="วันดังกล่าวยังไม่มีประวัติงานเสร็จ ระบบจึงแสดงข้อมูลจำลองเพื่อให้ตรวจรูปแบบหน้าจอ" en="No completion history exists for this date, so sample data is shown for layout review."/></span></div>}

    <div className="metrics daily-metrics">
      <div className="metric daily-total"><label><T th={selectedRole ? "งานเสร็จของหน้าที่นี้" : "งานเสร็จทั้งหมด"} en={selectedRole ? "Completed for this role" : "Total completed"}/></label><strong>{visibleRows.length}</strong><small><T th="ขั้นตอน" en="stages"/></small></div>
      {(["Pattern", "Cutting", "Mer"] as const).map((role) => {
        const count = countRole(visibleRows, role);
        return <div className={`metric role-${role.toLowerCase()} ${selectedSummaryRole && selectedSummaryRole !== role ? "filtered-out" : ""} ${selectedSummaryRole === role ? "selected-role" : ""}`} key={role}>
          <label><T th={roleNames[role].th} en={roleNames[role].en}/></label>
          <strong>{count}</strong>
          <small><T th="งานที่ทำเสร็จ" en="completed jobs"/></small>
          <i className="metric-mini-bar"><b style={{ width: `${Math.round((count / maxRoleCount) * 100)}%` }}/></i>
        </div>;
      })}
    </div>

    <section className="daily-stage-panel">
      <header><div><span className="eyebrow">Stage Breakdown</span><h2><T th="สรุปตามขั้นตอนการผลิต" en="Production stage summary"/></h2></div><b className="daily-date-chip">{formatShortDateBangkok(report.date)}</b></header>
      <div className="daily-stage-grid">
        {Object.entries(stageNames).map(([stage, label]) => {
          const owner = stage === "Pattern" ? "Pattern" : stage === "Cutting" ? "Cutting" : "Mer";
          return <div className={`daily-stage-item stage-${stage.toLowerCase()}`} key={stage}>
            <span className="stage-dot"/>
            <div><b><T th={label.th} en={label.en}/></b><small><T th={roleNames[owner].th} en={roleNames[owner].en}/></small></div>
            <strong>{countStage(visibleRows, stage)}</strong>
          </div>;
        })}
      </div>
    </section>

    <section className="table-panel daily-detail-panel">
      <header className="daily-table-head"><div><span className="eyebrow">Completed Work Log</span><h2><T th="รายละเอียดงานที่ทำเสร็จ" en="Completed work details"/></h2></div><span>{visibleRows.length} <T th="รายการ" en="records"/></span></header>
      <div className="table-wrap">
        <table className="data daily-report-table">
          <thead><tr>
            <th><T th="รหัสตัวอย่าง" en="Sample ID"/></th>
            <th><T th="รหัสโมเดล" en="Model ID"/></th>
            <th><T th="ชื่อผ้า" en="Fabric name"/></th>
            <th><T th="รหัสบล็อค" en="Block ID"/></th>
            <th title="เวลาที่กดทำงานเสร็จ"><T th="เวลา" en="Time"/></th>
            <th><T th="งานที่เสร็จ" en="Completed stage"/></th>
            <th><T th="หน้าที่" en="Responsibility"/></th>
            <th><T th="ผู้ดำเนินการ" en="Completed by"/></th>
          </tr></thead>
          <tbody>{visibleRows.map((row) => <tr key={row.id}>
            <td>{row.sampleId && !row.sampleId.startsWith("prototype-") ? <Link className="code" href={`/samples/${row.sampleId}`}>{row.sampleCode}</Link> : <span className="code">{row.sampleCode}</span>}</td>
            <td><b>{row.modelId}</b></td>
            <td>{row.fabricName}</td>
            <td><span className="daily-block" title={row.blockId}>{row.blockId}</span></td>
            <td><b className="daily-time">{timeOnly(row.completedAt)}</b></td>
            <td><span className={`badge daily-stage-badge stage-${row.stage.toLowerCase()}`}><T th={stageNames[row.stage]?.th ?? row.stage} en={stageNames[row.stage]?.en ?? row.stage}/></span></td>
            <td><T th={roleNames[row.role]?.th ?? row.role} en={roleNames[row.role]?.en ?? row.role}/></td>
            <td><span className="daily-user"><i>{row.actorUsername.slice(0, 2).toUpperCase()}</i><b>{row.actorUsername}</b></span></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visibleRows.length && <div className="empty daily-empty"><CalendarDays size={30}/><b><T th="ไม่พบงานที่ทำเสร็จตามตัวกรองนี้" en="No completed work matches this filter"/></b><p><T th="ลองเลือกวันที่หรือหน้าที่อื่นเพื่อดูรายงาน" en="Try another date or responsibility."/></p></div>}
    </section>
  </section>;
}
