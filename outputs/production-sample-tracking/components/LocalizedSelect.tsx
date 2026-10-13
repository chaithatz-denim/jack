"use client";

import { useEffect, useState } from "react";

type LocalizedOption = {
  value: string;
  th: string;
  en: string;
  disabled?: boolean;
};

type LocalizedSelectProps = {
  name: string;
  options: LocalizedOption[];
  className?: string;
  defaultValue?: string;
  required?: boolean;
};

type LocalizedInputProps = {
  name: string;
  id?: string;
  placeholderTh: string;
  placeholderEn: string;
  className?: string;
  defaultValue?: string;
  required?: boolean;
  readOnly?: boolean;
  type?: string;
  rows?: number;
  autoComplete?: string;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
};

function readLanguage() {
  if (typeof document === "undefined") return "th";
  return document.body.dataset.lang === "en" ? "en" : "th";
}

export function LocalizedSelect({ name, options, className, defaultValue, required }: LocalizedSelectProps) {
  const [language, setLanguage] = useState("th");

  useEffect(() => {
    setLanguage(readLanguage());
    const observer = new MutationObserver(() => setLanguage(readLanguage()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, []);

  return <select className={className} name={name} defaultValue={defaultValue} required={required}>
    {options.map((option) => <option key={`${name}-${option.value || "empty"}`} value={option.value} disabled={option.disabled}>
      {language === "en" ? option.en : option.th}
    </option>)}
  </select>;
}

export function LocalizedInput({ name, id, placeholderTh, placeholderEn, className, defaultValue, required, readOnly, type = "text", autoComplete, enterKeyHint }: LocalizedInputProps) {
  const [language, setLanguage] = useState("th");

  useEffect(() => {
    setLanguage(readLanguage());
    const observer = new MutationObserver(() => setLanguage(readLanguage()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, []);

  return <input
    id={id}
    className={className}
    name={name}
    type={type}
    defaultValue={defaultValue}
    required={required}
    readOnly={readOnly}
    autoComplete={autoComplete}
    enterKeyHint={enterKeyHint}
    placeholder={language === "en" ? placeholderEn : placeholderTh}
  />;
}

export function LocalizedTextarea({ name, placeholderTh, placeholderEn, defaultValue, required, rows = 3 }: LocalizedInputProps) {
  const [language, setLanguage] = useState("th");

  useEffect(() => {
    setLanguage(readLanguage());
    const observer = new MutationObserver(() => setLanguage(readLanguage()));
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
    return () => observer.disconnect();
  }, []);

  return <textarea name={name} rows={rows} defaultValue={defaultValue} required={required} placeholder={language === "en" ? placeholderEn : placeholderTh}/>;
}
