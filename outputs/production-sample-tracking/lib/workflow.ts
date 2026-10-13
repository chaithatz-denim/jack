import { SampleStage, StageStatus } from "./types";

export function calculateSampleProgress(stages: SampleStage[]) {
  const active = stages.filter((s) => s.enabled);
  const points = active.reduce((sum, stage) => {
    if (stage.status === "APPROVED" || stage.status === "COMPLETED") return sum + stage.weight;
    if (stage.status === "IN PROGRESS") return sum + stage.weight * 0.5;
    if (stage.status === "SKIPPED" && stage.approvedSkipped) return sum + stage.weight;
    return sum;
  }, 0);
  const bulk = active.find((s) => s.name === "Bulk Approval");
  const capped = bulk?.status === "APPROVED" ? points : Math.min(points, 99);
  return Math.round(capped);
}

export function completedStageCount(stages: SampleStage[]) {
  return stages.filter((s) => ["APPROVED", "COMPLETED"].includes(s.status) || (s.status === "SKIPPED" && s.approvedSkipped)).length;
}

export function canTransition(stages: SampleStage[], stageId: string, next: StageStatus, adminOverride = false) {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return { ok: false, message: "Stage not found" };
  const passed = (name: string) => stages.some((s) => s.name === name && s.status === "APPROVED");
  const revision = stages.find((s) => s.name === "Revision Required");
  if (!adminOverride && revision && ["IN PROGRESS", "REVISION REQUIRED"].includes(revision.status) && stage.name !== "Revision Required")
    return { ok: false, message: "Complete the active revision before advancing the workflow." };
  if (!adminOverride && next === "APPROVED" && stage.name === "Size Run QC Review") {
    return { ok: true, message: "SIZE_RUN_CHECK" };
  }
  if (!adminOverride && stage.name === "Final Sample Approval" && !passed("Size Run QC Review"))
    return { ok: false, message: "Size Run QC Review must be approved first." };
  if (stage.name === "Bulk Approval" && !passed("Final Sample Approval"))
    return { ok: false, message: "Final Sample Approval must be approved first." };
  return { ok: true, message: "" };
}

export function deriveSampleStatus(stage: SampleStage): import("./types").SampleStatus {
  if (stage.status === "REJECTED" || stage.status === "REVISION REQUIRED") return "REVISION REQUIRED";
  if (stage.name === "Bulk Approval" && stage.status === "APPROVED") return "APPROVED FOR BULK";
  if (stage.name.includes("QC") && stage.status === "WAITING FOR REVIEW") return "WAITING FOR QC";
  if (stage.name.includes("Approval")) return "WAITING FOR APPROVAL";
  if (stage.name.includes("Size Run")) return "SIZE RUN IN PROGRESS";
  return "IN PROGRESS";
}
