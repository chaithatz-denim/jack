"use client";

import { Archive, Check, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ConfirmSubmitButtonProps = {
  labelTh: string;
  labelEn: string;
  messageTh: string;
  messageEn: string;
  className?: string;
};

function resubmitForm(form: HTMLFormElement, submitter: HTMLElement | null) {
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    submitter.click();
    return;
  }
  if (typeof form.requestSubmit === "function") {
    form.requestSubmit();
    return;
  }
  form.submit();
}

export function ConfirmSubmitButton({ labelTh, labelEn, messageTh, messageEn, className = "btn primary small" }: ConfirmSubmitButtonProps) {
  return <button
    className={className}
    type="submit"
    onClick={(event) => {
      const form = event.currentTarget.form;
      if (form && !form.checkValidity()) return;
      const language = document.body.dataset.lang === "en" ? "en" : "th";
      const message = language === "en" ? messageEn : messageTh;
      if (!window.confirm(message)) event.preventDefault();
    }}
  >
    <Check size={13}/> <span data-th>{labelTh}</span><span data-en>{labelEn}</span>
  </button>;
}

export function TimelineSubmitConfirm({ messageTh, messageEn }: Pick<ConfirmSubmitButtonProps, "messageTh" | "messageEn">) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitterRef = useRef<HTMLElement | null>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const language = typeof document !== "undefined" && document.body.dataset.lang === "en" ? "en" : "th";
  const message = language === "en" ? messageEn : messageTh;

  useEffect(() => {
    const form = markerRef.current?.closest("form");
    if (!form) return;
    formRef.current = form;

    const onSubmit = (event: SubmitEvent) => {
      if (allowSubmitRef.current) {
        allowSubmitRef.current = false;
        return;
      }
      event.preventDefault();
      submitterRef.current = event.submitter instanceof HTMLElement ? event.submitter : null;
      setOpen(true);
    };

    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("submit", onSubmit);
      if (formRef.current === form) formRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function confirmSubmit() {
    const form = formRef.current;
    if (!form) return;
    allowSubmitRef.current = true;
    setOpen(false);
    resubmitForm(form, submitterRef.current);
  }

  return <>
    <span ref={markerRef} hidden aria-hidden="true"/>
    {open && <div className="timeline-confirm-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="timeline-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="timeline-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="timeline-confirm-icon"><Check size={24}/></div>
        <div className="timeline-confirm-copy">
          <span className="timeline-confirm-kicker"><span data-th>Production Timeline</span><span data-en>Production Timeline</span></span>
          <h2 id="timeline-confirm-title"><span data-th>ยืนยันทำเสร็จ</span><span data-en>Confirm completion</span></h2>
          <p>{message}</p>
          <small><span data-th>ระบบจะบันทึกขั้นตอนนี้และอัพเดทสถานะงานต่อไป</span><span data-en>The system will save this stage and update the workflow status.</span></small>
        </div>
        <div className="timeline-confirm-actions">
          <button className="btn timeline-confirm-cancel" type="button" onClick={() => setOpen(false)}><span data-th>ยกเลิก</span><span data-en>Cancel</span></button>
          <button className="btn timeline-confirm-submit" type="button" onClick={confirmSubmit}><Check size={15}/><span data-th>ยืนยัน</span><span data-en>Confirm</span></button>
        </div>
      </section>
    </div>}
  </>;
}

export function SampleEditSubmitConfirm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitterRef = useRef<HTMLElement | null>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let activeForm: HTMLFormElement | null = null;
    const onSubmit = (event: SubmitEvent) => {
      if (allowSubmitRef.current) {
        allowSubmitRef.current = false;
        return;
      }
      event.preventDefault();
      formRef.current = activeForm;
      submitterRef.current = event.submitter instanceof HTMLElement ? event.submitter : null;
      setOpen(true);
    };

    const attachToEditForm = () => {
      const candidate = document.getElementById("edit-sample");
      const nextForm = candidate instanceof HTMLFormElement ? candidate : null;
      if (nextForm === activeForm) return;
      activeForm?.removeEventListener("submit", onSubmit);
      activeForm = nextForm;
      activeForm?.addEventListener("submit", onSubmit);
    };

    attachToEditForm();
    const observer = new MutationObserver(attachToEditForm);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      activeForm?.removeEventListener("submit", onSubmit);
      formRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function confirmSubmit() {
    const form = formRef.current;
    if (!form) return;
    allowSubmitRef.current = true;
    setOpen(false);
    resubmitForm(form, submitterRef.current);
  }

  return <>
    {open && <div className="timeline-confirm-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="timeline-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sample-edit-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="timeline-confirm-icon"><Save size={24}/></div>
        <div className="timeline-confirm-copy">
          <span className="timeline-confirm-kicker"><span data-th>Sample Detail</span><span data-en>Sample Detail</span></span>
          <h2 id="sample-edit-confirm-title"><span data-th>ยืนยันบันทึกการแก้ไข</span><span data-en>Confirm sample changes</span></h2>
          <p><span data-th>ยืนยันบันทึกข้อมูลตัวอย่างที่แก้ไข?</span><span data-en>Save the changes made to this sample?</span></p>
          <small><span data-th>ระบบจะอัพเดทข้อมูลตัวอย่างตามค่าที่กรอกไว้</span><span data-en>The sample will be updated with the entered information.</span></small>
        </div>
        <div className="timeline-confirm-actions">
          <button className="btn timeline-confirm-cancel" type="button" onClick={() => setOpen(false)}><span data-th>ยกเลิก</span><span data-en>Cancel</span></button>
          <button className="btn timeline-confirm-submit" type="button" onClick={confirmSubmit}><Save size={15}/><span data-th>ยืนยันบันทึก</span><span data-en>Confirm save</span></button>
        </div>
      </section>
    </div>}
  </>;
}

export function SampleDeleteConfirm({ sampleCode }: { sampleCode: string }) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitterRef = useRef<HTMLElement | null>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const language = typeof document !== "undefined" && document.body.dataset.lang === "en" ? "en" : "th";

  useEffect(() => {
    const form = markerRef.current?.closest("form");
    if (!form) return;
    formRef.current = form;

    const onSubmit = (event: SubmitEvent) => {
      if (allowSubmitRef.current) {
        allowSubmitRef.current = false;
        return;
      }
      event.preventDefault();
      submitterRef.current = event.submitter instanceof HTMLElement ? event.submitter : null;
      setOpen(true);
    };

    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("submit", onSubmit);
      if (formRef.current === form) formRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function confirmSubmit() {
    const form = formRef.current;
    if (!form) return;
    allowSubmitRef.current = true;
    setOpen(false);
    resubmitForm(form, submitterRef.current);
  }

  return <>
    <span ref={markerRef} hidden aria-hidden="true"/>
    {open && <div className="timeline-confirm-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="timeline-confirm-modal sample-delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="sample-delete-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="timeline-confirm-icon sample-delete-confirm-icon"><Archive size={24}/></div>
        <div className="timeline-confirm-copy">
          <span className="timeline-confirm-kicker"><span data-th>Samples</span><span data-en>Samples</span></span>
          <h2 id="sample-delete-confirm-title"><span data-th>ยืนยันลบรายการ</span><span data-en>Confirm delete</span></h2>
          <p>{language === "en" ? `Delete sample ${sampleCode}?` : `ยืนยันลบรายการ ${sampleCode}?`}</p>
          <small><span data-th>รายการนี้จะถูกซ่อนจากหน้า Samples และ Admin สามารถกู้คืนได้ใน Settings</span><span data-en>This sample will be hidden from Samples. Admins can restore it in Settings.</span></small>
        </div>
        <div className="timeline-confirm-actions">
          <button className="btn timeline-confirm-cancel" type="button" onClick={() => setOpen(false)}><span data-th>ยกเลิก</span><span data-en>Cancel</span></button>
          <button className="btn timeline-confirm-submit sample-delete-confirm-submit" type="button" onClick={confirmSubmit}><Archive size={15}/><span data-th>ยืนยันลบ</span><span data-en>Confirm delete</span></button>
        </div>
      </section>
    </div>}
  </>;
}
