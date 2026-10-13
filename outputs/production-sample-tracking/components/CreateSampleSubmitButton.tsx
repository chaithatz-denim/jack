"use client";

import { Plus } from "lucide-react";
import { useFormStatus } from "react-dom";

export function CreateSampleSubmitButton() {
  const { pending } = useFormStatus();

  return <button
    className="btn primary create-sample-submit"
    type="submit"
    disabled={pending}
    aria-disabled={pending}
    aria-busy={pending}
  >
    <Plus size={15}/>
    <span data-th>{pending ? "กำลังสร้างและบันทึก..." : "สร้างตัวอย่าง"}</span>
    <span data-en>{pending ? "Creating and saving..." : "Create sample"}</span>
  </button>;
}
