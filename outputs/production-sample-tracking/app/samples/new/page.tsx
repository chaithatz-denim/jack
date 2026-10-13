import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";
import { createSampleAction } from "@/lib/supabase/actions";
import { getNextSampleCode } from "@/lib/supabase/data";
import { requireSampleCreator } from "@/lib/supabase/auth";
import { LocalizedInput, LocalizedSelect, LocalizedTextarea } from "@/components/LocalizedSelect";
import { CreateSampleSubmitButton } from "@/components/CreateSampleSubmitButton";
import { FILE_INPUT_ACCEPT } from "@/lib/upload-policy";

export const dynamic = "force-dynamic";

const Field = ({ label, required, children }: { label: React.ReactNode; required?: boolean; children: React.ReactNode }) =>
  <label className="field"><span>{label}{required && <em className="required"> *</em>}</span>{children}</label>;

function T({ th, en }: { th: string; en: string }) {
  return <><span data-th>{th}</span><span data-en>{en}</span></>;
}

const newSamplePriorityOptions = [
  { value: "Low", th: "ต่ำ", en: "Low" },
  { value: "Normal", th: "ปกติ", en: "Normal" },
  { value: "High", th: "สูง", en: "High" },
  { value: "Urgent", th: "เร่งด่วน", en: "Urgent" },
];

export default async function NewSamplePage() {
  await requireSampleCreator();
  const nextCode = await getNextSampleCode();
  const creationId = crypto.randomUUID();
  return <section className="page active" id="newSamplePage">
    <Link className="back" href="/samples"><ArrowLeft size={14}/> <T th="กลับไปหน้ารายการตัวอย่าง" en="Back to samples"/></Link>
    <div className="page-head">
      <div><span className="eyebrow">NEW SAMPLE</span><h1><T th="สร้างตัวอย่างใหม่" en="Create new sample"/></h1><p><T th="ข้อมูลจะถูกบันทึกลง Supabase และไฟล์จะถูกเก็บใน Supabase Storage" en="Data is saved to Supabase and files are stored in Supabase Storage."/></p></div>
    </div>

    <form action={createSampleAction} encType="multipart/form-data">
      <input type="hidden" name="creation_id" value={creationId}/>
      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head"><h2><T th="ข้อมูลสินค้าพื้นฐาน" en="Basic product information"/></h2><p><T th="ข้อมูลหลักของตัวอย่างสินค้า" en="Main product sample data."/></p></div>
        <div className="form-grid">
          <Field label={<T th="รหัสตัวอย่าง" en="Sample ID"/>}><input value={nextCode} readOnly aria-readonly="true"/></Field>
          <Field label={<T th="ชื่อผ้า" en="Fabric name"/>} required><input name="fabric_name" required placeholder="PW2732"/></Field>
          <Field label={<T th="รหัสบล็อค" en="Block ID"/>} required><input name="block_id" required placeholder="801"/></Field>
          <Field label={<T th="ทรง / การตัด" en="Cutting"/>}><input name="cutting" placeholder="Slim-fit"/></Field>
          <Field label={<T th="รหัสโมเดล" en="Model ID"/>}><input name="model_id" placeholder="J-JACK"/></Field>
          <Field label={<T th="ร้านผ้า" en="Fabric supplier"/>} required><LocalizedInput name="fabric_supplier" required placeholderTh="พิมพ์ชื่อร้านผ้า" placeholderEn="Type fabric supplier"/></Field>
          <Field label={<T th="สีด้าย" en="Thread color"/>} required><input name="thread_color" required placeholder="4277+4279"/></Field>
          <Field label={<T th="ซิป / กระดุม" en="Fly"/>}><LocalizedSelect className="fly-select" name="fly" defaultValue="Zip" options={[{ value: "Zip", th: "Zip", en: "Zip" }, { value: "Button", th: "Button", en: "Button" }]}/></Field>
          <Field label={<T th="งานฟอก" en="Washing"/>} required><LocalizedInput name="washing" required placeholderTh="ฟอกนุ่ม+เอนไซม์" placeholderEn="Soft wash + enzyme"/></Field>
          <Field label={<T th="ไซส์ตัวอย่าง" en="Sample size"/>}><LocalizedInput name="sample_size" placeholderTh="32 หรือ L" placeholderEn="32 or L"/></Field>
          <Field label={<T th="วันกำหนดส่ง" en="Due date"/>}><input type="date" name="due_date"/></Field>
          <Field label={<T th="ความเร่งด่วน" en="Priority"/>} required><LocalizedSelect name="priority" defaultValue="Normal" options={newSamplePriorityOptions} required/></Field>
          <Field label={<T th="หมายเหตุ" en="Note"/>}><LocalizedTextarea name="note" rows={3} placeholderTh="หมายเหตุภาษาไทย" placeholderEn="Note"/></Field>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head"><h2><T th="ไฟล์แนบ" en="Attachments"/></h2><p><T th="แนบไฟล์แพทเทิร์น PDF, รูปภาพ หรือเอกสารประกอบ" en="Attach pattern PDF, images, or supporting documents."/></p></div>
        <label className="upload-zone">
          <FileUp size={25}/>
          <b><T th="เลือกไฟล์อัพโหลด" en="Choose upload files"/></b>
          <span><T th="รองรับ PDF, JPG, PNG, WebP, Word, Excel, CSV, DXF, AI และ ZIP" en="Supports PDF, JPG, PNG, WebP, Word, Excel, CSV, DXF, AI, and ZIP."/></span>
          <input name="attachments" type="file" accept={FILE_INPUT_ACCEPT} multiple/>
        </label>
      </section>

      <div className="actions">
        <Link className="btn" href="/samples"><T th="ยกเลิก" en="Cancel"/></Link>
        <CreateSampleSubmitButton/>
      </div>
    </form>
  </section>;
}
