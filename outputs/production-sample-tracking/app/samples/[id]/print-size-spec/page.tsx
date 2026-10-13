import { notFound } from "next/navigation";
import { SizeSpecPrintActions } from "@/components/SizeSpecPrintActions";
import { SizeSpecPrintTable } from "@/components/SizeSpecPrintTable";
import { getSampleBundle, sizePoints } from "@/lib/supabase/data";
import { requireUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type PrintUnit = "fraction" | "decimal" | "cm";

const numericSizes = ["29", "30", "31", "32", "33", "34", "36", "38"];
const letterSizes = ["XS", "S", "M", "L", "XL", "2XL"];
export default async function PrintSizeSpecPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ unit?: string; action?: string }> }) {
  await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const unit: PrintUnit = query?.unit === "decimal" || query?.unit === "cm" ? query.unit : "fraction";
  const initialAction = query?.action === "export" || query?.action === "print" ? query.action : undefined;
  const bundle = await getSampleBundle(id);
  if (!bundle.sample) notFound();
  const sample = bundle.sample;
  const sizes = sample.size_mode === "letter" ? letterSizes : numericSizes;
  const rows = sizePoints.map(([point, description, tolerance], index) => bundle.specs[index] ?? {
    id: `print-${index}`,
    measurement_point: point,
    description,
    tolerance,
    values: Object.fromEntries(sizes.map((size) => [size, ""])),
  });

  return <section className="print-preview-page">
    <SizeSpecPrintActions sampleId={sample.id} modelId={sample.model_id || sample.sample_code} initialAction={initialAction}/>
    <section id="size-spec" className="panel size-spec-print-route">
      <header className="size-spec-print-head">
        <span>ชื่อรุ่น</span>
        <h1>{sample.model_id || "—"}</h1>
        <p>ตารางไซซ์สเปก</p>
      </header>
      <SizeSpecPrintTable
        sampleId={sample.id}
        sizes={sizes}
        unit={unit}
        initialRows={rows.map((row, index) => {
          const fallback = sizePoints[index];
          return {
            id: row.id,
            measurementPoint: row.measurement_point || fallback[0],
            description: row.description || fallback[1],
            tolerance: row.tolerance || fallback[2],
            values: typeof row.values === "object" && row.values ? row.values as Record<string, string> : {},
          };
        })}
      />
    </section>
  </section>;
}
