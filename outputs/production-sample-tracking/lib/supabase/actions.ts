"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "./server";
import { getNextSampleCode, nextWorkflowStatus, sizePoints, workflowModeFromAction, workflowModeFromCurrentStage } from "./data";
import type { WorkflowMode } from "./data";
import type { Json, SamplePriority, SampleStatus } from "./database.types";
import { requireAdmin, requireSampleCreator, requireStageAccess, requireUser } from "./auth";
import { writeAuditLog } from "./audit";
import { nowIso, todayBangkokDate } from "../time";
import { isImageUpload, storageContentType, validateUploadFile } from "../upload-policy";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function normalizePriority(value: string | null): SamplePriority {
  if (value === "Low" || value === "High" || value === "Urgent") return value;
  return "Normal";
}

function normalizeStatus(value: string | null): SampleStatus {
  const allowed: SampleStatus[] = ["Pattern", "Cutting", "Embellishment", "Sewing", "Washing", "QC", "Complete", "Cancelled"];
  return allowed.includes(value as SampleStatus) ? value as SampleStatus : "Pattern";
}

function stageWithMode(stage: SampleStatus, mode: WorkflowMode | null) {
  if (!mode || ["Complete", "Cancelled"].includes(stage)) return stage;
  return `${stage} ${mode}`;
}

function revalidateSampleViews(sampleId: string) {
  revalidatePath("/");
  revalidatePath("/samples");
  revalidatePath("/tasks");
  revalidatePath("/my-task");
  revalidatePath("/settings");
  revalidatePath(`/samples/${sampleId}`);
}

function revalidateCoreViews() {
  revalidatePath("/");
  revalidatePath("/samples");
  revalidatePath("/tasks");
  revalidatePath("/my-task");
  revalidatePath("/settings");
}

function appendNoteEntry(currentNote: string | null | undefined, entry: string) {
  const current = currentNote?.trim();
  const next = entry.trim();
  if (!next) return current || null;
  return current ? `${current}\n${next}` : next;
}

async function appendSampleNote(supabase: any, sampleId: string, entry: string | null | undefined) {
  const noteEntry = entry?.trim();
  if (!noteEntry) return;
  const { data, error } = await supabase.from("samples").select("note").eq("id", sampleId).maybeSingle();
  if (error) throw new Error(error.message);
  const mergedNote = appendNoteEntry(data?.note, noteEntry);
  const { error: updateError } = await supabase.from("samples").update({
    note: mergedNote,
    updated_at: nowIso(),
  }).eq("id", sampleId);
  if (updateError) throw new Error(updateError.message);
}

export async function createSampleAction(formData: FormData) {
  const user = await requireSampleCreator();
  const supabase = createSupabaseAdminClient() as any;
  const creationId = requiredText(formData, "creation_id", "Creation ID");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creationId)) {
    throw new Error("Invalid sample creation request. Please reload the form and try again.");
  }
  const initialStatus = normalizeStatus(text(formData, "status"));
  const sampleSize = text(formData, "sample_size");
  const fabricSupplier = requiredText(formData, "fabric_supplier", "ร้านผ้า");
  const sizeMode = sampleSize && /^[A-Z]+$/i.test(sampleSize) ? "letter" : "numeric";
  const payload = {
    id: creationId,
    model_id: text(formData, "model_id"),
    block_id: requiredText(formData, "block_id", "Block ID"),
    cutting: text(formData, "cutting"),
    fabric_name: requiredText(formData, "fabric_name", "Fabric Name"),
    thread_color: requiredText(formData, "thread_color", "Thread Color"),
    fly: text(formData, "fly"),
    washing: requiredText(formData, "washing", "Washing"),
    priority: normalizePriority(text(formData, "priority")),
    status: initialStatus,
    current_stage: initialStatus,
    start_date: todayBangkokDate(),
    due_date: text(formData, "due_date"),
    note: text(formData, "note"),
    size_mode: sizeMode,
    sample_size: sampleSize,
  };

  let sample: any = null;
  let sampleCode = "";
  let created = false;
  for (let attempt = 0; attempt < 5 && !sample; attempt++) {
    sampleCode = await getNextSampleCode();
    const { data, error } = await supabase.from("samples").insert({ ...payload, sample_code: sampleCode }).select().single();
    if (!error) {
      sample = data;
      created = true;
      break;
    }
    if (error.code !== "23505") throw new Error(error.message);

    const { data: existing, error: existingError } = await supabase.from("samples").select("*").eq("id", creationId).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      sample = existing;
      sampleCode = existing.sample_code;
      break;
    }
  }
  if (!sample) throw new Error("Unable to allocate a unique Sample ID. Please try again.");

  try {
    const { data: createEvents, error: createEventReadError } = await supabase.from("sample_timeline").select("id").eq("sample_id", sample.id).eq("action", "CREATE_SAMPLE").limit(1);
    if (createEventReadError) throw new Error(createEventReadError.message);
    if (!createEvents?.length) {
      const { error: createEventError } = await supabase.from("sample_timeline").insert({
        sample_id: sample.id,
        stage: initialStatus,
        action: "CREATE_SAMPLE",
        note: `สร้างรายการตัวอย่างใหม่ และตั้งสถานะเริ่มต้นเป็น ${initialStatus}`,
        to_status: initialStatus,
      });
      if (createEventError) throw new Error(createEventError.message);
    }

    const { data: supplierEvents, error: supplierReadError } = await supabase.from("sample_timeline").select("id").eq("sample_id", sample.id).eq("action", "FABRIC_SUPPLIER").limit(1);
    if (supplierReadError) throw new Error(supplierReadError.message);
    if (!supplierEvents?.length) {
      const { error: supplierError } = await supabase.from("sample_timeline").insert({
        sample_id: sample.id,
        stage: "Overview",
        action: "FABRIC_SUPPLIER",
        note: fabricSupplier,
      });
      if (supplierError) throw new Error(supplierError.message);
    }

    const sizes = sizeMode === "letter" ? ["XS", "S", "M", "L", "XL", "2XL"] : ["29", "30", "31", "32", "33", "34", "36", "38"];
    const { data: existingSpecs, error: specReadError } = await supabase.from("sample_size_specs").select("measurement_point").eq("sample_id", sample.id);
    if (specReadError) throw new Error(specReadError.message);
    const existingPoints = new Set((existingSpecs ?? []).map((item: { measurement_point: string }) => item.measurement_point));
    const missingSpecs = sizePoints.filter(([point]) => !existingPoints.has(point)).map(([point, description, tolerance]) => ({
      sample_id: sample.id,
      measurement_point: point,
      description,
      tolerance,
      values: Object.fromEntries(sizes.map((size) => [size, ""])) as Json,
    }));
    if (missingSpecs.length) {
      const { error: specError } = await supabase.from("sample_size_specs").insert(missingSpecs);
      if (specError) throw new Error(specError.message);
    }
  } catch (setupError) {
    if (created) await supabase.from("samples").delete().eq("id", sample.id);
    throw setupError;
  }

  const files = formData.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0);
  const attachmentErrors: string[] = [];
  for (const file of files) {
    try {
      const { data: existingFiles, error: existingFileError } = await supabase.from("sample_files").select("id").eq("sample_id", sample.id).eq("file_name", file.name).eq("file_size", file.size).eq("stage", "New Sample").limit(1);
      if (existingFileError) throw new Error(existingFileError.message);
      if (!existingFiles?.length) await uploadFileForSample(sample.id, file, "New Sample", user.id, user.username);
    } catch (fileError) {
      attachmentErrors.push(`${file.name}: ${fileError instanceof Error ? fileError.message : "Upload failed"}`);
    }
  }
  if (attachmentErrors.length) {
    await supabase.from("sample_timeline").insert({
      sample_id: sample.id,
      stage: "Files",
      action: "UPLOAD_FILE_FAILED",
      note: attachmentErrors.join(" | "),
    });
  }

  if (created) await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "CREATE_SAMPLE",
    entityType: "sample",
    entityId: sample.id,
    sampleId: sample.id,
    metadata: {
      sample_code: sampleCode,
      model_id: text(formData, "model_id"),
      fabric_name: sample.fabric_name,
      priority: sample.priority,
      status: initialStatus,
      size_mode: sizeMode,
      sample_size: sampleSize,
      attachment_count: files.length,
      attachment_error_count: attachmentErrors.length,
    },
  });

  revalidatePath("/");
  revalidatePath("/samples");
  revalidatePath("/tasks");
  revalidatePath("/my-task");
  redirect("/samples");
}

export async function updateSampleAction(sampleId: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "Admin" && user.role !== "Mer") throw new Error("Admin or Mer role required to edit sample details.");
  const supabase = createSupabaseAdminClient() as any;
  const fabricSupplier = text(formData, "fabric_supplier");
  const sampleSize = text(formData, "sample_size");
  const updatePayload: Record<string, unknown> = {
    model_id: text(formData, "model_id"),
    block_id: text(formData, "block_id"),
    cutting: text(formData, "cutting"),
    fabric_name: requiredText(formData, "fabric_name", "Fabric Name"),
    thread_color: text(formData, "thread_color"),
    fly: text(formData, "fly"),
    washing: text(formData, "washing"),
    sample_size: sampleSize,
    size_mode: sampleSize && /[a-z]/i.test(sampleSize) ? "letter" : "numeric",
    note: text(formData, "note"),
    updated_at: nowIso(),
  };
  if (user.role === "Admin") {
    updatePayload.priority = normalizePriority(text(formData, "priority"));
    updatePayload.due_date = text(formData, "due_date");
  }
  const { error } = await supabase.from("samples").update(updatePayload).eq("id", sampleId);
  if (error) throw new Error(error.message);
  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: "Overview",
    action: "EDIT_SAMPLE",
    note: "แก้ไขรายละเอียดตัวอย่างสินค้า",
  });
  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: "Overview",
    action: "FABRIC_SUPPLIER",
    note: fabricSupplier,
  });
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "UPDATE_SAMPLE",
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      editor_role: user.role,
      model_id: text(formData, "model_id"),
      block_id: text(formData, "block_id"),
      cutting: text(formData, "cutting"),
      fabric_name: text(formData, "fabric_name"),
      sample_size: sampleSize,
      priority: user.role === "Admin" ? normalizePriority(text(formData, "priority")) : undefined,
      due_date: user.role === "Admin" ? text(formData, "due_date") : undefined,
      has_fabric_supplier: Boolean(fabricSupplier),
    },
  });
  revalidateSampleViews(sampleId);
  redirect(`/samples/${sampleId}?tab=overview`);
}

export async function updateStatusAction(sampleId: string, formData: FormData) {
  const supabase = createSupabaseAdminClient() as any;
  const status = normalizeStatus(text(formData, "status"));
  const note = text(formData, "note");
  const { data: before } = await supabase.from("samples").select("status").eq("id", sampleId).maybeSingle();
  const user = await requireStageAccess(before?.status);
  const { error } = await supabase.from("samples").update({
    status,
    current_stage: status,
    updated_at: nowIso(),
  }).eq("id", sampleId);
  if (error) throw new Error(error.message);
  if (note) await appendSampleNote(supabase, sampleId, note);
  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: status,
    action: "UPDATE_STATUS",
    note: note || `อัพเดทสถานะเป็น ${status}`,
    from_status: before?.status ?? null,
    to_status: status,
  });
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "UPDATE_STATUS",
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      from_status: before?.status ?? null,
      to_status: status,
      note,
    },
  });
  revalidateSampleViews(sampleId);
}

function qcOutcomeToWorkflow(outcome: string | null): { next: SampleStatus; action: string; note: string; mode: WorkflowMode | null } {
  if (outcome === "แก้ไข Spec") {
    return {
      next: "Pattern",
      action: "QC_REVISION_SPEC",
      mode: "แก้ไข Spec",
      note: "QC เลือกแก้ไข Spec ระบบส่งกลับช่างแพทเทิร์นเพื่อแก้ไข Spec",
    };
  }
  if (outcome === "PPS") {
    return {
      next: "Pattern",
      action: "QC_PPS",
      mode: "PPS",
      note: "QC เลือก PPS ระบบส่งกลับช่างแพทเทิร์นเพื่อทำ PPS",
    };
  }
  if (outcome === "ยกเลิก") {
    return {
      next: "Cancelled",
      action: "QC_CANCEL",
      mode: null,
      note: "QC เลือกยกเลิกงานตัวอย่าง",
    };
  }
  if (outcome === "เกรดไซส์") {
    return {
      next: "Pattern",
      action: "QC_SIZE_GRADE",
      mode: "เกรดไซส์",
      note: "QC เลือกเกรดไซส์ ระบบส่งกลับช่างแพทเทิร์นเพื่อขึ้นเกรดไซส์ และให้ช่าง Pattern เป็นผู้ Approve งานหลังเกรดไซส์เสร็จ",
    };
  }
  throw new Error("Invalid QC result.");
}

export async function completeCurrentStageAction(sampleId: string, formData: FormData) {
  const supabase = createSupabaseAdminClient() as any;
  const note = text(formData, "note");
  const { data: sample, error: loadError } = await supabase
    .from("samples")
    .select("status,block_id,current_stage")
    .eq("id", sampleId)
    .single();
  if (loadError) throw new Error(loadError.message);

  const user = await requireStageAccess(sample.status);

  let next = nextWorkflowStatus(sample.status);
  let action = "COMPLETE_STAGE";
  let mode = workflowModeFromCurrentStage(sample.current_stage);
  const isSizeGradingFinalPatternStage = sample.status === "Pattern" && mode === workflowModeFromAction("QC_SIZE_GRADE");
  const updatePayload: Record<string, unknown> = {
    status: next,
    current_stage: stageWithMode(next, mode),
    updated_at: nowIso(),
  };
  const noteParts: string[] = [];

  if (sample.status === "Pattern") {
    const blockId = requiredText(formData, "block_id_update", "Block ID ใหม่/ที่แก้ไข");
    updatePayload.block_id = blockId;
    noteParts.push(`Block ID ใหม่/ที่แก้ไข: ${blockId}`);
  }

  if (isSizeGradingFinalPatternStage) {
    next = "Complete";
    action = "COMPLETE_SIZE_GRADE";
    updatePayload.status = next;
    updatePayload.current_stage = stageWithMode(next, mode);
    noteParts.push("เกรดไซส์เสร็จสมบูรณ์ และปิดรายการเป็น Complete");
  }

  if (sample.status === "Embellishment") {
    const hasEmbellishment = text(formData, "embellishment_required") === "yes";
    if (hasEmbellishment) {
      const shopName = requiredText(formData, "embellishment_shop", "ชื่อร้านปัก/สกรีน");
      noteParts.push(`มีปัก/สกรีน / ร้าน: ${shopName}`);
    } else {
      noteParts.push("ไม่มีปัก/สกรีน ข้ามไปขั้นตอนเย็บ");
    }
  }

  if (sample.status === "Sewing") {
    const sewingOperator = requiredText(formData, "sewing_operator", "ชื่อช่างเย็บ");
    noteParts.push(`ช่างเย็บ: ${sewingOperator}`);
  }

  if (sample.status === "Washing") {
    const washingFactory = requiredText(formData, "washing_factory", "โรงฟอก");
    updatePayload.washing_factory = washingFactory;
    noteParts.push(`โรงฟอก: ${washingFactory}`);
  }

  if (sample.status === "QC") {
    const outcome = requiredText(formData, "qc_outcome", "ผล QC");
    const qcWorkflow = qcOutcomeToWorkflow(outcome);
    next = qcWorkflow.next;
    action = qcWorkflow.action;
    mode = qcWorkflow.mode;
    updatePayload.status = next;
    updatePayload.current_stage = stageWithMode(next, mode);
    noteParts.push(qcWorkflow.note);
  } else if (!isSizeGradingFinalPatternStage) {
    noteParts.push(`ทำขั้นตอน ${sample.status} เสร็จ และส่งต่อไป ${stageWithMode(next, mode)}`);
  }

  if (note) noteParts.push(note);

  const { error } = await supabase.from("samples").update(updatePayload).eq("id", sampleId);
  if (error) throw new Error(error.message);
  if (note) await appendSampleNote(supabase, sampleId, note);

  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: sample.status,
    action,
    note: noteParts.join(" / "),
    from_status: sample.status,
    to_status: stageWithMode(next, mode),
  });
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action,
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      from_status: sample.status,
      to_status: stageWithMode(next, mode),
      workflow_mode: mode,
      note: noteParts.join(" / "),
      update_payload_keys: Object.keys(updatePayload),
    },
  });
  revalidateSampleViews(sampleId);
}

export async function saveSizeSpecAction(sampleId: string, formData: FormData) {
  const user = await requireStageAccess("QC");
  const supabase = createSupabaseAdminClient() as any;
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("size_") && typeof value === "string") values[key.replace("size_", "")] = value;
  }
  const id = text(formData, "id");
  const payload = {
    sample_id: sampleId,
    measurement_point: requiredText(formData, "measurement_point", "Measurement Point"),
    description: text(formData, "description"),
    tolerance: text(formData, "tolerance"),
    values: values as Json,
    updated_at: nowIso(),
  };
  const result = id
    ? await supabase.from("sample_size_specs").update(payload).eq("id", id)
    : await supabase.from("sample_size_specs").insert(payload);
  if (result.error) throw new Error(result.error.message);
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "SAVE_SIZE_SPEC_ROW",
    entityType: "sample_size_spec",
    entityId: id || null,
    sampleId,
    metadata: {
      measurement_point: text(formData, "measurement_point"),
      size_count: Object.keys(values).length,
      mode: id ? "update" : "insert",
    },
  });
  revalidatePath(`/samples/${sampleId}`);
}

export async function saveAllSizeSpecsAction(sampleId: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "Admin" && user.role !== "Mer") throw new Error("Admin or Mer role required to update Size Spec.");
  const supabase = createSupabaseAdminClient() as any;
  const ids = formData.getAll("spec_id").filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!ids.length) throw new Error("No Size Spec rows were submitted.");

  for (const id of ids) {
    const values: Record<string, string> = {};
    const sizePrefix = `size_${id}_`;
    for (const [key, value] of formData.entries()) {
      if (key.startsWith(sizePrefix) && typeof value === "string") values[key.slice(sizePrefix.length)] = value;
    }

    const payload = {
      measurement_point: requiredText(formData, `measurement_point_${id}`, "Measurement Point"),
      description: text(formData, `description_${id}`),
      tolerance: text(formData, `tolerance_${id}`),
      values: values as Json,
      updated_at: nowIso(),
    };
    const query = id.startsWith("new-")
      ? supabase.from("sample_size_specs").insert({ ...payload, sample_id: sampleId })
      : supabase.from("sample_size_specs").update(payload).eq("id", id).eq("sample_id", sampleId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: "Size Spec",
    action: "SAVE_SIZE_SPEC",
    note: `บันทึก Size Spec รวม ${ids.length} จุดวัด`,
  });
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "SAVE_ALL_SIZE_SPECS",
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      spec_count: ids.length,
    },
  });
  revalidateSampleViews(sampleId);
}

export async function saveBlockTechnicalDataAction(sampleId: string, formData: FormData) {
  const user = await requireUser();
  if (user.role !== "Admin" && user.role !== "Pattern") throw new Error("Admin or Pattern role required to update Block technical data.");

  const supabase = createSupabaseAdminClient() as any;
  const { data: sample, error: sampleError } = await supabase
    .from("samples")
    .select("block_id")
    .eq("id", sampleId)
    .maybeSingle();
  if (sampleError) throw new Error(sampleError.message);
  const blockId = sample?.block_id?.trim();
  if (!blockId) throw new Error("Block ID is required before saving technical data.");

  const fabricShrinkage = text(formData, "fabric_shrinkage") ?? "";
  const fabricConsumption = text(formData, "fabric_consumption") ?? "";
  const blockNote = text(formData, "block_note") ?? "";
  const { error } = await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: "Pattern",
    action: "BLOCK_TECHNICAL_DATA",
    note: JSON.stringify({
      block_id: blockId,
      fabric_shrinkage: fabricShrinkage,
      fabric_consumption: fabricConsumption,
      block_note: blockNote,
    }),
  });
  if (error) throw new Error(error.message);

  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "SAVE_BLOCK_TECHNICAL_DATA",
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      block_id: blockId,
      fabric_shrinkage: fabricShrinkage,
      fabric_consumption: fabricConsumption,
      has_note: Boolean(blockNote),
    },
  });
  revalidateSampleViews(sampleId);
}

export async function uploadFilesAction(sampleId: string, formData: FormData) {
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  const stage = text(formData, "stage") || "General";
  const user = await requireStageAccess(stage);
  if (!files.length) redirect(`/samples/${sampleId}?tab=files&upload=no-file`);
  const invalid = files.map(validateUploadFile).find(Boolean);
  if (invalid) redirect(`/samples/${sampleId}?tab=files&upload=${invalid}`);
  try {
    for (const file of files) {
      await uploadFileForSample(sampleId, file, stage, user.id, user.username);
    }
  } catch (error) {
    try {
      await writeAuditLog(createSupabaseAdminClient() as any, {
        actorUserId: user.id,
        actorUsername: user.username,
        action: "UPLOAD_FILE_FAILED",
        entityType: "sample_file",
        sampleId,
        metadata: {
          stage,
          file_names: files.map((file) => file.name),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (auditError) {
      console.error("Upload failure audit failed:", auditError);
    }
    redirect(`/samples/${sampleId}?tab=files&upload=failed`);
  }
  revalidatePath(`/samples/${sampleId}`);
  redirect(`/samples/${sampleId}?tab=files&upload=success`);
}

export async function archiveSampleAction(sampleId: string) {
  const user = await requireAdmin();
  const supabase = createSupabaseAdminClient() as any;
  const now = nowIso();
  const { data: sample } = await supabase
    .from("samples")
    .select("sample_code,status")
    .eq("id", sampleId)
    .maybeSingle();
  const { error } = await supabase.from("samples").update({ archived_at: now, updated_at: now }).eq("id", sampleId);
  if (error) throw new Error(error.message);
  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: sample?.status ?? "Admin",
    action: "SOFT_DELETE_SAMPLE",
    note: "Admin soft delete sample. Data and files remain recoverable.",
    from_status: sample?.status ?? null,
    to_status: "Archived",
  });
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "SOFT_DELETE_SAMPLE",
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      sample_code: sample?.sample_code ?? null,
      archived_at: now,
      storage_files_deleted: false,
    },
  });
  revalidateSampleViews(sampleId);
  redirect("/samples");
}

export async function restoreSampleAction(sampleId: string) {
  const user = await requireAdmin();
  const supabase = createSupabaseAdminClient() as any;
  const now = nowIso();
  const { data: sample } = await supabase
    .from("samples")
    .select("sample_code,status,archived_at")
    .eq("id", sampleId)
    .maybeSingle();
  const { error } = await supabase
    .from("samples")
    .update({ archived_at: null, updated_at: now })
    .eq("id", sampleId);
  if (error) throw new Error(error.message);
  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage: "Admin",
    action: "RESTORE_SAMPLE",
    note: "Admin restored sample from soft delete.",
    from_status: "Archived",
    to_status: sample?.status ?? null,
  });
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "RESTORE_SAMPLE",
    entityType: "sample",
    entityId: sampleId,
    sampleId,
    metadata: {
      sample_code: sample?.sample_code ?? null,
      previous_archived_at: sample?.archived_at ?? null,
      restored_at: now,
    },
  });
  revalidateSampleViews(sampleId);
  redirect("/settings");
}

export async function clearCacheAction() {
  const user = await requireAdmin();
  const supabase = createSupabaseAdminClient() as any;
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "CLEAR_CACHE",
    entityType: "system",
    metadata: {
      revalidated_paths: ["/", "/samples", "/tasks", "/my-task", "/settings"],
      data_deleted: false,
    },
  });
  revalidateCoreViews();
  redirect(`/settings?cache=${Date.now()}`);
}

export async function clearSystemDataAction() {
  const user = await requireAdmin();
  const supabase = createSupabaseAdminClient() as any;
  const now = nowIso();
  const { count } = await supabase
    .from("samples")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null);
  const { error } = await supabase
    .from("samples")
    .update({ archived_at: now, updated_at: now })
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  await writeAuditLog(supabase, {
    actorUserId: user.id,
    actorUsername: user.username,
    action: "CLEAR_SYSTEM_DATA",
    entityType: "system",
    metadata: {
      archived_sample_count: count ?? null,
    },
  });
  revalidateCoreViews();
  redirect("/settings");
}

async function uploadFileForSample(sampleId: string, file: File, stage: string, actorUserId?: string | null, actorUsername?: string | null) {
  const validationError = validateUploadFile(file);
  if (validationError === "unsupported") throw new Error(`Unsupported file type: ${file.name}`);
  if (validationError === "too-large") throw new Error(`File is too large: ${file.name}`);
  const supabase = createSupabaseAdminClient() as any;
  const safeName = file.name.replace(/[^\w.\-\u0E00-\u0E7F ]+/g, "_");
  const path = `${sampleId}/${Date.now()}-${safeName}`;
  const bucket = isImageUpload(file) ? "sample-images" : "sample-files";
  const contentType = storageContentType(file);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { error: dbError } = await supabase.from("sample_files").insert({
    sample_id: sampleId,
    bucket_id: bucket,
    storage_path: path,
    file_name: file.name,
    mime_type: contentType,
    file_size: file.size,
    stage,
  });
  if (dbError) throw new Error(dbError.message);
  await supabase.from("sample_timeline").insert({
    sample_id: sampleId,
    stage,
    action: "UPLOAD_FILE",
    note: `อัพโหลดไฟล์ ${file.name}`,
    to_status: stage,
  });
  await writeAuditLog(supabase, {
    actorUserId,
    actorUsername,
    action: "UPLOAD_FILE",
    entityType: "sample_file",
    sampleId,
    metadata: {
      file_name: file.name,
      safe_name: safeName,
      bucket,
      storage_path: path,
      mime_type: contentType,
      file_size: file.size,
      stage,
    },
  });
}
