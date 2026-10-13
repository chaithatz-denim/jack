export type Role = "ADMIN" | "PRODUCT_MANAGER" | "MERCHANDISER" | "QC" | "FACTORY" | "VIEWER";
export type SampleStatus = "NEW" | "IN PROGRESS" | "WAITING FOR QC" | "REVISION REQUIRED" | "SIZE RUN IN PROGRESS" | "WAITING FOR APPROVAL" | "APPROVED FOR BULK" | "OVERDUE";
export type StageStatus = "NOT STARTED" | "IN PROGRESS" | "WAITING FOR REVIEW" | "COMPLETED" | "APPROVED" | "REJECTED" | "REVISION REQUIRED" | "SKIPPED";
export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN PROGRESS" | "BLOCKED" | "DONE";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVISION REQUIRED";

export interface User { id: string; name: string; initials: string; role: Role; team: string; }
export interface Supplier { id: string; name: string; location: string; contact: string; }
export interface Collection { id: string; name: string; season: string; }
export interface ProductCategory { id: string; name: string; }

export interface StageTemplate {
  id: string; name: string; order: number; weight: number; enabled: boolean; defaultRole: Role;
  requiredAttachments: string[]; requiresReview: boolean; requiresApproval: boolean; isSkippable: boolean;
  approveNextId?: string; rejectReturnId?: string; slaDays: number;
}
export interface SampleStage extends StageTemplate {
  sampleId: string; status: StageStatus; assigneeId?: string; startDate?: string; dueDate?: string;
  completedDate?: string; actualDuration?: number; notes: string; attachments: string[];
  rejectionReason?: string; approvedSkipped?: boolean;
}
export interface SampleSizeRunItem {
  id: string; sampleId: string; size: string; status: "PENDING" | "IN PROGRESS" | "SUBMITTED" | "APPROVED" | "REJECTED";
  submittedDate?: string; reviewDate?: string; reviewedBy?: string; approvalResult?: string;
  measurementNotes: string; qcNotes: string; attachments: string[];
}
export interface SampleTask {
  id: string; sampleId: string; name: string; stageId: string; assignedTo: string; priority: Priority;
  dueDate: string; status: TaskStatus; createdBy: string; updatedAt: string; comments: string[];
}
export interface SampleFile {
  id: string; sampleId: string; name: string; category: string; uploadedBy: string; uploadedAt: string;
  version: number; size: string; versions: string[];
}
export interface SampleApproval {
  id: string; sampleId: string; stageId: string; type: string; status: ApprovalStatus; submittedBy: string;
  submittedAt: string; reviewerId: string; reviewedAt?: string; comment?: string; rejectionReason?: string;
  checklist: string[]; defectNotes?: string; correctionNotes?: string; attachments: string[]; history: string[];
}
export interface SampleActivityLog {
  id: string; sampleId: string; stageId?: string; userId: string; actionType: string; beforeValue?: string;
  afterValue?: string; comment: string; attachmentReference?: string; createdAt: string;
}
export interface SizeSpecRow {
  id: string; point: string; description: string; tolerance: number; values: Record<string, number>; actual?: Record<string, number>; notes: string;
}
export interface Sample {
  id: string; sampleCode: string; productName: string; styleCode: string; category: string; gender: string;
  collection: string; season: string; colorName: string; colorCode: string; fitType: string;
  fabricComposition: string; fabricWeight: string; supplierId: string; targetCost: number; targetRetailPrice: number;
  plannedLaunchDate: string; sampleType: string; priority: Priority; status: SampleStatus; currentStageId: string;
  primaryAssigneeId: string; qcAssigneeId: string; factoryContact: string; firstSampleDueDate: string;
  finalApprovalDueDate: string; bulkApprovalTargetDate: string; requiredSizes: string[]; description: string;
  constructionNotes: string; washNotes: string; trimDetails: string; brandingDetails: string; packagingNotes: string;
  specialInstructions: string; sizeSpecNotes: string; image: string; createdAt: string; createdBy: string;
  updatedAt: string; updatedBy: string; archived?: boolean;
}
export interface AppState {
  users: User[]; suppliers: Supplier[]; collections: Collection[]; categories: ProductCategory[];
  templates: StageTemplate[]; samples: Sample[]; stages: SampleStage[]; sizeRuns: SampleSizeRunItem[];
  tasks: SampleTask[]; files: SampleFile[]; approvals: SampleApproval[]; activities: SampleActivityLog[];
  sizeSpecs: SizeSpecRow[];
}
