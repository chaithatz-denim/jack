import Link from "next/link";
import { Archive, Eye } from "lucide-react";
import { archiveSampleAction } from "@/lib/supabase/actions";
import { getSamples, isOverdue } from "@/lib/supabase/data";
import { canCreateSample, requireUser } from "@/lib/supabase/auth";
import { clipText, priorityBadgeClass, priorityText, priorityTextEn, sampleToPrototype, statusBadgeClass, statusText, statusTextEn, statusTextEnForSample } from "@/lib/supabase/mappers";
import { EmptyState } from "@/components/UI";
import { SampleDeleteConfirm } from "@/components/ConfirmSubmitButton";
import { SampleFilters } from "@/components/SampleFilters";
import { SampleTableScroll } from "@/components/SampleTableScroll";
import type { SamplePriority, SampleStatus } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const sampleStatusFilterOptions: SampleStatus[] = ["Pattern", "Cutting", "Embellishment", "Sewing", "Washing", "QC", "Complete", "Cancelled"];
const samplePriorityFilterOptions: SamplePriority[] = ["Low", "Normal", "High", "Urgent"];
const PAGE_SIZE = 10;

function T({ th, en }: { th: string; en: string }) {
  return <><span data-th>{th}</span><span data-en>{en}</span></>;
}

function StatusLabel({ th, en }: { th: string; en: string }) {
  return <T th={th} en={en}/>;
}

function PriorityLabel({ priority }: { priority: SamplePriority }) {
  return <T th={priorityText(priority)} en={priorityTextEn(priority)}/>;
}

function StatusDetail({ status, detail }: { status: SampleStatus; detail: string }) {
  if (!detail) return null;
  const labels: Record<SampleStatus, { th: string; en: string } | null> = {
    Pattern: null,
    Cutting: null,
    Embellishment: { th: "ร้านปัก/สกรีน", en: "Embroidery / screen shop" },
    Sewing: { th: "ช่างเย็บ", en: "Sewing operator" },
    Washing: { th: "โรงฟอก", en: "Washing factory" },
    QC: null,
    Complete: null,
    Cancelled: null,
  };
  const label = labels[status];
  if (!label) return null;
  return <small className="status-detail" title={detail}><T th={label.th} en={label.en}/>: {detail}</small>;
}

function ProgressMini({ value }: { value: number }) {
  return <div className="progress-mini" aria-label={`Progress ${value}%`}>
    <span>{value}%</span>
    <i><b style={{ width: `${value}%` }}/></i>
  </div>;
}

function normalizedPage(value: string | undefined, totalPages: number) {
  const page = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, totalPages);
}

function paginationHref(page: number, params: { q: string; status: string; priority: string; overdue: string }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.overdue) query.set("overdue", params.overdue);
  if (page > 1) query.set("page", String(page));
  const queryString = query.toString();
  return queryString ? `/samples?${queryString}` : "/samples";
}

export default async function SampleListPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; priority?: string; overdue?: string; page?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const rawQ = (params?.q ?? "").trim();
  const q = rawQ.toLowerCase();
  const status = params?.status ?? "";
  const priority = params?.priority ?? "";
  const overdueOnly = params?.overdue === "1";
  const samples = await getSamples();
  const mapped = samples.map((sample) => ({ raw: sample, ui: sampleToPrototype(sample) }));
  const rows = mapped.filter(({ raw, ui }) => {
    const haystack = [ui.id, ui.modelId, ui.blockId, ui.fabricName, ui.note, ui.statusText, ui.statusDetail].join(" ").toLowerCase();
    return (!q || haystack.includes(q)) && (!status || ui.status === status) && (!priority || ui.priority === priority) && (!overdueOnly || isOverdue(raw));
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = normalizedPage(params?.page, totalPages);
  const pageStartIndex = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const visibleStart = rows.length ? pageStartIndex + 1 : 0;
  const visibleEnd = Math.min(pageStartIndex + pageRows.length, rows.length);
  const paginationParams = { q: rawQ, status, priority, overdue: overdueOnly ? "1" : "" };
  const overdue = rows.filter(({ raw }) => isOverdue(raw));
  const activeCount = mapped.filter(({ ui }) => !["Complete", "Cancelled"].includes(ui.status)).length;
  const doneCount = mapped.filter(({ ui }) => ui.status === "Complete").length;
  const urgentCount = mapped.filter(({ ui }) => ui.priority === "Urgent").length;
  const showActions = user.role === "Admin";
  const canCreate = canCreateSample(user.role);

  return <section className="page active" id="samplesPage">
    <div className="page-head">
      <div><span className="eyebrow">Production Sample Tracking</span><h1>Samples</h1><p><T th="ติดตามงานตัวอย่างตามผู้รับผิดชอบ ขั้นตอน และวันกำหนดส่ง" en="Track production samples by owner, stage, and due date."/></p></div>
      <div className="actions">{canCreate && <Link className="btn primary" href="/samples/new">＋ <T th="สร้างตัวอย่างใหม่" en="New sample"/></Link>}</div>
    </div>

    <div className="metrics">
      <div className="metric"><label><T th="ตัวอย่างทั้งหมด" en="Total samples"/></label><strong>{mapped.length}</strong></div>
      <div className="metric amber"><label><T th="งานที่กำลังดำเนินการ" en="In progress"/></label><strong>{activeCount}</strong></div>
      <div className="metric green"><label><T th="เสร็จแล้ว" en="Complete"/></label><strong>{doneCount}</strong></div>
      <div className="metric red"><label><T th="เร่งด่วน" en="Urgent"/></label><strong>{urgentCount}</strong></div>
    </div>

    {overdue.length > 0 && <section className="alert red overdue-alert">
      <div><b><T th="แจ้งเตือนงานเกินกำหนด" en="Overdue alert"/></b><p>{overdue.map(({ ui }) => ui.id).join(", ")}</p></div>
    </section>}

    <SampleFilters
      query={rawQ}
      status={status}
      priority={priority}
      overdue={overdueOnly ? "1" : ""}
      statusOptions={[
          { value: "", th: "ทุกสถานะ", en: "All statuses" },
          ...sampleStatusFilterOptions.map((item) => ({ value: item, th: statusText(item), en: statusTextEn(item) })),
        ]}
      priorityOptions={[
          { value: "", th: "ทุกความเร่งด่วน", en: "All priorities" },
          ...samplePriorityFilterOptions.map((item) => ({ value: item, th: priorityText(item), en: priorityTextEn(item) })),
        ]}
      overdueOptions={[
          { value: "", th: "วันกำหนดส่งทั้งหมด", en: "All due dates" },
          { value: "1", th: "เฉพาะงานเกินกำหนด", en: "Overdue only" },
        ]}
    />

    <section className="table-panel">
      <SampleTableScroll>
        <table className="data">
          <thead><tr>
            <th><T th="รหัสตัวอย่าง" en="Sample ID"/></th>
            <th><T th="รหัสโมเดล" en="Model ID"/></th>
            <th><T th="ชื่อผ้า" en="Fabric name"/></th>
            <th><T th="รหัสบล็อค" en="Block ID"/></th>
            <th><T th="วันที่เริ่ม" en="Start date"/></th>
            <th><T th="วันกำหนดส่ง" en="Due date"/></th>
            <th><T th="สถานะ" en="Status"/></th>
            <th><T th="ความเร่งด่วน" en="Priority"/></th>
            <th><T th="หมายเหตุ" en="Note"/></th>
            {showActions && <th><T th="จัดการ" en="Action"/></th>}
          </tr></thead>
          <tbody>{pageRows.map(({ raw, ui }) => {
            const detailHref = `/samples/${ui.rowId}`;
            const rowOverdue = isOverdue(raw);
            return <tr key={ui.rowId} className={`clickable row-clickable ${isOverdue(raw) ? "overdue-row" : ""}`}>
              <td><Link href={detailHref} className="code row-field-link">{ui.id}</Link></td>
              <td><Link href={detailHref} className="row-field-link"><b className="table-ellipsis" title={ui.modelId}>{clipText(ui.modelId, 24)}</b><small>{ui.sampleSize}</small></Link></td>
              <td><Link href={detailHref} className="row-cell-link"><span className="table-ellipsis" title={ui.fabricName}>{clipText(ui.fabricName, 24)}</span></Link></td>
              <td><Link href={detailHref} className="row-cell-link"><span className="block-id-full" title={ui.blockId}>{ui.blockId}</span></Link></td>
              <td><Link href={detailHref} className="row-cell-link">{ui.startDate}</Link></td>
              <td className="due-date-cell"><Link href={detailHref} className="row-cell-link">{ui.dueDate}{rowOverdue && <small className="overdue-under-date"><T th="OVERDUE เกินกำหนด" en="OVERDUE"/></small>}</Link></td>
              <td className="sample-status-cell"><Link href={detailHref} className="row-cell-link"><span className={`badge ${statusBadgeClass(ui.status)}`}><StatusLabel th={ui.statusText} en={statusTextEnForSample(raw)}/></span><StatusDetail status={ui.status} detail={ui.statusDetail}/><ProgressMini value={ui.progress}/></Link></td>
              <td><Link href={detailHref} className="row-cell-link"><span className={`badge ${priorityBadgeClass(ui.priority)}`}><PriorityLabel priority={ui.priority}/></span></Link></td>
              <td className="sample-note-cell"><Link href={detailHref} className="row-cell-link">{ui.note.trim() ? <span className="sample-note-full" title={ui.note}>{ui.note}</span> : null}</Link></td>
              {showActions && <td>
                <div className="sample-actions">
                  <Link className="btn small" href={`/samples/${raw.id}`}><Eye size={13}/> <T th="ดู" en="View"/></Link>
                  <form action={archiveSampleAction.bind(null, raw.id)}>
                    <SampleDeleteConfirm sampleCode={ui.id}/>
                    <button className="btn danger small" type="submit"><Archive size={13}/> <T th="ลบ" en="Delete"/></button>
                  </form>
                </div>
              </td>}
            </tr>;
          })}</tbody>
        </table>
      </SampleTableScroll>
      {rows.length === 0 && <EmptyState title={<T th="ยังไม่มีรายการตัวอย่าง" en="No samples yet"/>} text={mapped.length ? <T th="ไม่พบรายการตัวอย่างตามตัวกรองที่เลือก" en="No samples match the selected filters."/> : <T th="กดสร้างตัวอย่างใหม่เพื่อเริ่มทดสอบจริงบน Supabase" en="Create a new sample to start live testing on Supabase."/>}/>}
      <div className="pagination sample-pagination">
        <span>{visibleStart}-{visibleEnd} / {rows.length} <T th="ตัวอย่าง" en="samples"/></span>
        <nav aria-label="Samples pagination">
          <Link className={`page-link ${currentPage <= 1 ? "disabled" : ""}`} href={paginationHref(Math.max(1, currentPage - 1), paginationParams)} aria-disabled={currentPage <= 1}>
            <T th="ก่อนหน้า" en="Previous"/>
          </Link>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <Link key={page} className={`page-link number ${page === currentPage ? "current" : ""}`} href={paginationHref(page, paginationParams)} aria-current={page === currentPage ? "page" : undefined}>{page}</Link>
          ))}
          <Link className={`page-link ${currentPage >= totalPages ? "disabled" : ""}`} href={paginationHref(Math.min(totalPages, currentPage + 1), paginationParams)} aria-disabled={currentPage >= totalPages}>
            <T th="ถัดไป" en="Next"/>
          </Link>
        </nav>
        <span className="muted"><T th="กดที่ Sample ID หรือรหัสโมเดลเพื่อเปิดรายละเอียดตัวอย่าง" en="Click Sample ID or Model ID to open sample detail."/></span>
      </div>
    </section>
  </section>;
}
