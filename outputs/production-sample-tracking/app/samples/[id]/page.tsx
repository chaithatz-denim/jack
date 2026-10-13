import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, File, FilePlus, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { completeCurrentStageAction, updateSampleAction, updateStatusAction, uploadFilesAction } from "@/lib/supabase/actions";
import { FileRow, getSampleBundle, workflowStatuses } from "@/lib/supabase/data";
import { canWorkOnStage, requireUser } from "@/lib/supabase/auth";
import { clipText, formatUpdated, priorityBadgeClass, priorityText, priorityTextEn, sampleToPrototype, stageOwner, stageOwnerEn, statusBadgeClass, statusText, statusTextEn, timelineText, timelineTextEn } from "@/lib/supabase/mappers";
import { SizeSpecPanel } from "@/components/SizeSpecPanel";
import { EmbellishmentFields } from "@/components/EmbellishmentFields";
import { LocalizedSelect } from "@/components/LocalizedSelect";
import { SampleEditModal } from "@/components/SampleEditModal";
import { TimelineSubmitConfirm } from "@/components/ConfirmSubmitButton";
import type { SamplePriority, SampleStatus } from "@/lib/supabase/database.types";
import type { SampleRow, TimelineRow } from "@/lib/supabase/data";
import { FILE_INPUT_ACCEPT } from "@/lib/upload-policy";

export const dynamic = "force-dynamic";

type DetailTab = "overview" | "timeline" | "size-spec" | "files";

const tabs: Array<[DetailTab, string, string]> = [
  ["overview", "ภาพรวม", "Overview"],
  ["timeline", "ไทม์ไลน์การผลิต", "Production timeline"],
  ["size-spec", "ตารางไซส์สเปก", "Size spec"],
  ["files", "ไฟล์", "Files"],
];

const qcOptions = [
  { value: "แก้ไข Spec", th: "แก้ไข Spec", en: "Spec revision" },
  { value: "PPS", th: "PPS", en: "PPS" },
  { value: "ยกเลิก", th: "ยกเลิก", en: "Cancel" },
  { value: "เกรดไซส์", th: "เกรดไซส์", en: "Size grading" },
];
const statusOptions: SampleStatus[] = ["Pattern", "Cutting", "Embellishment", "Sewing", "Washing", "QC", "Complete", "Cancelled"];
const priorityOptions: SamplePriority[] = ["Low", "Normal", "High", "Urgent"];
const fileStageOptions: Array<[SampleStatus | "General", string, string]> = [
  ["Pattern", "สร้างแพทเทิร์น", "Pattern"],
  ["Cutting", "ตัดงาน", "Cutting"],
  ["Embellishment", "ปัก/สกรีน", "Embroidery / Screen"],
  ["Sewing", "เย็บ", "Sewing"],
  ["Washing", "ฟอก", "Washing"],
  ["QC", "QC", "QC"],
  ["General", "ทั่วไป", "General"],
];

const Field = ({ label, children }: { label: ReactNode; children: ReactNode }) => <label className="field"><span>{label}</span>{children}</label>;

function T({ th, en }: { th: string; en: string }) {
  return <><span data-th>{th}</span><span data-en>{en}</span></>;
}

function fabricSupplierFromTimeline(timeline: TimelineRow[]) {
  return timeline.find((item) => item.action === "FABRIC_SUPPLIER")?.note || "—";
}

export default async function SampleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string; upload?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const activeTab = tabs.some(([key]) => key === query?.tab) ? query?.tab as DetailTab : "overview";
  const user = await requireUser();
  const bundle = await getSampleBundle(id);
  if (!bundle.sample) notFound();
  const sample = bundle.sample;
  const ui = sampleToPrototype(sample);
  const isPrototypePreview = process.env.NODE_ENV === "development" && process.env.LOCAL_PROTOTYPE_PREVIEW === "true";
  const canUpdate = canWorkOnStage(user.role, sample.status);
  const isAdmin = user.role === "Admin";
  const canEdit = isAdmin || user.role === "Mer";
  const canEditSpecs = isPrototypePreview || isAdmin || user.role === "Mer";
  const canEditBlockTechnical = isPrototypePreview || isAdmin || user.role === "Pattern";

  return <section className="page active" id="detailPage">
    <Link className="back" href="/samples"><ArrowLeft size={14}/> <T th="กลับไปหน้ารายการตัวอย่าง" en="Back to samples"/></Link>

    <div className="detail-head">
      <div className="detail-title">
        <span className="eyebrow">{ui.id} · {ui.fabricName}</span>
        <h1>{ui.modelId}</h1>
        <p className="muted"><T th="ขั้นตอนปัจจุบัน" en="Current stage"/>: <T th={ui.statusText} en={statusTextEn(sample.status)}/></p>
      </div>
      <div className="actions">
        {canEdit && <SampleEditModal><EditSampleForm sample={sample} isAdmin={isAdmin} fabricSupplier={fabricSupplierFromTimeline(bundle.timeline)}/></SampleEditModal>}
        {canUpdate && <Link className="btn primary" href={`/samples/${sample.id}?tab=timeline#current-stage`}><T th="ขั้นตอนปัจจุบัน" en="Current stage"/></Link>}
      </div>
    </div>

    <nav className="tabs" aria-label="Sample details">
      {tabs.map(([key, labelTh, labelEn]) => <Link key={key} className={activeTab === key ? "active" : ""} href={`/samples/${sample.id}?tab=${key}`}><T th={labelTh} en={labelEn}/></Link>)}
    </nav>

    {activeTab === "overview" && <section className="grid-main detail-tab-page">
      <div><Overview sample={sample} fabricSupplier={fabricSupplierFromTimeline(bundle.timeline)} blockTechnical={bundle.blockTechnical}/></div>
      <aside><ProductionStatus sample={sample}/><NotePanel note={ui.note}/></aside>
    </section>}
    {activeTab === "timeline" && <section className="detail-tab-page"><TimelinePanel sample={sample} timeline={bundle.timeline} canUpdate={canUpdate} isAdmin={isAdmin}/></section>}
    {activeTab === "size-spec" && <section className="detail-tab-page"><SizeSpecPanel sampleId={sample.id} modelId={sample.model_id ?? ""} blockId={sample.block_id ?? ""} sizeMode={sample.size_mode} specs={bundle.specs} blockTechnical={bundle.blockTechnical} canEditSpecs={canEditSpecs} canEditBlockTechnical={canEditBlockTechnical} isPrototypePreview={isPrototypePreview}/></section>}
    {activeTab === "files" && <section className="detail-tab-page"><FilesPanel sample={sample} files={bundle.files} uploadResult={query?.upload}/></section>}
  </section>;
}

function NotePanel({ note }: { note: string }) {
  return <section className="panel" style={{ marginTop: 14 }}>
    <div className="panel-head"><h2><T th="หมายเหตุ" en="Note"/></h2></div>
    <div className="note-box">{note.trim() ? clipText(note, 180) : ""}</div>
  </section>;
}

function ProductionStatus({ sample }: { sample: SampleRow }) {
  const ui = sampleToPrototype(sample);
  const statusClass = sample.status === "Complete" ? "complete" : sample.status === "Cancelled" ? "cancelled" : "";
  return <section className={`production-status-card ${statusClass}`}>
    <div className="production-status-main">
      <div>
        <span className="eyebrow"><T th="สถานะการผลิต" en="Production status"/></span>
        <div className="production-status-title"><T th={ui.statusText} en={statusTextEn(sample.status)}/></div>
        <div className="production-status-sub"><T th={stageOwner(sample.status)} en={stageOwnerEn(sample.status)}/> · <T th={ui.currentStage} en={statusTextEn(sample.status)}/></div>
      </div>
      <div><span className={`badge ${statusBadgeClass(sample.status)}`}>{ui.progress}%</span></div>
    </div>
    <div className="production-bar"><span style={{ width: `${ui.progress}%` }}/></div>
    <div className="production-status-grid">
      <div><label><T th="ผู้รับผิดชอบ" en="Owner"/></label><b><T th={stageOwner(sample.status)} en={stageOwnerEn(sample.status)}/></b></div>
      <div><label><T th="วันกำหนดส่ง" en="Due date"/></label><b>{ui.dueDate}</b></div>
      <div><label><T th="อัพเดทล่าสุด" en="Last updated"/></label><b>{ui.updated}</b></div>
    </div>
  </section>;
}

function Overview({ sample, fabricSupplier, blockTechnical }: { sample: SampleRow; fabricSupplier: string; blockTechnical: { fabricShrinkage: string; fabricConsumption: string; note: string } }) {
  const ui = sampleToPrototype(sample);
  return <section id="overview" className="panel">
    <div className="panel-head"><h2><T th="รายละเอียดตัวอย่างสินค้า" en="Product sample detail"/></h2><span className={`badge ${priorityBadgeClass(sample.priority)}`}><T th={priorityText(sample.priority)} en={priorityTextEn(sample.priority)}/></span></div>
    <div className="profile-card no-gallery">
      <div className="summary">
        <div><label><T th="รหัสตัวอย่าง" en="Sample ID"/></label><b>{ui.id}</b></div>
        <div><label><T th="ชื่อผ้า" en="Fabric name"/></label><b>{ui.fabricName}</b></div>
        <div><label><T th="ทรง / การตัด" en="Cutting"/></label><b>{ui.cutting}</b></div>
        <div><label><T th="สีด้าย" en="Thread color"/></label><b>{ui.threadColor}</b></div>
        <div><label><T th="ซิป / กระดุม" en="Fly"/></label><b>{ui.fly}</b></div>
        <div><label><T th="งานฟอก" en="Washing"/></label><b>{ui.washing}</b></div>
        <div><label><T th="สถานะ" en="Status"/></label><b><T th={ui.statusText} en={statusTextEn(sample.status)}/></b></div>
        <div><label><T th="ความเร่งด่วน" en="Priority"/></label><b><T th={priorityText(ui.priority)} en={priorityTextEn(ui.priority)}/></b></div>
        <div><label><T th="รหัสบล็อค" en="Block ID"/></label><b>{ui.blockId}</b></div>
        <div><label><T th="ค่าหดตัวของผ้า" en="Fabric shrinkage"/></label><b>{blockTechnical.fabricShrinkage || "—"}</b></div>
        <div><label><T th="กินผ้า" en="Fabric consumption"/></label><b>{blockTechnical.fabricConsumption || "—"}</b></div>
        <div><label><T th="ร้านผ้า" en="Fabric supplier"/></label><b>{fabricSupplier}</b></div>
        <div><label><T th="ไซส์" en="Size"/></label><b>{ui.sampleSize} ({ui.sizeMode})</b></div>
        <div className="block-note-summary"><label><T th="หมายเหตุประจำรหัสบล็อค" en="Block note"/></label><b>{blockTechnical.note || "—"}</b></div>
      </div>
    </div>
  </section>;
}

function EditSampleForm({ sample, isAdmin, fabricSupplier }: { sample: SampleRow; isAdmin: boolean; fabricSupplier: string }) {
  return <form id="edit-sample" action={updateSampleAction.bind(null, sample.id)} className="modal sample-edit-modal" role="dialog" aria-modal="true" aria-labelledby="sample-edit-title">
    <div className="modal-head sample-edit-modal-head">
      <div><span className="eyebrow">Sample Detail</span><h2 id="sample-edit-title"><T th="แก้ไขข้อมูลตัวอย่าง" en="Edit sample data"/></h2></div>
      <button type="button" data-sample-edit-close aria-label="Close">×</button>
    </div>
    <div className="modal-body sample-edit-modal-body">
      <div className="form-grid sample-edit-form-grid">
        <Field label={<T th="ชื่อผ้า" en="Fabric name"/>}><input name="fabric_name" required defaultValue={sample.fabric_name}/></Field>
        <Field label={<T th="รหัสบล็อค" en="Block ID"/>}><input name="block_id" defaultValue={sample.block_id ?? ""}/></Field>
        <Field label={<T th="ทรง / การตัด" en="Cutting"/>}><input name="cutting" defaultValue={sample.cutting ?? ""}/></Field>
        <Field label={<T th="รหัสโมเดล" en="Model ID"/>}><input name="model_id" defaultValue={sample.model_id ?? ""}/></Field>
        <Field label={<T th="ร้านผ้า" en="Fabric supplier"/>}><input name="fabric_supplier" defaultValue={fabricSupplier === "—" ? "" : fabricSupplier}/></Field>
        <Field label={<T th="สีด้าย" en="Thread color"/>}><input name="thread_color" defaultValue={sample.thread_color ?? ""}/></Field>
        <Field label={<T th="ซิป / กระดุม" en="Fly"/>}><LocalizedSelect className="fly-select" name="fly" defaultValue={sample.fly ?? "Zip"} options={[{ value: "Zip", th: "Zip", en: "Zip" }, { value: "Button", th: "Button", en: "Button" }]}/></Field>
        <Field label={<T th="งานฟอก" en="Washing"/>}><input name="washing" defaultValue={sample.washing ?? ""}/></Field>
        <Field label={<T th="ไซส์" en="Size"/>}><input name="sample_size" defaultValue={sample.sample_size ?? ""}/></Field>
        {isAdmin && <Field label={<T th="วันกำหนดส่ง" en="Due date"/>}><input type="date" name="due_date" defaultValue={sample.due_date ?? ""}/></Field>}
        {isAdmin && <Field label={<T th="ความเร่งด่วน" en="Priority"/>}><LocalizedSelect name="priority" defaultValue={sample.priority} options={priorityOptions.map((x) => ({ value: x, th: priorityText(x), en: priorityTextEn(x) }))}/></Field>}
        <Field label={<T th="หมายเหตุ" en="Note"/>}><textarea name="note" rows={3} defaultValue={sample.note ?? ""}/></Field>
      </div>
    </div>
    <div className="modal-foot sample-edit-modal-foot">
      <button className="btn" type="button" data-sample-edit-close><T th="ยกเลิก" en="Cancel"/></button>
      <button className="btn primary" type="submit"><Save size={14}/> <T th="บันทึกการแก้ไขตัวอย่าง" en="Save sample changes"/></button>
    </div>
  </form>;
}

function productionSuffix(timeline: TimelineRow[]) {
  const latestQc = timeline.find((item) => item.action === "QC_REVISION_SPEC" || item.action === "QC_PPS" || item.action === "QC_SIZE_GRADE");
  if (!latestQc) return "";
  if (latestQc.action === "QC_REVISION_SPEC") return "แก้ไข Spec";
  if (latestQc.action === "QC_PPS") return "PPS";
  if (latestQc.action === "QC_SIZE_GRADE") return "เกรดไซส์";
  return "";
}

function stageDisplayName(status: SampleStatus, suffix: string) {
  if (!suffix) return statusText(status);
  if (status === "Pattern" && suffix === "เกรดไซส์") return "เกรดไซส์ / Pattern Approve";
  return `${statusText(status)} ${suffix}`;
}

function stageDisplayNameEn(status: SampleStatus, suffix: string) {
  if (!suffix) return statusTextEn(status);
  if (status === "Pattern" && suffix === "เกรดไซส์") return "Size grading / Pattern approve";
  const suffixEn = suffix === "แก้ไข Spec" ? "Spec revision" : suffix === "เกรดไซส์" ? "Size grading" : suffix;
  return `${statusTextEn(status)} ${suffixEn}`;
}

function TimelinePanel({ sample, timeline, canUpdate, isAdmin }: { sample: SampleRow; timeline: TimelineRow[]; canUpdate: boolean; isAdmin: boolean }) {
  const currentIndex = workflowStatuses.indexOf(sample.status);
  const suffix = sample.workflow_mode ?? productionSuffix(timeline);
  const visibleTimeline = timeline.filter((item) => item.action !== "SEED_SAMPLE" && item.action !== "BLOCK_TECHNICAL_DATA");

  return <section id="timeline">
    <div className="page-head" style={{ marginBottom: 10 }}>
      <div><span className="eyebrow">Tracking Timeline</span><h1 style={{ fontSize: "1.45em" }}><T th="ไทม์ไลน์การผลิต" en="Production timeline"/></h1><p><T th="แต่ละสิทธิ์อัพเดทได้เฉพาะขั้นตอนที่ตัวเองรับผิดชอบ" en="Each role can update only its responsible production stage."/></p></div>
    </div>
    <div className="timeline">
      {workflowStatuses.map((status, index) => {
        const isDone = sample.status === "Complete" || (currentIndex > -1 && currentIndex > index);
        const isActive = sample.status === status;
        const stateClass = isDone ? "done" : isActive ? "active open" : "pending";
        return <article id={isActive ? "current-stage" : undefined} className={`stage ${stateClass}`} key={status}>
          <div className="stage-summary">
            <div className="stage-no">{index + 1}</div>
            <div><b><T th={stageDisplayName(status, suffix)} en={stageDisplayNameEn(status, suffix)}/></b><small><T th="ผู้รับผิดชอบ" en="Owner"/>: <T th={stageOwner(status)} en={stageOwnerEn(status)}/> · <T th="สถานะ" en="Status"/>: {isDone ? <T th="เสร็จแล้ว" en="Done"/> : isActive ? <T th="กำลังทำ" en="Active"/> : <T th="รอดำเนินการ" en="Waiting"/>}</small></div>
            <div><span className={`badge ${isDone ? "b-done" : isActive ? "b-active" : "b-skip"}`}>{isDone ? "DONE" : isActive ? "ACTIVE" : "WAIT"}</span></div>
          </div>
          {isActive && <div className="stage-body">
            {canUpdate && <form action={completeCurrentStageAction.bind(null, sample.id)} className="timeline-complete-form">
              <TimelineSubmitConfirm messageTh="ยืนยันทำเสร็จ / อัพเดทงานขั้นตอนนี้?" messageEn="Confirm complete / update this stage?"/>
              {status === "Pattern" && <Field label={<T th="Block ID ใหม่/ที่แก้ไข" en="New / revised Block ID"/>}><input name="block_id_update" required placeholder={`Current: ${sample.block_id || "—"} / enter new Block ID`}/></Field>}
              {status === "Embellishment" && <EmbellishmentFields/>}
              {status === "Sewing" && <Field label={<T th="ชื่อช่างเย็บ" en="Sewing operator"/>}><input name="sewing_operator" required placeholder="Sewing operator name"/></Field>}
              {status === "Washing" && <Field label={<T th="โรงฟอก" en="Washing factory"/>}><input name="washing_factory" required defaultValue={sample.washing_factory ?? ""} placeholder="Washing factory name"/></Field>}
              {status === "QC" && <label className="field qc-outcome-field"><span><T th="ผล QC" en="QC result"/></span><LocalizedSelect className="qc-outcome-select" name="qc_outcome" required defaultValue="เกรดไซส์" options={qcOptions}/></label>}
              <Field label={<T th="หมายเหตุ" en="Note"/>}><input name="note" placeholder="Update note"/></Field>
              <button className="btn primary small" type="submit"><Check size={13}/> <T th="ทำเสร็จ / อัพเดทงาน" en="Complete / update work"/></button>
            </form>}
            {isAdmin && <details className="admin-override">
              <summary>Admin Update Status</summary>
              <form action={updateStatusAction.bind(null, sample.id)} className="inline-form status-form">
                <LocalizedSelect name="status" defaultValue={sample.status} options={statusOptions.map((x) => ({ value: x, th: statusText(x), en: statusTextEn(x) }))}/>
                <input name="note" placeholder="Update note"/>
                <button className="btn small" type="submit">Update Status</button>
              </form>
            </details>}
          </div>}
        </article>;
      })}
      {visibleTimeline.map((item) => <div className="log" key={item.id}><b><T th={timelineText(item)} en={timelineTextEn(item)}/></b><small>{item.note || "—"} · {formatUpdated(item.created_at)}</small></div>)}
    </div>
  </section>;
}

function FilesPanel({ sample, files, uploadResult }: { sample: SampleRow; files: FileRow[]; uploadResult?: string }) {
  const uploadMessages: Record<string, [string, string, "info" | "danger"]> = {
    success: ["อัพโหลดไฟล์สำเร็จ", "Files uploaded successfully.", "info"],
    "no-file": ["กรุณาเลือกไฟล์ก่อนอัพโหลด", "Choose at least one file before uploading.", "danger"],
    unsupported: ["ไฟล์ชนิดนี้ไม่รองรับ กรุณาเลือก PDF, รูปภาพ, Word, Excel, CSV, DXF, AI หรือ ZIP", "Unsupported file type. Choose a PDF, image, Word, Excel, CSV, DXF, AI, or ZIP file.", "danger"],
    "too-large": ["ไฟล์มีขนาดใหญ่เกินกำหนด (รูปภาพไม่เกิน 10 MB และเอกสารไม่เกิน 50 MB)", "The file is too large (images: 10 MB; documents: 50 MB).", "danger"],
    failed: ["อัพโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "Upload failed. Please try again.", "danger"],
  };
  const uploadMessage = uploadResult ? uploadMessages[uploadResult] : null;
  return <section id="files" className="panel">
    <div className="panel-head"><h2><T th="ไฟล์" en="Files"/></h2><p><T th="ไฟล์ถูกเก็บใน Supabase Storage bucket" en="Files are stored in the Supabase Storage bucket."/></p></div>
    {uploadMessage && <div className={`alert ${uploadMessage[2]}`} role="status"><b><T th={uploadMessage[0]} en={uploadMessage[1]}/></b></div>}
    <form action={uploadFilesAction.bind(null, sample.id)} encType="multipart/form-data" className="stage-actions">
      <LocalizedSelect className="select" name="stage" defaultValue={sample.status} options={fileStageOptions.map(([value, th, en]) => ({ value, th, en }))}/>
      <input type="file" name="files" accept={FILE_INPUT_ACCEPT} multiple/>
      <button className="btn primary small" type="submit"><FilePlus size={14}/> <T th="อัพโหลดงาน" en="Upload work"/></button>
    </form>
    <div>{files.map((file) => <div className="log" key={file.id}>
      <b><File size={14}/> {file.file_name}</b>
      <small>{file.stage || file.bucket_id} · {Math.round((file.file_size ?? 0) / 1024)} KB · {formatUpdated(file.created_at)} {file.signedUrl && <a href={file.signedUrl} target="_blank" rel="noreferrer">Download</a>}</small>
    </div>)}</div>
    {!files.length && <div className="empty"><T th="ยังไม่มีไฟล์" en="No files yet"/></div>}
  </section>;
}
