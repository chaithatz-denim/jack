import Link from "next/link";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Eye, Gauge, ListChecks, Wrench } from "lucide-react";
import { getTaskDashboard, type RolePerformanceRow, type TaskRow } from "@/lib/supabase/data";
import { requireUser } from "@/lib/supabase/auth";
import { formatShortDate, priorityText, sampleToPrototype, stageOwner, stageOwnerEn, statusBadgeClass, statusTextEn } from "@/lib/supabase/mappers";
import { todayBangkokDate } from "@/lib/time";
import { EmptyState } from "@/components/UI";

export const dynamic = "force-dynamic";
const TASKS_PER_PAGE = 20;

function T({ th, en }: { th: string; en: string }) {
  return <><span data-th>{th}</span><span data-en>{en}</span></>;
}

function normalizedPage(value: string | undefined, totalPages: number) {
  const page = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, totalPages);
}

function taskHref({ page = 1, role, view }: { page?: number; role?: string; view?: string }) {
  const query = new URLSearchParams();
  if (role) query.set("role", role);
  if (view) query.set("view", view);
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/my-task?${queryString}` : "/my-task";
}

function dateNumber(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function overdueDays(dueDate: string | null) {
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((dateNumber(todayBangkokDate()) - dateNumber(dueDate)) / 86_400_000));
}

function priorityRank(value: string) {
  return value === "Urgent" ? 4 : value === "High" ? 3 : value === "Normal" ? 2 : 1;
}

function taskRequirement(task: TaskRow) {
  const mode = task.sample.workflow_mode;
  if (task.sample.status === "Pattern" && mode === "แก้ไข Spec") return { th: "แก้ไข Spec ตามผล QC และระบุรหัสบล็อคใหม่หรือบล็อคที่แก้ไข", en: "Revise the spec from QC feedback and enter the new or revised Block ID." };
  if (task.sample.status === "Pattern" && mode === "PPS") return { th: "สร้างแพทเทิร์น PPS และระบุรหัสบล็อคก่อนส่งงานต่อ", en: "Create the PPS pattern and enter its Block ID before handoff." };
  if (task.sample.status === "Pattern" && mode === "เกรดไซส์") return { th: "เกรดไซส์ให้ครบ เมื่อกดทำเสร็จรายการจะ Complete ทันที", en: "Complete size grading. Finishing this step will complete the sample." };
  const requirements = {
    Pattern: { th: "สร้างหรือแก้แพทเทิร์นให้เสร็จ และระบุรหัสบล็อคก่อนส่งงานต่อ", en: "Create or revise the pattern and enter the Block ID before handoff." },
    Cutting: { th: "ตัดงานตามแพทเทิร์นและอัปเดตขั้นตอนเมื่อทำเสร็จ", en: "Cut from the approved pattern and update the stage when finished." },
    Embellishment: { th: "เลือกว่ามีปัก/สกรีนหรือไม่ หากมีต้องระบุชื่อร้าน", en: "Confirm embroidery/screen printing. If required, enter the shop name." },
    Sewing: { th: "ดำเนินงานเย็บและระบุชื่อช่างเย็บก่อนกดทำเสร็จ", en: "Complete sewing and enter the sewing operator before finishing." },
    Washing: { th: "ดำเนินงานฟอกและระบุชื่อโรงฟอกก่อนกดทำเสร็จ", en: "Complete washing and enter the washing factory before finishing." },
    QC: { th: "ตรวจงานและเลือกผล QC เพื่อกำหนดขั้นตอนถัดไป", en: "Inspect the sample and select the QC outcome for the next workflow." },
  } as const;
  return requirements[task.sample.status as keyof typeof requirements] ?? { th: "ตรวจสอบรายละเอียดและอัปเดตงานให้เสร็จ", en: "Review the details and complete the assigned work." };
}

function selectedPerformance(rows: RolePerformanceRow[], role?: string) {
  const selected = role ? rows.filter((row) => row.role === role) : rows;
  return selected.reduce((result, row) => ({
    open: result.open + row.open,
    overdue: result.overdue + row.overdue,
    completedToday: result.completedToday + row.completedToday,
    completed7Days: result.completed7Days + row.completed7Days,
  }), { open: 0, overdue: 0, completedToday: 0, completed7Days: 0 });
}

export default async function TasksPage({ searchParams }: { searchParams?: Promise<{ role?: string; page?: string; view?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const isPrototypePreview = process.env.NODE_ENV === "development" && process.env.LOCAL_PROTOTYPE_PREVIEW === "true";
  const accessRole = isPrototypePreview ? "Admin" : user.role;
  const roleFilter = accessRole === "Admin" && ["Pattern", "Cutting", "Mer"].includes(params?.role ?? "") ? params?.role : undefined;
  const view = ["overdue", "today", "priority"].includes(params?.view ?? "") ? params!.view! : "";
  const dashboard = await getTaskDashboard(accessRole, roleFilter);
  const today = todayBangkokDate();
  const sortedTasks = [...dashboard.tasks].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.overdue && b.overdue) return overdueDays(b.dueDate) - overdueDays(a.dueDate);
    const priorityDifference = priorityRank(b.sample.priority) - priorityRank(a.sample.priority);
    return priorityDifference || dateNumber(a.dueDate) - dateNumber(b.dueDate);
  });
  const filteredTasks = sortedTasks.filter((task) => {
    if (view === "overdue") return task.overdue;
    if (view === "today") return task.dueDate?.slice(0, 10) === today;
    if (view === "priority") return ["Urgent", "High"].includes(task.sample.priority);
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / TASKS_PER_PAGE));
  const currentPage = normalizedPage(params?.page, totalPages);
  const pageStartIndex = (currentPage - 1) * TASKS_PER_PAGE;
  const pageTasks = filteredTasks.slice(pageStartIndex, pageStartIndex + TASKS_PER_PAGE);
  const visibleStart = filteredTasks.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageStartIndex + pageTasks.length, filteredTasks.length);
  const metrics = selectedPerformance(dashboard.performance, roleFilter ?? (accessRole === "Admin" ? undefined : accessRole));
  const overdueTasks = dashboard.tasks.filter((task) => task.overdue);
  const oldestOverdue = overdueTasks.reduce((max, task) => Math.max(max, overdueDays(task.dueDate)), 0);
  const ownerName = user.display_name;

  return <section className="page active task-command-page" id="tasksPage">
    <div className="page-head task-page-head">
      <div><span className="eyebrow">ROLE WORK QUEUE</span><h1><T th="งานของฉัน" en="My Tasks"/></h1><p><T th="เห็นงานค้าง งานเกินกำหนด และผลงานที่ทำเสร็จได้จากหน้าเดียว" en="See pending work, overdue risks, and completed performance in one place."/></p></div>
      {accessRole === "Admin" && <form className="task-user-actions" action="/my-task">
        <input type="hidden" name="view" value={view}/>
        <label><span><T th="ดูงานของหน้าที่" en="View responsibility"/></span><select className="task-owner-filter" name="role" defaultValue={roleFilter ?? ""}>
          <option value="">ทุกหน้าที่ / All roles</option>
          <option value="Pattern">ช่าง Pattern</option>
          <option value="Cutting">ช่างตัด</option>
          <option value="Mer">Mer</option>
        </select></label>
        <button className="btn small" type="submit"><T th="ดูงาน" en="View tasks"/></button>
      </form>}
    </div>

    <section className="task-user-card performance-user-card" id="taskUserProfile">
      <div className="task-profile-photo">{ownerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
      <div>
        <span className="eyebrow"><T th="ผู้ใช้งานปัจจุบัน" en="Current user"/></span>
        <h2>{ownerName}</h2>
        <p><T th="ผู้ใช้" en="User"/>: {user.username} · <T th="สิทธิ์" en="Role"/>: {isPrototypePreview ? "Admin Preview" : user.role}</p>
      </div>
      <div className="task-user-meta"><span className="badge b-active">{isPrototypePreview ? "Admin Preview" : user.role}</span><span className="badge b-normal">{metrics.open} <T th="งานเปิด" en="open"/></span></div>
    </section>

    <section className={`overdue-command ${metrics.overdue ? "has-overdue" : "is-clear"}`}>
      <div className="overdue-command-icon">{metrics.overdue ? <AlertTriangle size={27}/> : <CheckCircle2 size={27}/>}</div>
      <div><span className="eyebrow"><T th="OVERDUE CONTROL" en="OVERDUE CONTROL"/></span><h2>{metrics.overdue ? <T th={`มีงานเกินกำหนด ${metrics.overdue} งาน`} en={`${metrics.overdue} overdue tasks`}/> : <T th="ไม่มีงานเกินกำหนด" en="No overdue tasks"/>}</h2><p>{metrics.overdue ? <T th={`งานที่ค้างนานที่สุด ${oldestOverdue} วัน — เรียงงานเร่งด่วนที่สุดไว้ด้านบนแล้ว`} en={`The oldest task is ${oldestOverdue} days overdue. Highest-risk work is listed first.`}/> : <T th="คิวงานของหน้าที่นี้ยังอยู่ในกำหนด" en="This responsibility's queue is currently on schedule."/>}</p></div>
      {metrics.overdue > 0 && <Link className={`btn ${view === "overdue" ? "primary" : ""}`} href={taskHref({ role: roleFilter, view: view === "overdue" ? "" : "overdue" })}><AlertTriangle size={15}/><T th={view === "overdue" ? "ดูงานทั้งหมด" : "ดูเฉพาะงานเกินกำหนด"} en={view === "overdue" ? "View all tasks" : "Overdue only"}/></Link>}
    </section>

    <div className="task-command-metrics">
      <div className="task-command-metric"><ListChecks size={19}/><span><small><T th="งานที่เปิดอยู่" en="Open queue"/></small><strong>{metrics.open}</strong></span></div>
      <div className="task-command-metric danger"><AlertTriangle size={19}/><span><small><T th="งานเกินกำหนด" en="Overdue"/></small><strong>{metrics.overdue}</strong></span></div>
      <div className="task-command-metric success"><CheckCircle2 size={19}/><span><small><T th="เสร็จวันนี้" en="Done today"/></small><strong>{metrics.completedToday}</strong></span></div>
      <div className="task-command-metric denim"><Gauge size={19}/><span><small><T th="เสร็จใน 7 วัน" en="Done in 7 days"/></small><strong>{metrics.completed7Days}</strong></span><b>{(metrics.completed7Days / 7).toFixed(1)} <T th="งาน/วัน" en="per day"/></b></div>
    </div>

    <nav className="task-view-tabs" aria-label="Task views">
      {[
        ["", "งานทั้งหมด", "All tasks", dashboard.tasks.length],
        ["overdue", "เกินกำหนด", "Overdue", overdueTasks.length],
        ["today", "กำหนดวันนี้", "Due today", dashboard.tasks.filter((task) => task.dueDate?.slice(0, 10) === today).length],
        ["priority", "เร่งด่วน/สูง", "Urgent / high", dashboard.tasks.filter((task) => ["Urgent", "High"].includes(task.sample.priority)).length],
      ].map(([value, th, en, count]) => <Link key={String(value)} className={view === value ? "active" : ""} href={taskHref({ role: roleFilter, view: String(value) })}><T th={String(th)} en={String(en)}/><b>{count}</b></Link>)}
    </nav>

    <section className="task-work-list">
      {pageTasks.map((task) => {
        const sample = sampleToPrototype(task.sample);
        const requirement = taskRequirement(task);
        const days = overdueDays(task.dueDate);
        return <article className={`task-card work-task-card ${task.overdue ? "is-overdue" : ""}`} key={task.id}>
          <div className="task-card-main">
            <div className="task-card-flags">
              {task.overdue && <span className="task-overdue-badge"><AlertTriangle size={13}/><T th={`เกินกำหนด ${days} วัน`} en={`${days} days overdue`}/></span>}
              <span className={`badge b-${task.sample.priority.toLowerCase()}`}><T th={priorityText(task.sample.priority)} en={task.sample.priority}/></span>
              <span className={`badge ${statusBadgeClass(task.sample.status)}`}><T th={sample.statusText} en={statusTextEn(task.sample.status)}/></span>
            </div>
            <div className="task-identity-grid">
              <div><small><T th="รหัสตัวอย่าง" en="Sample ID"/></small><Link href={`/samples/${task.sample.id}`} className="task-sample-code">{sample.id}</Link></div>
              <div><small><T th="รหัสโมเดล" en="Model ID"/></small><b>{sample.modelId}</b></div>
              <div><small><T th="ชื่อผ้า" en="Fabric name"/></small><b title={sample.fabricName}>{sample.fabricName}</b></div>
              <div><small><T th="รหัสบล็อค" en="Block ID"/></small><b title={sample.blockId}>{sample.blockId}</b></div>
            </div>
            <div className="task-requirement-box">
              <span><Wrench size={15}/><T th="สิ่งที่ต้องทำ / แก้" en="Required action / correction"/></span>
              <strong><T th={requirement.th} en={requirement.en}/></strong>
              {sample.note && <p><b><T th="หมายเหตุ:" en="Note:"/></b> <span title={sample.note}>{sample.note}</span></p>}
            </div>
          </div>
          <aside className="task-card-side">
            <div className={`task-due-box ${task.overdue ? "overdue" : ""}`}><CalendarClock size={17}/><span><small><T th="กำหนดส่ง" en="Due date"/></small><b>{formatShortDate(task.dueDate)}</b></span></div>
            <div className="task-owner-box"><small><T th="หน้าที่รับผิดชอบ" en="Responsibility"/></small><b><T th={stageOwner(task.sample.status)} en={stageOwnerEn(task.sample.status)}/></b>{sample.statusDetail && <span title={sample.statusDetail}>{sample.statusDetail}</span>}</div>
            <div className="task-card-actions"><Link className="btn primary small" href={`/samples/${task.sample.id}?tab=timeline#current-stage`}><Check size={13}/> <T th="เริ่มงาน" en="Start work"/></Link><Link className="btn small" href={`/samples/${task.sample.id}`}><Eye size={13}/> <T th="ดูรายละเอียด" en="View"/></Link></div>
          </aside>
        </article>;
      })}
      {!filteredTasks.length && <div className="table-panel"><EmptyState title={<T th="ไม่พบงานในมุมมองนี้" en="No tasks in this view"/>} text={<T th="ลองเลือกงานทั้งหมด หรือเปลี่ยนหน้าที่ที่ต้องการดู" en="Try All tasks or choose another responsibility."/>}/></div>}
      {filteredTasks.length > TASKS_PER_PAGE && <div className="pagination task-pagination">
        <span>{visibleStart}-{visibleEnd} / {filteredTasks.length} <T th="งาน" en="tasks"/></span>
        <nav aria-label="My Tasks pagination">
          <Link className={`page-link ${currentPage <= 1 ? "disabled" : ""}`} href={taskHref({ page: Math.max(1, currentPage - 1), role: roleFilter, view })} aria-disabled={currentPage <= 1}><T th="ก่อนหน้า" en="Previous"/></Link>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <Link key={page} className={`page-link number ${page === currentPage ? "current" : ""}`} href={taskHref({ page, role: roleFilter, view })} aria-current={page === currentPage ? "page" : undefined}>{page}</Link>)}
          <Link className={`page-link ${currentPage >= totalPages ? "disabled" : ""}`} href={taskHref({ page: Math.min(totalPages, currentPage + 1), role: roleFilter, view })} aria-disabled={currentPage >= totalPages}><T th="ถัดไป" en="Next"/></Link>
        </nav>
      </div>}
    </section>
  </section>;
}
