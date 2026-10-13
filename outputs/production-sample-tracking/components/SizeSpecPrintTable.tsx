"use client";

import { useEffect, useState } from "react";

type PrintUnit = "fraction" | "decimal" | "cm";

type PrintRow = {
  id: string;
  measurementPoint: string;
  description: string;
  tolerance: string;
  values: Record<string, string>;
};

const fractionGlyphs: Array<[number, string]> = [
  [0, ""], [0.125, "⅛"], [0.25, "¼"], [0.375, "⅜"],
  [0.5, "½"], [0.625, "⅝"], [0.75, "¾"], [0.875, "⅞"],
];

const measurementPointOrder = ["เอว", "สะโพก", "เป้าหน้า", "เป้าหลัง", "ต้นขา", "เข่า", "ปลายขา", "ขาใน", "ยาวทั้งตัว"];

function measurementPointRank(point: string) {
  const normalized = point.trim().toLowerCase();
  const englishOrder: Record<string, number> = {
    waist: 0, hip: 1, hips: 1, "front rise": 2, "back rise": 3,
    thigh: 4, knee: 5, hem: 6, "leg opening": 6, inseam: 7,
    outseam: 8, length: 8,
  };
  const thaiRank = measurementPointOrder.findIndex((expected) => expected === normalized);
  return thaiRank >= 0 ? thaiRank : englishOrder[normalized] ?? measurementPointOrder.length;
}

function decimalValue(value: string | null | undefined) {
  const raw = String(value ?? "").replace(/±|\+\/-/g, "").trim();
  const unicode: Record<string, number> = { "⅛": .125, "¼": .25, "⅜": .375, "½": .5, "⅝": .625, "¾": .75, "⅞": .875 };
  const fraction = raw.match(/^(\d+(?:\.\d+)?)?\s*(⅛|¼|⅜|½|⅝|¾|⅞)$/);
  if (fraction) return Number(fraction[1] || 0) + unicode[fraction[2]];
  const numeric = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatValue(value: string | null | undefined, unit: PrintUnit) {
  const decimal = decimalValue(value);
  if (!decimal) return "";
  if (unit === "cm") return String(Math.round(decimal * 2.54));
  if (unit === "decimal") return decimal.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  const whole = Math.floor(decimal);
  const remainder = decimal - whole;
  const nearest = fractionGlyphs.reduce((best, next) => Math.abs(next[0] - remainder) < Math.abs(best[0] - remainder) ? next : best, fractionGlyphs[0]);
  return [whole || "", nearest[1]].filter(Boolean).join(" ");
}

export function SizeSpecPrintTable({ sampleId, sizes, unit, initialRows }: { sampleId: string; sizes: string[]; unit: PrintUnit; initialRows: PrintRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const unitLabel = unit === "cm" ? "ซม." : "นิ้ว";
  const printableRows = rows
    .filter((row) => {
      const point = row.measurementPoint.trim().toLowerCase();
      const isThaiBackPocketDimension = point.includes("กระเป๋าหลัง") && (point.includes("กว้าง") || point.includes("ยาว"));
      const isEnglishBackPocketDimension = point.includes("back pocket") && (point.includes("width") || point.includes("length"));
      return !isThaiBackPocketDimension && !isEnglishBackPocketDimension;
    })
    .sort((a, b) => measurementPointRank(a.measurementPoint) - measurementPointRank(b.measurementPoint));

  useEffect(() => {
    const raw = window.sessionStorage.getItem(`size-spec-print-preview:${sampleId}`);
    if (!raw) return;
    try {
      const preview = JSON.parse(raw) as Record<string, string>;
      setRows((current) => current.map((row) => ({
        ...row,
        measurementPoint: preview[`measurement_point_${row.id}`] ?? row.measurementPoint,
        description: preview[`description_${row.id}`] ?? row.description,
        tolerance: preview[`tolerance_${row.id}`] ?? row.tolerance,
        values: Object.fromEntries(sizes.map((size) => [size, preview[`size_${row.id}_${size}`] ?? row.values[size] ?? ""])),
      })));
    } catch {
      window.sessionStorage.removeItem(`size-spec-print-preview:${sampleId}`);
    }
  }, [sampleId, sizes]);

  return <div className="table-wrap">
    <table className="data spec-table">
      <thead><tr>
        <th>จุดวัด</th>
        {sizes.map((size) => <th className="spec-size-head" key={size}>Size {size}<small>{unitLabel}</small></th>)}
      </tr></thead>
      <tbody id="specRows">
        {printableRows.map((row) => <tr key={row.id}>
          <td className="spec-print-point">{row.measurementPoint}</td>
          {sizes.map((size) => <td className="spec-print-value-cell" key={size}><span className="spec-print-measure spec-print-value">{formatValue(row.values[size], unit) || "—"}</span></td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
