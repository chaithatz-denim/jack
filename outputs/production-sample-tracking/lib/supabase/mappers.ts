import type { SamplePriority, SampleStatus } from "./database.types";
import type { SampleRow, TimelineRow, WorkflowMode } from "./data";
import { workflowModeFromCurrentStage } from "./data";
import { formatDateTimeBangkok, formatShortDateBangkok } from "../time";

export type PrototypeSample = {
  id: string;
  rowId: string;
  modelId: string;
  blockId: string;
  fabricName: string;
  cutting: string;
  startDate: string;
  dueDate: string;
  status: SampleStatus;
  statusText: string;
  currentStage: string;
  priority: SamplePriority;
  note: string;
  updated: string;
  progress: number;
  sizeMode: string;
  sampleSize: string;
  threadColor: string;
  fly: string;
  washing: string;
  workflowMode: WorkflowMode | null;
  statusDetail: string;
};

export const emptyText = "—";

export function clipText(value: string | null | undefined, max = 42) {
  const text = value?.trim() || emptyText;
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

export function formatShortDate(date: string | null | undefined) {
  return formatShortDateBangkok(date, emptyText);
}

export function formatUpdated(value: string | null | undefined) {
  return formatDateTimeBangkok(value, emptyText);
}

export function statusText(status: SampleStatus) {
  const map: Record<SampleStatus, string> = {
    Pattern: "สร้างแพทเทิร์น",
    Cutting: "ตัดงาน",
    Embellishment: "ปัก/สกรีน",
    Sewing: "เย็บ",
    Washing: "ฟอก",
    QC: "QC",
    Complete: "Complete",
    Cancelled: "ยกเลิก",
  };
  return map[status] ?? status;
}

export function statusTextEn(status: SampleStatus) {
  const map: Record<SampleStatus, string> = {
    Pattern: "Pattern",
    Cutting: "Cutting",
    Embellishment: "Embroidery / Screen",
    Sewing: "Sewing",
    Washing: "Washing",
    QC: "QC",
    Complete: "Complete",
    Cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

export function workflowModeTextEn(mode: WorkflowMode) {
  const map: Record<WorkflowMode, string> = {
    "แก้ไข Spec": "Spec revision",
    PPS: "PPS",
    "เกรดไซส์": "Size grading",
  };
  return map[mode] ?? mode;
}

function workflowModeForSample(sample: SampleRow) {
  return sample.workflow_mode ?? workflowModeFromCurrentStage(sample.current_stage);
}

export function statusTextForSample(sample: SampleRow) {
  const mode = workflowModeForSample(sample);
  const base = statusText(sample.status);
  if (!mode || ["Complete", "Cancelled"].includes(sample.status)) return base;
  return `${base} ${mode}`;
}

export function statusTextEnForSample(sample: SampleRow) {
  const mode = workflowModeForSample(sample);
  const base = statusTextEn(sample.status);
  if (!mode || ["Complete", "Cancelled"].includes(sample.status)) return base;
  return `${base} ${workflowModeTextEn(mode)}`;
}

export function currentStageTextForSample(sample: SampleRow) {
  return statusTextForSample(sample);
}

export function stageOwner(status: SampleStatus) {
  if (status === "Pattern") return "ช่าง Pattern";
  if (status === "Cutting") return "ช่างตัด";
  if (["Embellishment", "Sewing", "Washing", "QC"].includes(status)) return "Mer";
  return "Admin";
}

export function stageOwnerEn(status: SampleStatus) {
  if (status === "Pattern") return "Pattern maker";
  if (status === "Cutting") return "Cutting";
  if (["Embellishment", "Sewing", "Washing", "QC"].includes(status)) return "Mer";
  return "Admin";
}

export function priorityText(priority: SamplePriority) {
  const map: Record<SamplePriority, string> = {
    Low: "ต่ำ",
    Normal: "ปกติ",
    High: "สูง",
    Urgent: "เร่งด่วน",
  };
  return map[priority] ?? priority;
}

export function priorityTextEn(priority: SamplePriority) {
  const map: Record<SamplePriority, string> = {
    Low: "Low",
    Normal: "Normal",
    High: "High",
    Urgent: "Urgent",
  };
  return map[priority] ?? priority;
}

export function priorityBadgeClass(priority: SamplePriority) {
  if (priority === "Urgent") return "b-urgent";
  if (priority === "High") return "b-high";
  if (priority === "Low") return "b-low";
  return "b-normal";
}

export function statusBadgeClass(status: SampleStatus) {
  if (status === "Complete") return "b-done";
  if (status === "Cancelled") return "b-cancelled";
  if (status === "Pattern") return "b-new";
  return "b-active";
}

export function progressForPrototype(status: SampleStatus) {
  const flow: SampleStatus[] = ["Pattern", "Cutting", "Embellishment", "Sewing", "Washing", "QC"];
  if (status === "Complete") return 100;
  if (status === "Cancelled") return 0;
  const index = flow.indexOf(status);
  return index < 0 ? 0 : Math.round(((index + 1) / flow.length) * 95);
}

function isBrokenSeedText(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return !text || /\?{2,}|เธ|เน€|โ€|ย[ฑท]/.test(text);
}

function defaultThaiNote(sample: SampleRow) {
  const mode = workflowModeForSample(sample);
  if (sample.status === "Pattern" && mode === "PPS") return "ขึ้น PPS / รอช่างแพทเทิร์น";
  if (sample.status === "Pattern" && mode === "แก้ไข Spec") return "แก้ไข Spec / รอช่างแพทเทิร์น";
  if (sample.status === "Pattern" && mode === "เกรดไซส์") return "เกรดไซส์ / รอช่างแพทเทิร์น";
  const map: Record<SampleStatus, string> = {
    Pattern: "รอสร้างแพทเทิร์น",
    Cutting: "รอตัดงาน",
    Embellishment: "รอปัก/สกรีน",
    Sewing: "รอเย็บ",
    Washing: "รอฟอก",
    QC: "รอตรวจ QC",
    Complete: "งานตัวอย่างเสร็จสมบูรณ์",
    Cancelled: "ยกเลิกรายการตัวอย่าง",
  };
  return map[sample.status] ?? "ติดตามงานตัวอย่าง";
}

export function noteTextForSample(sample: SampleRow) {
  const note = sample.note?.trim() ?? "";
  if (isBrokenSeedText(note)) return "";
  const cleanNote = note
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[(?:Admin|Pattern|Cutting|Mer|Viewer)(?:\s*\/[^\]]+)?\]\s*/, ""))
    .join("\n")
    .trim();

  const normalized = cleanNote.toLowerCase();
  if (normalized.includes("new sample created")) return "";
  if (normalized.includes("jacket sample")) return "ตัวอย่างแจ็คเก็ต";
  if (normalized.includes("classic fit sample")) return "ตัวอย่างทรง Classic fit";
  if (normalized.includes("test fabric")) return "เทสผ้า";

  return cleanNote;
}

export function sampleToPrototype(sample: SampleRow): PrototypeSample {
  const workflowMode = workflowModeForSample(sample);
  return {
    id: sample.sample_code,
    rowId: sample.id,
    modelId: sample.model_id || emptyText,
    blockId: sample.block_id || emptyText,
    fabricName: sample.fabric_name || emptyText,
    cutting: sample.cutting || emptyText,
    startDate: formatShortDate(sample.start_date),
    dueDate: formatShortDate(sample.due_date),
    status: sample.status,
    statusText: statusTextForSample(sample),
    currentStage: currentStageTextForSample(sample),
    priority: sample.priority,
    note: noteTextForSample(sample),
    updated: formatUpdated(sample.updated_at),
    progress: progressForPrototype(sample.status),
    sizeMode: sample.size_mode || "numeric",
    sampleSize: sample.sample_size || emptyText,
    threadColor: sample.thread_color || emptyText,
    fly: sample.fly || emptyText,
    washing: sample.washing || emptyText,
    workflowMode,
    statusDetail: sample.status_detail || "",
  };
}

export function timelineText(item: TimelineRow) {
  const actionMap: Record<string, string> = {
    CREATE_SAMPLE: "สร้างตัวอย่างใหม่",
    FABRIC_SUPPLIER: "ระบุร้านผ้า",
    EDIT_SAMPLE: "แก้ไขตัวอย่าง",
    UPDATE_STATUS: "อัพเดทสถานะ",
    COMPLETE_STAGE: "ทำเสร็จ / อัพเดทงาน",
    COMPLETE_SIZE_GRADE: "เกรดไซส์เสร็จสมบูรณ์",
    SOFT_DELETE_SAMPLE: "ลบรายการตัวอย่าง",
    RESTORE_SAMPLE: "กู้คืนรายการตัวอย่าง",
    SAVE_SIZE_SPEC: "บันทึก Size Spec",
    UPLOAD_FILE: "อัพโหลดงาน",
    QC_REVISION_SPEC: "QC: แก้ไข Spec",
    QC_PPS: "QC: PPS",
    QC_CANCEL: "QC: ยกเลิก",
    QC_SIZE_GRADE: "QC: เกรดไซส์",
    QC_COMPLETE: "QC: Complete",
  };
  return actionMap[item.action] || item.action;
}

export function timelineTextEn(item: TimelineRow) {
  const actionMap: Record<string, string> = {
    CREATE_SAMPLE: "Create sample",
    FABRIC_SUPPLIER: "Fabric supplier",
    EDIT_SAMPLE: "Edit sample",
    UPDATE_STATUS: "Update status",
    COMPLETE_STAGE: "Complete / update work",
    COMPLETE_SIZE_GRADE: "Complete size grading",
    SOFT_DELETE_SAMPLE: "Soft delete sample",
    RESTORE_SAMPLE: "Restore sample",
    SAVE_SIZE_SPEC: "Save size spec",
    UPLOAD_FILE: "Upload work",
    QC_REVISION_SPEC: "QC: Spec revision",
    QC_PPS: "QC: PPS",
    QC_CANCEL: "QC: Cancel",
    QC_SIZE_GRADE: "QC: Size grading",
    QC_COMPLETE: "QC: Complete",
  };
  return actionMap[item.action] || item.action;
}
