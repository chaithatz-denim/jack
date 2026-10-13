"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="page active">
    <div className="page-head"><div><span className="eyebrow">Supabase Error</span><h1><span data-th>โหลดข้อมูลไม่สำเร็จ</span><span data-en>Could not load data</span></h1><p>{error.message}</p></div></div>
    <section className="table-panel">
      <div className="empty">
        <b><span data-th>ไม่สามารถอ่านข้อมูลจาก Supabase ได้</span><span data-en>Unable to read data from Supabase.</span></b>
        <p><span data-th>ตรวจสอบ Environment Variables / Supabase permissions แล้วลองใหม่</span><span data-en>Check Environment Variables / Supabase permissions, then try again.</span></p>
        <button className="btn primary" type="button" onClick={() => reset()}><span data-th>ลองใหม่</span><span data-en>Try again</span></button>
      </div>
    </section>
  </section>;
}
