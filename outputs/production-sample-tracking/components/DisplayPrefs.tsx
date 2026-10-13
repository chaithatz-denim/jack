"use client";

import { useEffect, useState } from "react";

const LANG_KEY = "jr_display_language";
const FONT_KEY = "jr_font_level";
const THEME_KEY = "jr_color_theme";
const DEFAULT_THEME: ColorTheme = "denim";

type ColorTheme = "industrial" | "denim";

const themeOptions: Array<{ value: ColorTheme; labelTh: string; labelEn: string; colors: Array<[string, string]> }> = [
  {
    value: "industrial",
    labelTh: "Industrial Neutral",
    labelEn: "Industrial Neutral",
    colors: [["Charcoal", "#25282B"], ["JACK RUSSEL Red", "#B83A2F"], ["Paper", "#FFFFFF"]],
  },
  {
    value: "denim",
    labelTh: "Denim theme — Indigo jeans",
    labelEn: "Denim theme — Indigo jeans",
    colors: [["Raw Indigo", "#0E2A47"], ["Washed Indigo", "#244D73"], ["Stitch Gold", "#C89B3C"]],
  },
];

function savedTheme(value: string | null): ColorTheme {
  if (value === "industrial") return "industrial";
  return DEFAULT_THEME;
}

function readPreference(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Safari can deny storage in private or restricted contexts; keep the active in-memory setting.
  }
}

function applyPrefs(language: string, fontLevel: string, colorTheme: ColorTheme) {
  document.documentElement.lang = language === "en" ? "en" : "th";
  document.body.dataset.lang = language === "en" ? "en" : "th";
  document.body.dataset.theme = colorTheme;
  document.body.classList.remove("font-normal", "font-large", "font-xlarge");
  document.body.classList.add(fontLevel === "large" ? "font-large" : fontLevel === "xlarge" ? "font-xlarge" : "font-normal");
}

export function DisplayPrefsRuntime() {
  useEffect(() => {
    const language = readPreference(LANG_KEY, "th");
    const fontLevel = readPreference(FONT_KEY, "normal");
    const colorTheme = savedTheme(readPreference(THEME_KEY, DEFAULT_THEME));
    applyPrefs(language, fontLevel, colorTheme);
  }, []);
  return null;
}

export function DisplaySettingsControls() {
  const [language, setLanguage] = useState("th");
  const [pendingLanguage, setPendingLanguage] = useState("th");
  const [fontLevel, setFontLevel] = useState("normal");
  const [colorTheme, setColorTheme] = useState<ColorTheme>(DEFAULT_THEME);
  const [pendingColorTheme, setPendingColorTheme] = useState<ColorTheme>(DEFAULT_THEME);

  useEffect(() => {
    const savedLanguage = readPreference(LANG_KEY, "th");
    const savedColorTheme = savedTheme(readPreference(THEME_KEY, DEFAULT_THEME));
    setLanguage(savedLanguage);
    setPendingLanguage(savedLanguage);
    setFontLevel(readPreference(FONT_KEY, "normal"));
    setColorTheme(savedColorTheme);
    setPendingColorTheme(savedColorTheme);
  }, []);

  function confirmLanguageChange() {
    if (pendingLanguage === language) return;
    const nextLabel = pendingLanguage === "en" ? "English" : language === "en" ? "Thai" : "ภาษาไทย";
    const message = language === "en" ? `Confirm language change to ${nextLabel}?` : `ยืนยันเปลี่ยนภาษาเป็น ${nextLabel}?`;
    if (!window.confirm(message)) {
      setPendingLanguage(language);
      return;
    }
    setLanguage(pendingLanguage);
    writePreference(LANG_KEY, pendingLanguage);
    applyPrefs(pendingLanguage, fontLevel, colorTheme);
  }

  function updateFont(value: string) {
    setFontLevel(value);
    writePreference(FONT_KEY, value);
    applyPrefs(language, value, colorTheme);
  }

  function confirmThemeChange() {
    if (pendingColorTheme === colorTheme) return;
    const nextTheme = themeOptions.find((item) => item.value === pendingColorTheme) ?? themeOptions[0];
    const message = language === "en" ? `Confirm theme change to ${nextTheme.labelEn}?` : `ยืนยันเปลี่ยนธีมเป็น ${nextTheme.labelTh}?`;
    if (!window.confirm(message)) {
      setPendingColorTheme(colorTheme);
      return;
    }
    setColorTheme(pendingColorTheme);
    writePreference(THEME_KEY, pendingColorTheme);
    applyPrefs(language, fontLevel, pendingColorTheme);
  }

  const hasPendingLanguage = pendingLanguage !== language;
  const hasPendingTheme = pendingColorTheme !== colorTheme;
  const activeTheme = themeOptions.find((item) => item.value === pendingColorTheme) ?? themeOptions[0];

  return <div className="display-settings-controls">
    <label className="field">
      <span><span data-th>ภาษา</span><span data-en>Language</span></span>
      <select value={pendingLanguage} onChange={(event) => setPendingLanguage(event.target.value)}>
        <option value="th">{language === "en" ? "Thai" : "ภาษาไทย"}</option>
        <option value="en">English</option>
      </select>
      <small><span data-th>เลือกภาษาแล้วกดปุ่มยืนยัน ระบบจะบันทึกไว้ในเครื่องผู้ใช้</span><span data-en>Select a language, then confirm. The setting is saved on this device.</span></small>
      <button className="btn primary settings-confirm-language" type="button" onClick={confirmLanguageChange} disabled={!hasPendingLanguage}>
        <span data-th>ยืนยันเปลี่ยนภาษา</span><span data-en>Confirm language</span>
      </button>
    </label>
    <label className="field">
      <span><span data-th>ขนาดหน้าจอ / ตัวอักษร</span><span data-en>Screen size / Font level</span></span>
      <select value={fontLevel} onChange={(event) => updateFont(event.target.value)}>
        <option value="normal">Normal</option>
        <option value="large">Large +10%</option>
        <option value="xlarge">Extra Large +20%</option>
      </select>
      <small><span data-th>ปรับขนาดตัวอักษรทุกหน้าตาม prototype</span><span data-en>Adjust global text size to match the prototype.</span></small>
    </label>
    <label className="field theme-field">
      <span><span data-th>ธีมสี</span><span data-en>Color theme</span></span>
      <select value={pendingColorTheme} onChange={(event) => setPendingColorTheme(savedTheme(event.target.value))}>
        {themeOptions.map((theme) => <option key={theme.value} value={theme.value}>{language === "en" ? theme.labelEn : theme.labelTh}</option>)}
      </select>
      <small><span data-th>ชื่อธีม: {activeTheme.labelTh}</span><span data-en>Theme name: {activeTheme.labelEn}</span></small>
      <div className="theme-swatches" aria-label="Theme colors">
        {activeTheme.colors.map(([name, color]) => <span key={name} title={`${name} ${color}`}><i style={{ background: color }}/>{name}</span>)}
      </div>
      <button className="btn primary settings-confirm-theme" type="button" onClick={confirmThemeChange} disabled={!hasPendingTheme}>
        <span data-th>ยืนยันเปลี่ยนธีม</span><span data-en>Confirm theme</span>
      </button>
    </label>
  </div>;
}
