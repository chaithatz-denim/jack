export default function Loading() {
  return <section className="page active">
    <div className="page-head"><div><span className="eyebrow">Loading</span><h1><span data-th>กำลังโหลดข้อมูล</span><span data-en>Loading data</span></h1><p><span data-th>กำลังอ่านข้อมูลจาก Supabase</span><span data-en>Reading data from Supabase.</span></p></div></div>
    <section className="table-panel"><div className="empty">Loading...</div></section>
  </section>;
}
