import { createSupabaseAdminClient } from "./server";
import type { Database, SamplePriority, SampleStatus } from "./database.types";
import type { AppRole, AppUser } from "./auth";
import { formatShortDateBangkok, isBeforeTodayBangkok, todayBangkokDate } from "../time";

export type WorkflowMode = "แก้ไข Spec" | "PPS" | "เกรดไซส์";
export type SampleRow = Database["public"]["Tables"]["samples"]["Row"] & { workflow_mode?: WorkflowMode | null; status_detail?: string | null };
type LegacySampleStatus = SampleStatus | "Hold";
type RawSampleRow = Omit<Database["public"]["Tables"]["samples"]["Row"], "status"> & { status: LegacySampleStatus };
export type TimelineRow = Database["public"]["Tables"]["sample_timeline"]["Row"];
export type FileRow = Database["public"]["Tables"]["sample_files"]["Row"] & { signedUrl?: string };
export type SizeSpecRow = Database["public"]["Tables"]["sample_size_specs"]["Row"];

export type BlockTechnicalData = {
  blockId: string;
  fabricShrinkage: string;
  fabricConsumption: string;
  note: string;
  updatedAt: string | null;
};

export type DailyCompletionRow = {
  id: string;
  sampleId: string;
  sampleCode: string;
  modelId: string;
  fabricName: string;
  blockId: string;
  stage: SampleStatus;
  role: AppRole;
  actorUsername: string;
  completedAt: string;
  action: string;
};

export type DailyCompletionReport = {
  date: string;
  rows: DailyCompletionRow[];
  isPrototypeData: boolean;
};

export type TaskRow = {
  id: string;
  sample: SampleRow;
  ownerRole: AppRole;
  title: string;
  dueDate: string | null;
  overdue: boolean;
};

export type RolePerformanceRow = {
  role: AppRole;
  open: number;
  overdue: number;
  completedToday: number;
  completed7Days: number;
};

export type TaskDashboard = {
  tasks: TaskRow[];
  performance: RolePerformanceRow[];
};

export const workflowStatuses: SampleStatus[] = [
  "Pattern",
  "Cutting",
  "Embellishment",
  "Sewing",
  "Washing",
  "QC",
];

export const priorityOptions: SamplePriority[] = ["Low", "Normal", "High", "Urgent"];

function normalizeSampleRow(sample: RawSampleRow): SampleRow {
  const status: SampleStatus = sample.status === "Hold" ? "Cancelled" : sample.status;
  return {
    ...sample,
    status,
    current_stage: sample.current_stage === "Hold" ? "Cancelled" : sample.current_stage,
  } as SampleRow;
}

export const sizePoints = [
  ["เอว", "วัดรอบเอวตามขอบบน", "± 0.5"],
  ["สะโพก", "วัดรอบสะโพก", "± 0.5"],
  ["เป้าหน้า", "วัดจากขอบเอวหน้าถึงเป้า", "± 0.25"],
  ["เป้าหลัง", "วัดจากขอบเอวหลังถึงเป้า", "± 0.25"],
  ["ต้นขา", "วัดรอบต้นขาใต้เป้า", "± 0.25"],
  ["เข่า", "วัดรอบเข่า", "± 0.25"],
  ["ปลายขา", "วัดรอบปลายขา", "± 0.25"],
  ["ขาใน", "วัดจากเป้าถึงปลายขา", "± 0.5"],
  ["ยาวทั้งตัว", "วัดจากขอบเอวถึงปลายขา", "± 0.5"],
  ["กระเป๋าหลัง (กว้าง)", "วัดจากริมซ้ายถึงริมขวาของกระเป๋าหลัง", "± 0.125"],
  ["กระเป๋าหลัง (ยาว)", "วัดจากขอบบนถึงปลายกระเป๋าหลัง", "± 0.125"],
] as const;

function isBrokenDisplayText(value: string | null | undefined) {
  const text = value ?? "";
  return !text.trim() || /\?{2,}|เธ|เน€|โ€|ย[ฑท]/.test(text);
}

function normalizeSizeSpecs(specs: SizeSpecRow[]) {
  return specs.map((row, index) => {
    const fallback = sizePoints[index % sizePoints.length];
    return {
      ...row,
      measurement_point: isBrokenDisplayText(row.measurement_point) ? fallback[0] : row.measurement_point,
      description: isBrokenDisplayText(row.description) ? fallback[1] : row.description,
      tolerance: isBrokenDisplayText(row.tolerance) ? fallback[2] : (row.tolerance ?? fallback[2]).replace(/^\?\s*/, "± "),
    };
  });
}

function blockTechnicalFromTimeline(timeline: TimelineRow[], blockId: string | null): BlockTechnicalData {
  const empty: BlockTechnicalData = { blockId: blockId ?? "", fabricShrinkage: "", fabricConsumption: "", note: "", updatedAt: null };
  if (!blockId) return empty;

  for (const item of timeline) {
    if (item.action !== "BLOCK_TECHNICAL_DATA" || !item.note) continue;
    try {
      const value = JSON.parse(item.note) as { block_id?: unknown; fabric_shrinkage?: unknown; fabric_consumption?: unknown; block_note?: unknown };
      if (value.block_id !== blockId) continue;
      return {
        blockId,
        fabricShrinkage: typeof value.fabric_shrinkage === "string" ? value.fabric_shrinkage : "",
        fabricConsumption: typeof value.fabric_consumption === "string" ? value.fabric_consumption : "",
        note: typeof value.block_note === "string" ? value.block_note : "",
        updatedAt: item.created_at,
      };
    } catch {
      continue;
    }
  }
  return empty;
}

const workflowModeActions = ["QC_REVISION_SPEC", "QC_PPS", "QC_SIZE_GRADE"];

export function workflowModeFromAction(action: string | null | undefined): WorkflowMode | null {
  if (action === "QC_REVISION_SPEC") return "แก้ไข Spec";
  if (action === "QC_PPS") return "PPS";
  if (action === "QC_SIZE_GRADE") return "เกรดไซส์";
  return null;
}

export function workflowModeFromCurrentStage(value: string | null | undefined): WorkflowMode | null {
  if (!value) return null;
  if (/PPS/i.test(value)) return "PPS";
  if (/Spec/i.test(value) || value.includes("แก้ไข")) return "แก้ไข Spec";
  if (value.includes("เกรด")) return "เกรดไซส์";
  return null;
}

function latestWorkflowMode(timeline: Array<Pick<TimelineRow, "action">>) {
  for (const item of timeline) {
    const mode = workflowModeFromAction(item.action);
    if (mode) return mode;
  }
  return null;
}

async function attachWorkflowModes(supabase: any, samples: SampleRow[]) {
  if (!samples.length) return samples;
  const sampleIds = samples.map((sample) => sample.id);
  const { data, error } = await supabase
    .from("sample_timeline")
    .select("sample_id,action,created_at")
    .in("sample_id", sampleIds)
    .in("action", workflowModeActions)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const modeBySample = new Map<string, WorkflowMode>();
  for (const item of (data ?? []) as Array<{ sample_id: string; action: string }>) {
    if (modeBySample.has(item.sample_id)) continue;
    const mode = workflowModeFromAction(item.action);
    if (mode) modeBySample.set(item.sample_id, mode);
  }

  return samples.map((sample) => ({
    ...sample,
    workflow_mode: modeBySample.get(sample.id) ?? workflowModeFromCurrentStage(sample.current_stage),
  }));
}

const stageDetailStatuses: SampleStatus[] = ["Embellishment", "Sewing", "Washing"];

function extractStageDetail(stage: SampleStatus, note: string | null | undefined) {
  const value = note?.trim();
  if (!value) return null;
  const patterns: Record<string, RegExp[]> = {
    Embellishment: [/ร้าน\s*:\s*([^/]+)/i, /shop\s*:\s*([^/]+)/i, /embroidery\s*\/?\s*screen\s*shop\s*:\s*([^/]+)/i],
    Sewing: [/ช่างเย็บ\s*:\s*([^/]+)/i, /sewing\s*operator\s*:\s*([^/]+)/i],
    Washing: [/โรงฟอก\s*:\s*([^/]+)/i, /washing\s*factory\s*:\s*([^/]+)/i],
  };
  for (const pattern of patterns[stage] ?? []) {
    const match = value.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

async function attachStatusDetails(supabase: any, samples: SampleRow[]) {
  if (!samples.length) return samples;
  const sampleIds = samples.map((sample) => sample.id);
  const { data, error } = await supabase
    .from("sample_timeline")
    .select("sample_id,stage,note,created_at")
    .in("sample_id", sampleIds)
    .in("stage", stageDetailStatuses)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const detailBySample = new Map<string, Partial<Record<SampleStatus, string>>>();
  for (const item of data ?? []) {
    const stage = item.stage as SampleStatus;
    if (!stageDetailStatuses.includes(stage)) continue;
    const detail = extractStageDetail(stage, item.note);
    if (!detail) continue;
    const stageDetails = detailBySample.get(item.sample_id) ?? {};
    if (!stageDetails[stage]) stageDetails[stage] = detail;
    detailBySample.set(item.sample_id, stageDetails);
  }

  return samples.map((sample) => ({
    ...sample,
    status_detail: sample.status === "Washing" && sample.washing_factory
      ? sample.washing_factory
      : detailBySample.get(sample.id)?.[sample.status] ?? null,
  }));
}

export function formatDate(date: string | null) {
  if (!date) return "—";
  return formatShortDateBangkok(date, "—");
}

export function isOverdue(sample: SampleRow) {
  if (!sample.due_date || ["Complete", "Cancelled"].includes(sample.status)) return false;
  return isBeforeTodayBangkok(sample.due_date);
}

export function progressFor(status: SampleStatus) {
  if (status === "Complete") return 100;
  if (status === "Cancelled") return 0;
  const idx = workflowStatuses.indexOf(status);
  return idx < 0 ? 0 : Math.round(((idx + 1) / workflowStatuses.length) * 95);
}

export function nextWorkflowStatus(status: SampleStatus): SampleStatus {
  if (status === "QC") return "Complete";
  const idx = workflowStatuses.indexOf(status);
  return workflowStatuses[Math.min(idx + 1, workflowStatuses.length - 1)] ?? "Pattern";
}

export function ownerRoleForStage(stage: string | null): AppRole {
  if (stage === "Pattern") return "Pattern";
  if (stage === "Cutting") return "Cutting";
  if (["Embellishment", "Sewing", "Washing", "QC"].includes(stage ?? "")) return "Mer";
  return "Admin";
}

export async function getSamples() {
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("samples")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const samples = await attachWorkflowModes(supabase, ((data ?? []) as RawSampleRow[]).map(normalizeSampleRow));
  return attachStatusDetails(supabase, samples);
}

export async function getArchivedSamples() {
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("samples")
    .select("*")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error) throw new Error(error.message);
  return attachWorkflowModes(supabase, ((data ?? []) as RawSampleRow[]).map(normalizeSampleRow));
}

export async function getAppUsers() {
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("app_users")
    .select("id,username,display_name,role,profile_image_path,is_active,created_at,updated_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<AppUser & { created_at: string; updated_at: string }>;
}

function taskRowsFromSamples(samples: SampleRow[], role: AppRole, roleFilter?: string): TaskRow[] {
  const effectiveRole = role === "Admin" && roleFilter ? roleFilter as AppRole : role;
  return samples
    .filter((sample) => sample.status !== "Complete" && sample.status !== "Cancelled")
    .map((sample) => ({
      id: sample.id,
      sample,
      ownerRole: ownerRoleForStage(sample.status),
      title: `${sample.status}: ${sample.sample_code}`,
      dueDate: sample.due_date,
      overdue: isOverdue(sample),
    }))
    .filter((task) => role === "Admin" ? (!roleFilter || task.ownerRole === effectiveRole) : task.ownerRole === role);
}

export async function getTaskRows(role: AppRole, roleFilter?: string) {
  return taskRowsFromSamples(await getSamples(), role, roleFilter);
}

function prototypeTaskSamples(): SampleRow[] {
  const today = todayBangkokDate();
  const dateAt = (offset: number) => new Date(Date.parse(`${today}T00:00:00Z`) + (offset * 86_400_000)).toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const rows: Array<[string, string, string, string, SampleStatus, SamplePriority, number, WorkflowMode | null, string]> = [
    ["SP-221A-26", "J-EDO", "PW2732", "Classic-Regular-801", "Pattern", "Urgent", -36, "แก้ไข Spec", "แก้รอบเอวและเป้าหลังตามผลลองตัวล่าสุด"],
    ["SP-222A-26", "J-1981", "10X10/BK/FLAT", "Classic-Slim-812", "Pattern", "High", -23, "PPS", "ขึ้น PPS เพื่อยืนยันทรงก่อนเริ่มผลิต"],
    ["SP-223A-26", "J-RIM12", "10X7R", "Skinny-915", "Pattern", "High", -9, null, "ตรวจเส้นสะโพกและสร้างแพทเทิร์นใหม่"],
    ["SP-224A-26", "JF-192", "E1003", "Ladies-Slim-620", "Pattern", "Normal", 1, "เกรดไซส์", "เกรดไซส์ตามตารางที่อนุมัติ"],
    ["SP-225A-26", "JS-BAGGY", "1225/1", "Baggy-1102", "Cutting", "Urgent", -18, null, "รอตัดผ้าตัวอย่างไซส์ 32"],
    ["SP-226A-26", "J-KHUN/BL", "6625/7", "Regular-742", "Cutting", "High", -5, null, "ตัดใหม่เนื่องจากแนวผ้ารอบแรกไม่ตรง"],
    ["SP-227A-26", "J-362", "6625/8", "Slim-362", "Cutting", "Normal", 0, null, "ตัดงานให้เสร็จภายในวันนี้"],
    ["SP-228A-26", "JK-GYO/BK", "BLAX", "Jacket-Oversize-404", "Embellishment", "High", -15, null, "ต้องยืนยันตำแหน่งปักหน้าอกและชื่อร้าน"],
    ["SP-229A-26", "J-KURT", "OLIVIA", "Jacket-Slim-511", "Sewing", "Urgent", -28, "แก้ไข Spec", "เย็บแก้ Spec รอบวงแขนและความยาวตัว"],
    ["SP-230A-26", "JF-190/BL", "PW2732", "Ladies-Regular-718", "Sewing", "High", -6, null, "รอระบุช่างเย็บและปิดขั้นตอน"],
    ["SP-231A-26", "JS-JORTS", "10X7R", "Shorts-309", "Washing", "Urgent", -13, null, "รอฟอกนุ่ม+เอนไซม์ และระบุโรงฟอก"],
    ["SP-232A-26", "J-222/BR", "1225/1", "Regular-222", "QC", "Normal", 2, null, "ตรวจทรง สีฟอก และเลือกผล QC"],
  ];
  return rows.map(([sampleCode, modelId, fabricName, blockId, status, priority, dueOffset, workflowMode, note], index) => ({
    id: `prototype-task-${index + 1}`,
    sample_code: sampleCode,
    model_id: modelId,
    block_id: blockId,
    cutting: blockId.split("-")[0],
    fabric_name: fabricName,
    thread_color: index % 2 ? "4277+4279" : "Tobacco",
    fly: index % 3 ? "Button" : "Zip",
    washing: index % 2 ? "ฟอกนุ่ม+เอนไซม์" : "Rinse Wash",
    priority,
    status,
    current_stage: workflowMode ? `${status} ${workflowMode}` : status,
    start_date: dateAt(-45 + index),
    due_date: dateAt(dueOffset),
    note,
    washing_factory: status === "Washing" ? "โรงฟอก Denim Lab" : null,
    size_mode: index % 4 === 0 ? "letter" : "numeric",
    sample_size: index % 4 === 0 ? "M" : "32",
    created_by: "prototype",
    updated_by: "prototype",
    created_at: now,
    updated_at: now,
    archived_at: null,
    workflow_mode: workflowMode,
    status_detail: status === "Sewing" ? "ช่างเย็บ A" : status === "Embellishment" ? "ร้านปัก Jack Lab" : status === "Washing" ? "โรงฟอก Denim Lab" : null,
  }));
}

export async function getTaskDashboard(role: AppRole, roleFilter?: string): Promise<TaskDashboard> {
  const usePrototypeFallback = process.env.NODE_ENV === "development" && process.env.LOCAL_PROTOTYPE_PREVIEW === "true";
  let isPrototypeData = usePrototypeFallback;
  let samples: SampleRow[];
  if (usePrototypeFallback) {
    samples = prototypeTaskSamples();
  } else {
    samples = await getSamples();
  }
  const allTasks = taskRowsFromSamples(samples, "Admin");
  const tasks = taskRowsFromSamples(samples, role, roleFilter);
  const today = todayBangkokDate();
  const todayStart = new Date(`${today}T00:00:00+07:00`);
  const reportStart = new Date(todayStart.getTime() - (6 * 24 * 60 * 60 * 1000));
  const reportEnd = new Date(todayStart.getTime() + (24 * 60 * 60 * 1000));
  let completionRows: any[] = [];
  if (!isPrototypeData) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("audit_logs")
      .select("action,metadata,created_at")
      .in("action", completionAuditActions)
      .gte("created_at", reportStart.toISOString())
      .lt("created_at", reportEnd.toISOString())
      .order("created_at", { ascending: false });
    if (error) console.error(`Task performance unavailable: ${error.message}`);
    completionRows = data ?? [];
  }

  const completions: Array<{ role: AppRole; createdAt: string }> = (completionRows ?? []).map((row: any) => ({
    role: ownerRoleForStage(stageFromAudit(row.action, row.metadata)),
    createdAt: row.created_at as string,
  }));
  const performanceRoles: AppRole[] = ["Pattern", "Cutting", "Mer"];
  const prototypeCompleted: Record<string, { today: number; week: number }> = {
    Pattern: { today: 3, week: 12 },
    Cutting: { today: 4, week: 16 },
    Mer: { today: 5, week: 21 },
  };
  const performance = performanceRoles.map((performanceRole): RolePerformanceRow => ({
    role: performanceRole,
    open: allTasks.filter((task) => task.ownerRole === performanceRole).length,
    overdue: allTasks.filter((task) => task.ownerRole === performanceRole && task.overdue).length,
    completedToday: isPrototypeData ? prototypeCompleted[performanceRole].today : completions.filter((item) => item.role === performanceRole && item.createdAt >= todayStart.toISOString()).length,
    completed7Days: isPrototypeData ? prototypeCompleted[performanceRole].week : completions.filter((item) => item.role === performanceRole).length,
  }));

  return { tasks, performance };
}

export async function getSampleBundle(id: string) {
  const supabase = createSupabaseAdminClient() as any;
  const [sampleResult, timelineResult, filesResult, specsResult] = await Promise.all([
    supabase.from("samples").select("*").eq("id", id).maybeSingle(),
    supabase.from("sample_timeline").select("*").eq("sample_id", id).order("created_at", { ascending: false }),
    supabase.from("sample_files").select("*").eq("sample_id", id).order("created_at", { ascending: false }),
    supabase.from("sample_size_specs").select("*").eq("sample_id", id).order("created_at", { ascending: true }),
  ]);

  if (sampleResult.error) throw new Error(sampleResult.error.message);
  if (timelineResult.error) throw new Error(timelineResult.error.message);
  if (filesResult.error) throw new Error(filesResult.error.message);
  if (specsResult.error) throw new Error(specsResult.error.message);

  const timeline = (timelineResult.data ?? []) as TimelineRow[];
  const normalizedSample = sampleResult.data ? normalizeSampleRow(sampleResult.data as RawSampleRow) : null;
  const sample = normalizedSample ? {
    ...normalizedSample,
    workflow_mode: latestWorkflowMode(timeline) ?? workflowModeFromCurrentStage(normalizedSample.current_stage),
  } : null;

  const files = await Promise.all(((filesResult.data ?? []) as FileRow[]).map(async (file) => {
    const { data } = await supabase.storage.from(file.bucket_id).createSignedUrl(file.storage_path, 60 * 30);
    return { ...file, signedUrl: data?.signedUrl };
  }));

  return {
    sample,
    timeline,
    files,
    specs: normalizeSizeSpecs((specsResult.data ?? []) as SizeSpecRow[]),
    blockTechnical: blockTechnicalFromTimeline(timeline, sample?.block_id ?? null),
  };
}

export async function getNextSampleCode() {
  const supabase = createSupabaseAdminClient() as any;
  const yy = todayBangkokDate().slice(2, 4);
  const { data, error } = await supabase
    .from("samples")
    .select("sample_code")
    .like("sample_code", `SP-%-${yy}`)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  let suffix = "A";
  let max = 100;
  for (const row of (data ?? []) as Array<{ sample_code: string }>) {
    const match = row.sample_code.match(/^SP-(\d{3})([A-Z])-(\d{2})$/);
    if (!match || match[3] !== yy) continue;
    const num = Number(match[1]);
    const letter = match[2];
    if (letter > suffix || (letter === suffix && num > max)) {
      suffix = letter;
      max = num;
    }
  }

  let next = max + 1;
  if (next > 999) {
    next = 101;
    suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
  }
  return `SP-${String(next).padStart(3, "0")}${suffix}-${yy}`;
}

const completionAuditActions = [
  "COMPLETE_STAGE",
  "COMPLETE_SIZE_GRADE",
  "QC_REVISION_SPEC",
  "QC_PPS",
  "QC_CANCEL",
  "QC_SIZE_GRADE",
];

function validReportDate(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : todayBangkokDate();
}

function nextBangkokDate(date: string) {
  const start = new Date(`${date}T00:00:00+07:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function stageFromAudit(action: string, metadata: unknown): SampleStatus {
  const value = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>).from_status
    : null;
  if (typeof value === "string" && workflowStatuses.includes(value as SampleStatus)) return value as SampleStatus;
  if (action === "COMPLETE_SIZE_GRADE") return "Pattern";
  if (action.startsWith("QC_")) return "QC";
  return "Pattern";
}

function prototypeDailyRows(date: string, samples: SampleRow[]): DailyCompletionRow[] {
  const stages: SampleStatus[] = ["Pattern", "Pattern", "Cutting", "Embellishment", "Sewing", "Washing", "QC"];
  const actors: Record<string, string> = {
    Pattern: "Pattern 1",
    Cutting: "Cutting 1",
    Embellishment: "Mer 1",
    Sewing: "Mer 2",
    Washing: "Mer 1",
    QC: "Mer 2",
  };
  const fallback = [
    ["SP-201A-26", "J-JACK", "PW2732", "801 Slim-fit"],
    ["SP-202A-26", "J-EDO", "10X10/BK/FLAT", "Classic Regular fit"],
    ["SP-203A-26", "JS-BAGGY", "10X7R", "Baggy-fit"],
    ["SP-204A-26", "JF-180", "E1003", "Classic slim fit"],
    ["SP-205A-26", "J-KURT", "1225/1", "Jacket Oversize"],
    ["SP-206A-26", "JK-GYO/BK", "6625/7", "Jacket Slim fit"],
    ["SP-207A-26", "JS-JORTS", "OLIVIA", "Shorts"],
  ];
  return stages.map((stage, index) => {
    const sample = samples[index];
    const [sampleCode, modelId, fabricName, blockId] = fallback[index];
    return {
      id: `prototype-${index + 1}`,
      sampleId: sample?.id ?? `prototype-sample-${index + 1}`,
      sampleCode: sample?.sample_code ?? sampleCode,
      modelId: sample?.model_id || modelId,
      fabricName: sample?.fabric_name || fabricName,
      blockId: sample?.block_id || blockId,
      stage,
      role: ownerRoleForStage(stage),
      actorUsername: actors[stage],
      completedAt: new Date(`${date}T${String(9 + index).padStart(2, "0")}:${index % 2 ? "35" : "10"}:00+07:00`).toISOString(),
      action: stage === "QC" ? "QC_PPS" : "COMPLETE_STAGE",
    };
  }).reverse();
}

export async function getDailyCompletionReport(inputDate?: string): Promise<DailyCompletionReport> {
  const date = validReportDate(inputDate);
  const usePrototypeFallback = process.env.NODE_ENV === "development" && process.env.LOCAL_PROTOTYPE_PREVIEW === "true";
  const startIso = new Date(`${date}T00:00:00+07:00`).toISOString();
  const endIso = nextBangkokDate(date);
  const supabase = createSupabaseAdminClient() as any;
  const { data: auditRows, error: auditError } = await supabase
    .from("audit_logs")
    .select("id,actor_username,action,sample_id,metadata,created_at")
    .in("action", completionAuditActions)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  if (auditError) {
    if (usePrototypeFallback) return { date, rows: prototypeDailyRows(date, []), isPrototypeData: true };
    throw new Error(auditError.message);
  }

  const sampleIds = Array.from(new Set((auditRows ?? []).map((row: any) => row.sample_id).filter(Boolean))) as string[];
  let samples: SampleRow[] = [];
  if (sampleIds.length) {
    const { data, error } = await supabase.from("samples").select("*").in("id", sampleIds);
    if (error) {
      if (usePrototypeFallback) return { date, rows: prototypeDailyRows(date, []), isPrototypeData: true };
      throw new Error(error.message);
    }
    samples = ((data ?? []) as RawSampleRow[]).map(normalizeSampleRow);
  }

  const sampleById = new Map(samples.map((sample) => [sample.id, sample]));
  const rows = (auditRows ?? []).map((row: any): DailyCompletionRow => {
    const sample = sampleById.get(row.sample_id);
    const stage = stageFromAudit(row.action, row.metadata);
    return {
      id: row.id,
      sampleId: row.sample_id ?? "",
      sampleCode: sample?.sample_code ?? "—",
      modelId: sample?.model_id || "—",
      fabricName: sample?.fabric_name || "—",
      blockId: sample?.block_id || "—",
      stage,
      role: ownerRoleForStage(stage),
      actorUsername: row.actor_username || "—",
      completedAt: row.created_at,
      action: row.action,
    };
  });

  if (!rows.length && usePrototypeFallback) {
    const { data } = await supabase.from("samples").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(7);
    return { date, rows: prototypeDailyRows(date, ((data ?? []) as RawSampleRow[]).map(normalizeSampleRow)), isPrototypeData: true };
  }

  return { date, rows, isPrototypeData: false };
}
