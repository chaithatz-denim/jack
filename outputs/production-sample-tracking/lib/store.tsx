"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { seedState, currentUserId, templates } from "./seed";
import { AppState, Sample, StageStatus, TaskStatus } from "./types";
import { canTransition, deriveSampleStatus } from "./workflow";
import { nowIso, todayBangkokDate } from "./time";

interface StoreValue {
  state: AppState; currentUserId: string; notice: string; clearNotice(): void;
  createSample(input: Partial<Sample>): Sample; updateStage(stageId: string, status: StageStatus, comment?: string): { ok: boolean; message: string };
  updateSizeRun(id: string): void; updateTask(id: string, status: TaskStatus): void; updateTemplate(id: string, changes: Record<string, unknown>): void;
  addSizeSpec(): void; removeSizeSpec(id: string): void; reset(): void;
}
const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seedState);
  const [notice, setNotice] = useState("");
  const log = (sampleId: string, stageId: string | undefined, actionType: string, beforeValue: string, afterValue: string, comment: string) => ({ id: `log-${Date.now()}`, sampleId, stageId, userId: currentUserId, actionType, beforeValue, afterValue, comment, createdAt: nowIso() });
  const value = useMemo<StoreValue>(() => ({
    state, currentUserId, notice, clearNotice: () => setNotice(""),
    createSample(input) {
      const id = `s-${Date.now()}`; const now = nowIso();
      const sample: Sample = { ...seedState.samples[0], ...input, id, sampleCode: `SMP-2026-${String(state.samples.length + 49).padStart(4, "0")}`, status: input.status || "NEW", currentStageId: `${id}-tpl-1`, createdAt: now, updatedAt: now, createdBy: currentUserId, updatedBy: currentUserId };
      const newStages = templates.map((t) => ({ ...t, id: `${id}-${t.id}`, sampleId: id, status: (t.order === 1 ? "IN PROGRESS" : "NOT STARTED") as StageStatus, assigneeId: sample.primaryAssigneeId, dueDate: sample.firstSampleDueDate, notes: "", attachments: [] }));
      setState((s) => ({ ...s, samples: [sample, ...s.samples], stages: [...s.stages, ...newStages], activities: [log(id, `${id}-tpl-1`, "SAMPLE_CREATED", "", sample.sampleCode, "New sample job created."), ...s.activities] }));
      return sample;
    },
    updateStage(stageId, status, comment = "Stage status updated.") {
      const stage = state.stages.find((s) => s.id === stageId); if (!stage) return { ok: false, message: "Stage not found." };
      const related = state.stages.filter((s) => s.sampleId === stage.sampleId);
      const guard = canTransition(related, stageId, status, false);
      if (guard.message === "SIZE_RUN_CHECK" && state.sizeRuns.filter((r) => r.sampleId === stage.sampleId).some((r) => r.status !== "APPROVED")) return { ok: false, message: "All required size-run items must be approved first." };
      if (!guard.ok) return guard;
      setState((s) => {
        let stages = s.stages.map((x) => x.id === stageId ? { ...x, status, completedDate: ["APPROVED", "COMPLETED"].includes(status) ? todayBangkokDate() : x.completedDate, rejectionReason: status === "REJECTED" ? comment : x.rejectionReason } : x);
        const logs = [log(stage.sampleId, stageId, status === "REJECTED" ? "QC_REJECTED" : "STAGE_UPDATED", stage.status, status, comment), ...s.activities];
        if (status === "REJECTED") {
          stages = stages.map((x) => x.sampleId === stage.sampleId && x.name === "Revision Required" ? { ...x, status: "REVISION REQUIRED", startDate: todayBangkokDate(), rejectionReason: comment } : x);
        }
        let activeId = stageId;
        if (["APPROVED", "COMPLETED"].includes(status) && stage.name !== "Bulk Approval") {
          const target = stage.name === "Revision Required"
            ? stages.find((x) => x.sampleId === stage.sampleId && x.name === "First Sample Production")
            : stages.filter((x) => x.sampleId === stage.sampleId && x.enabled && x.order > stage.order && x.name !== "Revision Required").sort((a, b) => a.order - b.order)[0];
          if (target) {
            activeId = target.id;
            stages = stages.map((x) => x.id === target.id ? { ...x, status: "IN PROGRESS", startDate: x.startDate || todayBangkokDate() } : x);
          }
        }
        const changed = stages.find((x) => x.id === activeId)!;
        const samples = s.samples.map((x) => x.id === stage.sampleId ? { ...x, status: status === "REJECTED" ? "REVISION REQUIRED" as const : deriveSampleStatus(changed), currentStageId: activeId, updatedAt: nowIso(), updatedBy: currentUserId } : x);
        return { ...s, stages, samples, activities: logs };
      });
      setNotice(`${stage.name} updated to ${status}.`); return { ok: true, message: "" };
    },
    updateSizeRun(id) { setState((s) => ({ ...s, sizeRuns: s.sizeRuns.map((r) => r.id === id ? { ...r, status: r.status === "APPROVED" ? "APPROVED" : "APPROVED", reviewDate: todayBangkokDate(), reviewedBy: currentUserId, approvalResult: "PASS" } : r) })); setNotice("Size item approved and QC evidence recorded."); },
    updateTask(id, status) { setState((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === id ? { ...t, status, updatedAt: nowIso() } : t), activities: [log(s.tasks.find((t) => t.id === id)?.sampleId || "", undefined, "TASK_UPDATED", s.tasks.find((t) => t.id === id)?.status || "", status, "Task quick action."), ...s.activities] })); },
    updateTemplate(id, changes) { setState((s) => ({ ...s, templates: s.templates.map((t) => t.id === id ? { ...t, ...changes } : t) })); },
    addSizeSpec() { setState((s) => ({ ...s, sizeSpecs: [...s.sizeSpecs, { id: `spec-${Date.now()}`, point: "New measurement", description: "Define measurement method", tolerance: 0.5, values: Object.fromEntries(["28", "30", "32", "34", "36"].map((x) => [x, 0])), notes: "" }] })); },
    removeSizeSpec(id) { setState((s) => ({ ...s, sizeSpecs: s.sizeSpecs.filter((r) => r.id !== id) })); },
    reset() { setState(seedState); setNotice("Mock data reset."); }
  }), [state, notice]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export function useStore() { const value = useContext(StoreContext); if (!value) throw new Error("useStore must be inside StoreProvider"); return value; }
