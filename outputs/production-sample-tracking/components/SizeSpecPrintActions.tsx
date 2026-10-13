"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";

type PrintAction = "export" | "print";

export function SizeSpecPrintActions({ sampleId, modelId, initialAction }: { sampleId: string; modelId: string; initialAction?: PrintAction }) {
  const [exporting, setExporting] = useState(false);
  const hasRunInitialAction = useRef(false);

  const exportPdf = useCallback(async () => {
    const target = document.getElementById("size-spec");
    if (!target || exporting) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        logging: false,
        scale: 2,
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      const margin = 8;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", (pageWidth - width) / 2, margin, width, height, undefined, "FAST");
      const safeName = (modelId || sampleId).replace(/[^a-zA-Z0-9ก-๙_-]+/g, "-");
      pdf.save(`size-spec-${safeName}.pdf`);
    } catch {
      window.alert("ไม่สามารถสร้างไฟล์ PDF ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setExporting(false);
    }
  }, [exporting, modelId, sampleId]);

  useEffect(() => {
    if (!initialAction || hasRunInitialAction.current) return;
    hasRunInitialAction.current = true;
    const timer = window.setTimeout(() => {
      if (initialAction === "export") void exportPdf();
      else window.print();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [exportPdf, initialAction]);

  return <div className="print-route-actions">
    <Link className="btn" href={`/samples/${sampleId}?tab=size-spec`}><ArrowLeft size={14}/> กลับไปตารางไซซ์สเปก</Link>
    <div className="print-route-action-group">
      <button className="btn" type="button" disabled={exporting} onClick={() => void exportPdf()}><Download size={14}/> {exporting ? "กำลัง Export..." : "Export"}</button>
      <button className="btn primary" type="button" onClick={() => window.print()}><Printer size={14}/> Print</button>
    </div>
  </div>;
}
