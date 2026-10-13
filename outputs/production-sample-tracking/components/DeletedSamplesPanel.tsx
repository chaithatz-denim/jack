import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { restoreSampleAction } from "@/lib/supabase/actions";
import { formatUpdated, sampleToPrototype } from "@/lib/supabase/mappers";
import type { SampleRow } from "@/lib/supabase/data";

function T({ th, en }: { th: string; en: string }) {
  return <><span data-th>{th}</span><span data-en>{en}</span></>;
}

export function DeletedSamplesPanel({ samples }: { samples: SampleRow[] }) {
  return <section className="panel deleted-samples-panel" id="deletedSamplesPanel">
    <div className="panel-head">
      <div>
        <h2><T th="รายการตัวอย่างที่ถูกลบ" en="Deleted samples"/></h2>
        <p className="muted"><T th="ระบบใช้ Soft Delete: ข้อมูลและไฟล์ยังไม่ถูกลบถาวร Admin สามารถกู้คืนกลับหน้า Samples ได้" en="Soft delete is enabled: data and files are not hard-deleted. Admins can restore samples to the Samples page."/></p>
      </div>
      <span className="badge b-normal">{samples.length} <T th="รายการ" en="items"/></span>
    </div>

    {samples.length === 0 ? <div className="empty deleted-samples-empty">
      <b><T th="ยังไม่มีรายการที่ถูกลบ" en="No deleted samples"/></b>
      <p><T th="เมื่อ Admin กดลบ รายการจะถูกซ่อนจากหน้า Samples และมาอยู่ที่นี่เพื่อกู้คืน" en="When an Admin deletes a sample, it is hidden from Samples and appears here for restore."/></p>
    </div> : <div className="deleted-samples-list">
      {samples.map((sample) => {
        const ui = sampleToPrototype(sample);
        return <article className="deleted-sample-row" key={sample.id}>
          <div>
            <b>{ui.id}</b>
            <span>{ui.fabricName} · {ui.modelId}</span>
          </div>
          <div>
            <small><T th="ลบเมื่อ" en="Deleted at"/></small>
            <b>{formatUpdated(sample.archived_at)}</b>
          </div>
          <div className="deleted-sample-actions">
            <Link className="btn small" href={`/samples/${sample.id}`}><T th="ดูรายละเอียด" en="View"/></Link>
            <form action={restoreSampleAction.bind(null, sample.id)}>
              <button className="btn primary small" type="submit"><RotateCcw size={13}/> <T th="กู้คืน" en="Restore"/></button>
            </form>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
