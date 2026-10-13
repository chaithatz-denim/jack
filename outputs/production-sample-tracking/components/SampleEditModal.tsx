"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function SampleEditModal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    const focusTimer = window.setTimeout(() => {
      const firstField = document.querySelector<HTMLElement>("#edit-sample input, #edit-sample select, #edit-sample textarea");
      firstField?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return <>
    <button className="btn" type="button" onClick={() => setOpen(true)}>
      <Pencil size={14}/><span data-th>แก้ไขตัวอย่าง</span><span data-en>Edit sample</span>
    </button>
    {open && <div
      className="modal-backdrop sample-edit-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-sample-edit-close]")) setOpen(false);
      }}
    >
      {children}
    </div>}
  </>;
}
