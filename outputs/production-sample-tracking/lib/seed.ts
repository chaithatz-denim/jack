import { AppState, Sample, SampleStage, StageStatus } from "./types";

export const currentUserId = "u-admin";
export const users = [
  { id: "u-admin", name: "Narin Vongchai", initials: "NV", role: "ADMIN" as const, team: "Production Operations" },
  { id: "u-pm", name: "Maya Chen", initials: "MC", role: "PRODUCT_MANAGER" as const, team: "Product" },
  { id: "u-merch", name: "Anong Srisuk", initials: "AS", role: "MERCHANDISER" as const, team: "Merchandising" },
  { id: "u-qc", name: "Kittisak Boonmee", initials: "KB", role: "QC" as const, team: "Quality Control" },
  { id: "u-factory", name: "Somchai Prasert", initials: "SP", role: "FACTORY" as const, team: "Eastern Denim Works" }
];
export const suppliers = [
  { id: "sup-1", name: "Eastern Denim Works", location: "Chonburi, Thailand", contact: "Somchai Prasert" },
  { id: "sup-2", name: "Siam Stitch Apparel", location: "Samut Prakan, Thailand", contact: "Pimlada K." },
  { id: "sup-3", name: "Lotus Rayon Studio", location: "Bangkok, Thailand", contact: "Thanawat C." }
];
export const templates = [
  ["Product Brief", 5, "PRODUCT_MANAGER", false, false, false, 2],
  ["Material & Trim Confirmation", 10, "MERCHANDISER", true, false, false, 4],
  ["Pattern / Size Spec Setup", 10, "MERCHANDISER", true, false, false, 4],
  ["First Sample Production", 15, "FACTORY", false, false, false, 7],
  ["First Sample QC Review", 10, "QC", true, true, false, 2],
  ["Revision Required", 0, "MERCHANDISER", false, false, false, 3],
  ["Size Run Sample Production", 15, "FACTORY", false, false, false, 7],
  ["Size Run QC Review", 15, "QC", true, true, false, 3],
  ["Final Sample Approval", 10, "PRODUCT_MANAGER", true, true, false, 2],
  ["Bulk Approval", 10, "ADMIN", true, true, false, 2]
].map((row, i) => ({
  id: `tpl-${i + 1}`, name: row[0] as string, order: i + 1, weight: row[1] as number, enabled: true,
  defaultRole: row[2] as import("./types").Role, requiredAttachments: i === 2 ? ["Size Spec Sheet"] : [],
  requiresReview: row[3] as boolean, requiresApproval: row[4] as boolean, isSkippable: row[5] as boolean,
  approveNextId: i < 9 ? `tpl-${i + 2}` : undefined, rejectReturnId: i === 4 ? "tpl-4" : i === 7 ? "tpl-7" : undefined,
  slaDays: row[6] as number
}));

const productRows = [
  ["SMP-2026-0048", "J-RIM8 Slim Fit", "JR-SS26-018", "Denim", "Summer Archive 26", "sup-1", "tpl-7", "SIZE RUN IN PROGRESS", "HIGH", "Indigo Rinse", "#26364A"],
  ["SMP-2026-0047", "J-FOX Cargo", "JR-SS26-014", "Pants", "Utility Core 26", "sup-2", "tpl-5", "WAITING FOR QC", "URGENT", "Washed Black", "#26272A"],
  ["SMP-2026-0046", "J-NORM Vintage Midnight Blue Rust Fade", "JR-AW26-006", "Denim", "Autumn Rust 26", "sup-1", "tpl-6", "REVISION REQUIRED", "HIGH", "Midnight Rust", "#172334"],
  ["SMP-2026-0045", "Denim Jacket Indigo Fade", "JR-AW26-003", "Jackets", "Autumn Rust 26", "sup-1", "tpl-9", "WAITING FOR APPROVAL", "NORMAL", "Indigo Fade", "#36516D"],
  ["SMP-2026-0044", "Heavyweight Graphic Tee", "JR-SS26-009", "T-Shirts", "Summer Archive 26", "sup-2", "tpl-2", "IN PROGRESS", "NORMAL", "Bone White", "#DDD8CA"],
  ["SMP-2026-0043", "Black Cargo Pants", "JR-CORE-031", "Pants", "Utility Core 26", "sup-2", "tpl-10", "APPROVED FOR BULK", "NORMAL", "Jet Black", "#17191B"],
  ["SMP-2026-0042", "Hawaiian Rayon Shirt", "JR-SS26-002", "Shirts", "Summer Archive 26", "sup-3", "tpl-4", "OVERDUE", "HIGH", "Night Palm", "#183E3B"]
] as const;

export const samples: Sample[] = productRows.map((r, i) => ({
  id: `s-${i + 1}`, sampleCode: r[0], productName: r[1], styleCode: r[2], category: r[3], gender: "Unisex",
  collection: r[4], season: "2026", colorName: r[9], colorCode: r[10], fitType: i === 0 ? "Slim" : "Relaxed",
  fabricComposition: i === 4 ? "100% compact cotton jersey" : "99% cotton / 1% elastane", fabricWeight: i === 4 ? "260 GSM" : "13.5 oz",
  supplierId: r[5], targetCost: 940 + i * 75, targetRetailPrice: 3290 + i * 250, plannedLaunchDate: "2026-09-15",
  sampleType: "Development Sample", priority: r[8], status: r[7], currentStageId: `s-${i + 1}-${r[6]}`,
  primaryAssigneeId: "u-merch", qcAssigneeId: "u-qc", factoryContact: suppliers.find((s) => s.id === r[5])!.contact,
  firstSampleDueDate: i === 6 ? "2026-06-16" : "2026-06-28", finalApprovalDueDate: "2026-07-15", bulkApprovalTargetDate: "2026-07-22",
  requiredSizes: ["28", "30", "32", "34", "36"], description: `${r[1]} development sample for line review and production validation.`,
  constructionNotes: "Reinforce stress points with bartacks; maintain clean chain-stitch alignment.", washNotes: "Match approved shade band under D65 lighting.",
  trimDetails: "Antique nickel hardware, YKK zipper and branded tack button.", brandingDetails: "JACK RUSSEL woven label at center back.",
  packagingNotes: "Fold with recycled tissue and size sticker.", specialInstructions: "Do not bulk cut before written approval.",
  sizeSpecNotes: "Grade from approved size 32 base pattern.", image: `linear-gradient(145deg, ${r[10]}, #7b8793)`,
  createdAt: "2026-05-28T09:30:00Z", createdBy: "u-pm", updatedAt: `2026-06-${20 - i}T0${8 + i}:30:00Z`, updatedBy: "u-merch"
}));

function statusesFor(currentOrder: number, revision: boolean, approvedBulk: boolean): StageStatus[] {
  return templates.map((t) => {
    if (approvedBulk) return t.name === "Revision Required" ? "NOT STARTED" : "APPROVED";
    if (revision && t.name === "First Sample QC Review") return "REJECTED";
    if (revision && t.name === "Revision Required") return "REVISION REQUIRED";
    if (t.name === "Revision Required") return "NOT STARTED";
    if (t.order < currentOrder) return "APPROVED";
    if (t.order === currentOrder) return t.requiresReview ? "WAITING FOR REVIEW" : "IN PROGRESS";
    return "NOT STARTED";
  });
}

export const stages: SampleStage[] = samples.flatMap((sample) => {
  const currentOrder = Number(sample.currentStageId.split("tpl-")[1]);
  const sts = statusesFor(currentOrder, sample.status === "REVISION REQUIRED", sample.status === "APPROVED FOR BULK");
  return templates.map((t, i) => ({ ...t, id: `${sample.id}-${t.id}`, sampleId: sample.id, status: sts[i],
    assigneeId: t.defaultRole === "QC" ? "u-qc" : t.defaultRole === "FACTORY" ? "u-factory" : "u-merch",
    startDate: t.order <= currentOrder ? `2026-06-${String(2 + i).padStart(2, "0")}` : undefined,
    dueDate: `2026-06-${String(5 + i * 2).padStart(2, "0")}`, completedDate: t.order < currentOrder ? `2026-06-${String(4 + i).padStart(2, "0")}` : undefined,
    actualDuration: t.order < currentOrder ? Math.max(1, t.slaDays - 1) : undefined,
    notes: t.name.includes("Size Run") ? "Confirm grading across all required sizes before approval." : "Stage owner to attach evidence before completion.",
    attachments: t.order <= Math.min(currentOrder, 4) ? [`${t.name.toLowerCase().replaceAll(" ", "-")}.pdf`] : [],
    rejectionReason: sample.status === "REVISION REQUIRED" && t.name === "First Sample QC Review" ? "Waist is 1.2 cm over tolerance; front rise shape must be corrected." : undefined
  }));
});

export const seedState: AppState = {
  users, suppliers, templates, samples, stages,
  collections: [{ id: "c1", name: "Summer Archive 26", season: "SS26" }, { id: "c2", name: "Utility Core 26", season: "CORE26" }, { id: "c3", name: "Autumn Rust 26", season: "AW26" }],
  categories: ["Denim", "Pants", "Jackets", "T-Shirts", "Shirts"].map((name, i) => ({ id: `cat-${i}`, name })),
  sizeRuns: ["28", "30", "32", "34", "36"].map((size, i) => ({ id: `sr-${size}`, sampleId: "s-1", size, status: i < 2 ? "APPROVED" : i < 4 ? "SUBMITTED" : "IN PROGRESS", submittedDate: i < 4 ? "2026-06-18" : undefined, reviewDate: i < 2 ? "2026-06-19" : undefined, reviewedBy: i < 2 ? "u-qc" : undefined, approvalResult: i < 2 ? "PASS" : undefined, measurementNotes: "Actual measurements uploaded by factory.", qcNotes: i < 2 ? "Within approved tolerance." : "Awaiting QC review.", attachments: i < 4 ? [`size-${size}-measurement.xlsx`] : [] })),
  tasks: [
    { id: "task-1", sampleId: "s-1", name: "Review size 32 measurements", stageId: "s-1-tpl-7", assignedTo: "u-admin", priority: "HIGH", dueDate: "2026-06-21", status: "IN PROGRESS", createdBy: "u-pm", updatedAt: "2026-06-20T10:00:00Z", comments: [] },
    { id: "task-2", sampleId: "s-3", name: "Confirm revised waist pattern", stageId: "s-3-tpl-6", assignedTo: "u-admin", priority: "URGENT", dueDate: "2026-06-19", status: "BLOCKED", createdBy: "u-pm", updatedAt: "2026-06-20T14:00:00Z", comments: ["Waiting for factory CAD file."] },
    { id: "task-3", sampleId: "s-4", name: "Prepare final approval memo", stageId: "s-4-tpl-9", assignedTo: "u-admin", priority: "NORMAL", dueDate: "2026-06-24", status: "TODO", createdBy: "u-pm", updatedAt: "2026-06-18T09:00:00Z", comments: [] },
    { id: "task-4", sampleId: "s-6", name: "Release approved bulk spec", stageId: "s-6-tpl-10", assignedTo: "u-admin", priority: "NORMAL", dueDate: "2026-06-18", status: "DONE", createdBy: "u-pm", updatedAt: "2026-06-18T16:00:00Z", comments: [] }
  ],
  files: [
    { id: "f1", sampleId: "s-1", name: "JR-SS26-018_TechPack.pdf", category: "Tech Pack", uploadedBy: "u-merch", uploadedAt: "2026-06-05", version: 3, size: "4.8 MB", versions: ["v1", "v2", "v3"] },
    { id: "f2", sampleId: "s-1", name: "J-RIM8_SizeSpec.xlsx", category: "Size Spec", uploadedBy: "u-pm", uploadedAt: "2026-06-15", version: 2, size: "680 KB", versions: ["v1", "v2"] },
    { id: "f3", sampleId: "s-1", name: "first-sample-front.jpg", category: "Sample Photos", uploadedBy: "u-factory", uploadedAt: "2026-06-11", version: 1, size: "2.1 MB", versions: ["v1"] }
  ],
  approvals: [
    { id: "a1", sampleId: "s-1", stageId: "s-1-tpl-5", type: "First Sample QC Review", status: "APPROVED", submittedBy: "u-merch", submittedAt: "2026-06-12", reviewerId: "u-qc", reviewedAt: "2026-06-13", comment: "Construction approved for size run.", checklist: ["Construction", "Wash shade", "Measurements"], attachments: ["qc-front.jpg"], history: ["Submitted 12 Jun", "Approved 13 Jun"] },
    { id: "a2", sampleId: "s-1", stageId: "s-1-tpl-8", type: "Size Run QC Review", status: "PENDING", submittedBy: "u-merch", submittedAt: "2026-06-20", reviewerId: "u-qc", checklist: ["All required sizes", "Grade rules", "Tolerance"], attachments: [], history: ["Submitted 20 Jun"] }
  ],
  activities: [
    { id: "log-1", sampleId: "s-1", stageId: "s-1-tpl-7", userId: "u-merch", actionType: "DUE_DATE_CHANGED", beforeValue: "10 Jun 2026", afterValue: "14 Jun 2026", comment: "Factory requested two additional working days.", createdAt: "2026-06-10T09:24:00Z" },
    { id: "log-2", sampleId: "s-1", stageId: "s-1-tpl-4", userId: "u-factory", actionType: "FILE_UPLOADED", afterValue: "first-sample-front.jpg", comment: "Uploaded first sample front and back views.", attachmentReference: "first-sample-front.jpg", createdAt: "2026-06-11T15:12:00Z" },
    { id: "log-3", sampleId: "s-1", stageId: "s-1-tpl-5", userId: "u-qc", actionType: "QC_APPROVED", beforeValue: "WAITING FOR REVIEW", afterValue: "APPROVED", comment: "Construction and base size are within tolerance.", createdAt: "2026-06-13T11:45:00Z" }
  ],
  sizeSpecs: [
    ["Waist", "Along top edge", 0.7, [74, 79, 84, 89, 94]], ["Hip", "20 cm below waistband", 1, [92, 97, 102, 107, 112]],
    ["Thigh", "2.5 cm below crotch", 0.7, [56, 58, 60, 62, 64]], ["Knee", "35 cm below crotch", 0.5, [39, 40, 41, 42, 43]],
    ["Leg Opening", "Straight across hem", 0.5, [31, 32, 33, 34, 35]], ["Front Rise", "Including waistband", 0.5, [25, 25.5, 26, 26.5, 27]],
    ["Back Rise", "Including waistband", 0.5, [35, 35.5, 36, 36.5, 37]], ["Inseam", "Crotch to hem", 0.7, [79, 79, 79, 79, 79]],
    ["Outseam", "Top edge to hem", 1, [103, 104, 105, 106, 107]]
  ].map((r, i) => ({ id: `spec-${i}`, point: r[0] as string, description: r[1] as string, tolerance: r[2] as number, values: Object.fromEntries(["28", "30", "32", "34", "36"].map((s, x) => [s, (r[3] as number[])[x]])), actual: Object.fromEntries(["28", "30", "32", "34", "36"].map((s, x) => [s, (r[3] as number[])[x] + (x === 2 ? 0.8 : 0.2)])), notes: i === 0 ? "Waist measured relaxed" : "" }))
};
