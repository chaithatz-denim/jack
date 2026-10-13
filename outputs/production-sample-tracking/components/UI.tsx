"use client";

import { AlertTriangle, CalendarClock, FileClock } from "lucide-react";
import { ReactNode, useEffect } from "react";
import { SampleStatus, StageStatus } from "@/lib/types";
import { calculateSampleProgress, completedStageCount } from "@/lib/workflow";
import { useStore } from "@/lib/store";
import { formatShortDateBangkok, isBeforeTodayBangkok } from "@/lib/time";

export function StatusBadge({ status }: { status: SampleStatus | StageStatus | string }) {
  const cls = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`badge ${cls}`}><i/>{status}</span>;
}

export function ProgressBar({ sampleId, compact = false }: { sampleId: string; compact?: boolean }) {
  const { state } = useStore();
  const stages = state.stages.filter((s) => s.sampleId === sampleId && s.enabled);
  const progress = calculateSampleProgress(stages);
  const completed = completedStageCount(stages);
  return <div className={`progress-wrap ${compact ? "compact" : ""}`}>
    <div className="progress-copy"><b>{progress}%</b><span>{completed} / {stages.length} stages</span></div>
    <div className="progress-track"><i style={{ width: `${progress}%` }}/></div>
  </div>;
}

export function UserAvatar({ id, showName = true }: { id?: string; showName?: boolean }) {
  const { state } = useStore();
  const user = state.users.find((item) => item.id === id);
  if (!user) return <span className="muted">Unassigned</span>;
  return <span className="avatar-name"><i className="avatar small">{user.initials}</i>{showName && user.name}</span>;
}

export function DueDate({ date }: { date: string }) {
  const overdue = isBeforeTodayBangkok(date);
  return <span className={overdue ? "due overdue" : "due"}><CalendarClock size={14}/>{formatShortDateBangkok(date)}{overdue && <small>OVERDUE</small>}</span>;
}

export function Metric({ label, value, note, tone = "" }: { label: string; value: ReactNode; note?: string; tone?: string }) {
  return <div className={`metric ${tone}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, actions, updater = true }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode; updater?: boolean }) {
  return <div className="page-head">
    <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    <div className="actions">{updater && <span className="editing"><i className="live"/>Currently updating by <b>Supabase</b></span>}{actions}</div>
  </div>;
}

export function EmptyState({ title, text }: { title: ReactNode; text: ReactNode }) {
  return <div className="empty"><FileClock size={28}/><b>{title}</b><p>{text}</p></div>;
}

export function SkeletonRows() {
  return <div className="skeletons">{Array.from({ length: 6 }).map((_, i) => <i key={i}/>)}</div>;
}

export function Modal({ open, title, children, onClose, footer }: { open: boolean; title: string; children: ReactNode; onClose(): void; footer: ReactNode }) {
  useEffect(() => {
    const fn = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head"><h2 id="modal-title">{title}</h2><button type="button" onClick={onClose}>×</button></div>
      <div className="modal-body">{children}</div>
      <div className="modal-foot">{footer}</div>
    </section>
  </div>;
}

export function Alert({ children, tone = "warning" }: { children: ReactNode; tone?: "warning" | "danger" | "info" }) {
  return <div className={`alert ${tone}`}><AlertTriangle size={18}/><div>{children}</div></div>;
}

export function ActionButton({ children, primary, danger, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean }) {
  return <button type="button" className={`btn ${primary ? "primary" : ""} ${danger ? "danger" : ""}`} {...props}>{children}</button>;
}
