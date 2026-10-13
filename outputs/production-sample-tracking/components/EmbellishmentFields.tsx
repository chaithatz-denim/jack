"use client";

import { useEffect, useState } from "react";

function readLanguage() {
  if (typeof document === "undefined") return "th";
  return document.body.dataset.lang === "en" ? "en" : "th";
}

export function EmbellishmentFields() {
  const [required, setRequired] = useState("no");
  const [language, setLanguage] = useState("th");

  useEffect(() => {
    setLanguage(readLanguage());
    const observer = new MutationObserver(() => setLanguage(readLanguage()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, []);

  return <>
    <label className="field embellishment-choice-field">
      <span><span data-th>มีปัก/สกรีนหรือไม่</span><span data-en>Embroidery / screen required?</span></span>
      <select name="embellishment_required" value={required} onChange={(event) => setRequired(event.target.value)}>
        <option value="no">{language === "en" ? "No" : "ไม่มี"}</option>
        <option value="yes">{language === "en" ? "Yes" : "มี"}</option>
      </select>
    </label>
    <label className="field embellishment-shop-field">
      <span><span data-th>ชื่อร้านปัก/สกรีน</span><span data-en>Embroidery / screen shop</span></span>
      <input
        name="embellishment_shop"
        required={required === "yes"}
        disabled={required !== "yes"}
        placeholder={required === "yes"
          ? language === "en" ? "Enter shop name" : "ระบุชื่อร้านปัก/สกรีน"
          : language === "en" ? "Not required when No is selected" : "ไม่จำเป็นเมื่อเลือกไม่มี"}
      />
    </label>
  </>;
}
