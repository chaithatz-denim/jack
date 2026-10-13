"use client";

import { useEffect, useMemo, useState } from "react";
import { saveAllSizeSpecsAction, saveBlockTechnicalDataAction } from "@/lib/supabase/actions";
import type { BlockTechnicalData, SizeSpecRow } from "@/lib/supabase/data";

type SpecUnit = "fraction" | "decimal" | "cm";

const numericSizes = ["29", "30", "31", "32", "33", "34", "36", "38"];
const letterSizes = ["XS", "S", "M", "L", "XL", "2XL"];

const thaiSpecRows = [
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

const englishSpecRows = [
  ["Waist", "Measure along the top waistband", "± 0.5"],
  ["Hip", "Measure around hip circumference", "± 0.5"],
  ["Front rise", "Measure from front waistband to crotch", "± 0.25"],
  ["Back rise", "Measure from back waistband to crotch", "± 0.25"],
  ["Thigh", "Measure thigh circumference below crotch", "± 0.25"],
  ["Knee", "Measure knee circumference", "± 0.25"],
  ["Leg opening", "Measure leg opening circumference", "± 0.25"],
  ["Inseam", "Measure from crotch to leg opening", "± 0.5"],
  ["Outseam", "Measure from waistband to leg opening", "± 0.5"],
  ["Back pocket width", "Measure from the left to right edge of the back pocket", "± 0.125"],
  ["Back pocket length", "Measure from the top edge to the bottom of the back pocket", "± 0.125"],
] as const;

const pointMap: Record<string, string> = {
  waist: "เอว",
  hip: "สะโพก",
  hips: "สะโพก",
  "front rise": "เป้าหน้า",
  "back rise": "เป้าหลัง",
  thigh: "ต้นขา",
  knee: "เข่า",
  hem: "ปลายขา",
  "leg opening": "ปลายขา",
  inseam: "ขาใน",
  outseam: "ยาวทั้งตัว",
  length: "ยาวทั้งตัว",
  "back pocket width": "กระเป๋าหลัง (กว้าง)",
  "back pocket length": "กระเป๋าหลัง (ยาว)",
};

const descriptionMap: Record<string, string> = {
  "relaxed waistband": "วัดรอบเอวตามขอบบน",
  "hip circumference": "วัดรอบสะโพก",
  "front rise": "วัดจากขอบเอวหน้าถึงเป้า",
  "back rise": "วัดจากขอบเอวหลังถึงเป้า",
  "thigh circumference": "วัดรอบต้นขาใต้เป้า",
  "knee circumference": "วัดรอบเข่า",
  "leg opening": "วัดรอบปลายขา",
  inseam: "วัดจากเป้าถึงปลายขา",
  outseam: "วัดจากขอบเอวถึงปลายขา",
  "back pocket width": "วัดจากริมซ้ายถึงริมขวาของกระเป๋าหลัง",
  "back pocket length": "วัดจากขอบบนถึงปลายกระเป๋าหลัง",
};

const fractionOptions = [
  ["0", "—"],
  ["0.125", "⅛"],
  ["0.25", "¼"],
  ["0.375", "⅜"],
  ["0.5", "½"],
  ["0.625", "⅝"],
  ["0.75", "¾"],
  ["0.875", "⅞"],
] as const;

const unicodeFractionValues: Record<string, number> = {
  "⅛": 0.125,
  "¼": 0.25,
  "⅜": 0.375,
  "½": 0.5,
  "⅝": 0.625,
  "¾": 0.75,
  "⅞": 0.875,
};

const textFractionValues: Record<string, number> = {
  "1/8": 0.125,
  "1/4": 0.25,
  "3/8": 0.375,
  "1/2": 0.5,
  "5/8": 0.625,
  "3/4": 0.75,
  "7/8": 0.875,
};

function isBrokenText(value: string | null | undefined) {
  const text = value ?? "";
  return !text.trim() || /\?{2,}|เธ|เน€|โ€|ย[ฑท]/.test(text);
}

function readLanguage() {
  if (typeof document === "undefined") return "th";
  return document.body.dataset.lang === "en" ? "en" : "th";
}

function thaiPoint(row: SizeSpecRow, index: number) {
  if (isBrokenText(row.measurement_point)) return thaiSpecRows[index % thaiSpecRows.length][0];
  const key = row.measurement_point.trim().toLowerCase();
  return pointMap[key] ?? row.measurement_point;
}

function measurementPointRank(row: SizeSpecRow, index: number) {
  const point = thaiPoint(row, index).trim().toLowerCase();
  const rank = thaiSpecRows.findIndex(([expected]) => expected.toLowerCase() === point);
  return rank >= 0 ? rank : thaiSpecRows.length + index;
}

function englishPoint(row: SizeSpecRow, index: number) {
  if (isBrokenText(row.measurement_point)) return englishSpecRows[index % englishSpecRows.length][0];
  const thaiIndex = thaiSpecRows.findIndex(([point]) => point === row.measurement_point);
  if (thaiIndex >= 0) return englishSpecRows[thaiIndex][0];
  const key = row.measurement_point.trim().toLowerCase();
  return key in pointMap ? englishSpecRows[index % englishSpecRows.length][0] : row.measurement_point;
}

function thaiDescription(row: SizeSpecRow, index: number) {
  if (isBrokenText(row.description)) return thaiSpecRows[index % thaiSpecRows.length][1];
  const key = (row.description ?? "").trim().toLowerCase();
  return descriptionMap[key] ?? row.description ?? thaiSpecRows[index % thaiSpecRows.length][1];
}

function englishDescription(row: SizeSpecRow, index: number) {
  if (isBrokenText(row.description)) return englishSpecRows[index % englishSpecRows.length][1];
  const thaiIndex = thaiSpecRows.findIndex(([, description]) => description === row.description);
  if (thaiIndex >= 0) return englishSpecRows[thaiIndex][1];
  const key = (row.description ?? "").trim().toLowerCase();
  return key in descriptionMap ? englishSpecRows[index % englishSpecRows.length][1] : row.description ?? englishSpecRows[index % englishSpecRows.length][1];
}

function thaiTolerance(row: SizeSpecRow, index: number) {
  if (isBrokenText(row.tolerance)) return thaiSpecRows[index % thaiSpecRows.length][2];
  return (row.tolerance ?? thaiSpecRows[index % thaiSpecRows.length][2]).replace(/^\?\s*/, "± ");
}

function decimalFromTolerance(value: string) {
  const cleaned = value
    .replace(/±|\+\/-/g, "")
    .replace(/นิ้ว|เซ็นติเมตร|ซม\.?|cm|in/gi, "")
    .trim();
  return decimalFromRaw(cleaned);
}

function decimalFromRaw(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "")
    .replace(/±|ยฑ|\+\/-/g, "")
    .replace(/นิ้ว|เซ็นติเมตร|ซม\.?|cm|in/gi, "")
    .replace(/(\d)\s*-\s*(?=\d+\/\d+)/g, "$1 ")
    .trim();
  if (!raw) return 0;
  const unicodeFraction = raw.match(/^(\d+(?:\.\d+)?)?\s*(⅛|¼|⅜|½|⅝|¾|⅞)$/);
  if (unicodeFraction) {
    const whole = Number(unicodeFraction[1] || 0);
    return whole + unicodeFractionValues[unicodeFraction[2]];
  }
  const textFraction = raw.match(/^(\d+)?\s*(1\/8|1\/4|3\/8|1\/2|5\/8|3\/4|7\/8)$/);
  if (textFraction) {
    const whole = Number(textFraction[1] || 0);
    return whole + textFractionValues[textFraction[2]];
  }
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function nearestFraction(decimal: number) {
  const whole = Math.floor(decimal);
  const fraction = decimal - whole;
  const options = fractionOptions.map(([value]) => Number(value));
  const nearest = options.reduce((best, next) => Math.abs(next - fraction) < Math.abs(best - fraction) ? next : best, 0);
  const adjustedWhole = nearest >= 1 ? whole + 1 : whole;
  return { whole: String(adjustedWhole), fraction: String(nearest >= 1 ? 0 : nearest) };
}

function formatDecimal(value: number) {
  if (!value) return "";
  return value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
}

function formatFraction(value: number) {
  if (!value) return "";
  const fraction = nearestFraction(value);
  const fractionLabel = fractionOptions.find(([option]) => option === fraction.fraction)?.[1];
  const whole = fraction.whole === "0" ? "" : fraction.whole;
  const part = fractionLabel === "—" ? "" : fractionLabel ?? "";
  return [whole, part].filter(Boolean).join(" ");
}

function SpecMeasureInput({ name, value, unit, formId, disabled = false }: { name: string; value: string; unit: SpecUnit; formId: string; disabled?: boolean }) {
  const [decimalValue, setDecimalValue] = useState(decimalFromRaw(value));
  const [fractionDraft, setFractionDraft] = useState(() => formatFraction(decimalFromRaw(value)));

  useEffect(() => {
    if (unit === "fraction") setFractionDraft(formatFraction(decimalValue));
  }, [unit, decimalValue]);

  if (unit === "fraction") {
    const submittedValue = decimalFromRaw(fractionDraft);
    return <div className="spec-measure spec-measure-combined">
      <input type="hidden" form={formId} name={name} value={formatDecimal(submittedValue)}/>
      <input
        className="spec-value spec-fraction-combined"
        inputMode="text"
        disabled={disabled}
        value={fractionDraft}
        placeholder="30 ½"
        onChange={(event) => setFractionDraft(event.target.value)}
        onBlur={() => {
          setDecimalValue(submittedValue);
          setFractionDraft(formatFraction(submittedValue));
        }}
        aria-label={`${name} inch fraction`}
      />
      <span className="spec-inch">in</span>
    </div>;
  }

  if (unit === "cm") {
    const cmValue = decimalValue ? Math.round(decimalValue * 2.54) : "";
    return <>
      <input type="hidden" form={formId} name={name} value={formatDecimal(decimalValue)}/>
      <input className="spec-value" inputMode="numeric" disabled={disabled} value={cmValue} onChange={(event) => setDecimalValue(Number(event.target.value || 0) / 2.54)} aria-label={`${name} centimeter`}/>
    </>;
  }

  return <input className="spec-value" form={formId} name={name} inputMode="decimal" disabled={disabled} value={formatDecimal(decimalValue)} onChange={(event) => setDecimalValue(decimalFromRaw(event.target.value))} aria-label={`${name} decimal inch`}/>;
}

type SizeSpecPanelProps = {
  sampleId: string;
  modelId: string;
  blockId: string;
  sizeMode: string | null;
  specs: SizeSpecRow[];
  blockTechnical: BlockTechnicalData;
  canEditSpecs: boolean;
  canEditBlockTechnical: boolean;
  isPrototypePreview?: boolean;
};

export function SizeSpecPanel({ sampleId, modelId, blockId, sizeMode, specs, blockTechnical, canEditSpecs, canEditBlockTechnical, isPrototypePreview = false }: SizeSpecPanelProps) {
  const [unit, setUnit] = useState<SpecUnit>("fraction");
  const [language, setLanguage] = useState("th");
  const sizes = sizeMode === "letter" ? letterSizes : numericSizes;
  const rows = useMemo<SizeSpecRow[]>(() => {
    const baseRows = thaiSpecRows.map(([measurementPoint, description, tolerance], index) => specs[index] ?? ({
        id: `new-${index}`,
        sample_id: sampleId,
        measurement_point: measurementPoint,
        description,
        tolerance,
        values: Object.fromEntries(sizes.map((size) => [size, ""])),
        created_by: null,
        updated_by: null,
        created_at: "",
        updated_at: "",
      }));
    return baseRows
      .map((row, index) => ({ row, rank: measurementPointRank(row, index) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ row }) => row);
  }, [sampleId, sizes, specs]);
  const formId = "size-spec-bulk-form";
  const unitLabel = language === "en"
    ? unit === "fraction" ? "Current unit: inch · fraction" : unit === "decimal" ? "Current unit: inch · decimal" : "Current unit: centimeter · no decimal"
    : unit === "fraction" ? "หน่วยปัจจุบัน: นิ้ว · เศษส่วน" : unit === "decimal" ? "หน่วยปัจจุบัน: นิ้ว · ทศนิยม" : "หน่วยปัจจุบัน: เซ็นติเมตร · ไม่มีทศนิยม";
  const helpText = unit === "fraction"
    ? language === "en" ? "Input format: whole number + fraction ¼, ⅜, ½, ⅝, or ⅞ inch" : "รูปแบบการกรอก: เลขเต็ม + เศษส่วน ¼, ⅜, ½, ⅝ หรือ ⅞ นิ้ว"
    : unit === "decimal"
      ? language === "en" ? "Input format: decimal inch, e.g. 30.50" : "รูปแบบการกรอก: นิ้วแบบทศนิยม เช่น 30.50"
      : language === "en" ? "Input format: centimeter with no decimal, e.g. 78" : "รูปแบบการกรอก: เซ็นติเมตรแบบไม่มีทศนิยม เช่น 78";

  useEffect(() => {
    setLanguage(readLanguage());
    const observer = new MutationObserver(() => setLanguage(readLanguage()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, []);

  function storePrototypePrintPreview() {
    if (!isPrototypePreview) return;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const values = Object.fromEntries(Array.from(new FormData(form).entries()).map(([key, value]) => [key, String(value)]));
    window.sessionStorage.setItem(`size-spec-print-preview:${sampleId}`, JSON.stringify(values));
  }

  return <section id="size-spec" className="panel">
    <header className="size-spec-print-head">
      <span>{language === "en" ? "Model" : "ชื่อรุ่น"}</span>
      <h1>{modelId || "—"}</h1>
      <p>{language === "en" ? "Size specification" : "ตารางไซซ์สเปก"}</p>
    </header>
    <div className="panel-head">
      <div>
        <h2>{language === "en" ? "Size spec table" : "ตารางไซซ์สเปก"}</h2>
        <span className="spec-mode">{unitLabel}</span>
        <div className="spec-help"><b>{helpText.split(":")[0]}:</b>{helpText.slice(helpText.indexOf(":") + 1)}</div>
      </div>
      <div className="spec-output-actions">
        <a className="btn primary" href={`/samples/${sampleId}/print-size-spec?unit=${unit}`} onClick={storePrototypePrintPreview}>⇩ Export / Print</a>
      </div>
    </div>
    <div className="spec-controls">
      <div className="spec-unit-toggle" role="group" aria-label="Size specification unit">
        <button className={`btn ${unit === "fraction" ? "active" : ""}`} type="button" onClick={() => setUnit("fraction")}>{language === "en" ? "Inch · fraction" : "นิ้ว · เศษส่วน"}</button>
        <button className={`btn ${unit === "decimal" ? "active" : ""}`} type="button" onClick={() => setUnit("decimal")}>{language === "en" ? "Inch · decimal" : "นิ้ว · ทศนิยม"}</button>
        <button className={`btn ${unit === "cm" ? "active" : ""}`} type="button" onClick={() => setUnit("cm")}>{language === "en" ? "Centimeter" : "เซ็นติเมตร"}</button>
      </div>
    </div>
    <section className="block-technical-card" aria-label={language === "en" ? "Block technical data" : "ข้อมูลทางเทคนิคของบล็อค"}>
      <div className="block-technical-head">
        <div>
          <span className="eyebrow">BLOCK TECHNICAL DATA</span>
          <h3>{language === "en" ? `Block ID ${blockId || "—"}` : `รหัสบล็อค ${blockId || "—"}`}</h3>
        </div>
        {!canEditBlockTechnical && <span className="badge b-skip">{language === "en" ? "View only" : "ดูข้อมูลเท่านั้น"}</span>}
      </div>
      {canEditBlockTechnical ? <form action={saveBlockTechnicalDataAction.bind(null, sampleId)} className="block-technical-form" onSubmit={isPrototypePreview ? (event) => {
        event.preventDefault();
        window.alert(language === "en" ? "Prototype test completed. Data was not saved to Supabase." : "ทดสอบการกรอกสำเร็จ โหมด Prototype จะไม่บันทึกข้อมูลลง Supabase");
      } : undefined}>
        <label className="field">
          <span>{language === "en" ? "Fabric shrinkage" : "ค่าหดตัวของผ้า"}</span>
          <input name="fabric_shrinkage" defaultValue={blockTechnical.fabricShrinkage} placeholder={language === "en" ? "e.g. Length -3% / Width -2%" : "เช่น แนวยาว -3% / แนวกว้าง -2%"}/>
        </label>
        <label className="field">
          <span>{language === "en" ? "Fabric consumption" : "กินผ้า"}</span>
          <input name="fabric_consumption" defaultValue={blockTechnical.fabricConsumption} placeholder={language === "en" ? "e.g. 1.35 yd / piece" : "เช่น 1.35 หลา / ตัว"}/>
        </label>
        <label className="field block-note-field">
          <span>{language === "en" ? "Block note" : "หมายเหตุประจำรหัสบล็อค"}</span>
          <textarea name="block_note" rows={2} defaultValue={blockTechnical.note} placeholder={language === "en" ? "Pattern-specific note for this Block ID" : "หมายเหตุของช่างแพทเทิร์นสำหรับรหัสบล็อคนี้"}/>
        </label>
        <button className="btn primary" type="submit">{language === "en" ? "Save block data" : "บันทึกข้อมูลบล็อค"}</button>
      </form> : <div className="block-technical-readonly">
        <div><span>{language === "en" ? "Fabric shrinkage" : "ค่าหดตัวของผ้า"}</span><b>{blockTechnical.fabricShrinkage || "—"}</b></div>
        <div><span>{language === "en" ? "Fabric consumption" : "กินผ้า"}</span><b>{blockTechnical.fabricConsumption || "—"}</b></div>
        <div><span>{language === "en" ? "Block note" : "หมายเหตุประจำรหัสบล็อค"}</span><b>{blockTechnical.note || "—"}</b></div>
      </div>}
    </section>
    <form
      id={formId}
      action={saveAllSizeSpecsAction.bind(null, sampleId)}
      onSubmit={(event) => {
        if (isPrototypePreview) {
          event.preventDefault();
          window.alert(language === "en" ? "Prototype test completed. Size Spec was not saved to Supabase." : "ทดสอบการกรอก Size Spec สำเร็จ โหมด Prototype จะไม่บันทึกข้อมูลลง Supabase");
          return;
        }
        if (!window.confirm(language === "en" ? "Confirm saving all size spec points?" : "ยืนยันบันทึก Size Spec ทุกจุดวัด?")) event.preventDefault();
      }}
    >
      <div className="table-wrap">
        <table className="data spec-table">
          <thead>
            <tr>
              <th className="spec-point">{language === "en" ? "Measurement point" : "จุดวัด"}</th>
              <th className="spec-description">{language === "en" ? "Measurement description" : "รายละเอียดการวัด"}</th>
              <th>{language === "en" ? "Tolerance" : "ค่าคลาดเคลื่อน"}</th>
              {sizes.map((size) => <th className="spec-size-head" key={size}>Size {size}<small>{unit === "cm" ? language === "en" ? "cm" : "ซม." : language === "en" ? "inch" : "นิ้ว"}</small></th>)}
            </tr>
          </thead>
          <tbody id="specRows">
            {rows.map((row, index) => {
              const values = typeof row.values === "object" && row.values ? row.values as Record<string, string> : {};
              return <tr key={row.id}>
                <td className="spec-point">
                  <input type="hidden" name="spec_id" value={row.id}/>
                  <input key={`${row.id}-${language}-point`} name={`measurement_point_${row.id}`} readOnly={!canEditSpecs} defaultValue={language === "en" ? englishPoint(row, index) : thaiPoint(row, index)}/>
                </td>
                <td className="spec-description"><input key={`${row.id}-${language}-description`} name={`description_${row.id}`} readOnly={!canEditSpecs} defaultValue={language === "en" ? englishDescription(row, index) : thaiDescription(row, index)}/></td>
                <td className="spec-tolerance-cell"><div className="spec-tolerance-control"><b>±</b><SpecMeasureInput formId={formId} name={`tolerance_${row.id}`} value={String(decimalFromTolerance(thaiTolerance(row, index)))} unit={unit} disabled={!canEditSpecs}/></div></td>
                {sizes.map((size) => <td key={size}><SpecMeasureInput formId={formId} name={`size_${row.id}_${size}`} value={values[size] ?? ""} unit={unit} disabled={!canEditSpecs}/></td>)}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {canEditSpecs ? <div className="spec-save-row">
        <button className="btn primary" type="submit">{language === "en" ? "Save all size specs" : "บันทึก Size Spec ทั้งหมด"}</button>
      </div> : <div className="spec-save-row"><span className="muted">{language === "en" ? "Size Spec can be edited by Admin and Mer." : "Admin และ Mer เป็นผู้แก้ไขตาราง Size Spec"}</span></div>}
    </form>
  </section>;
}
