export const APP_TIME_ZONE = "Asia/Bangkok";

const DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function nowIso() {
  return new Date().toISOString();
}

export function todayBangkokDate() {
  const parts = DATE_PARTS.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
}

function parseDateOnlyAsBangkok(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00+07:00`) : new Date(date);
}

export function formatShortDateBangkok(date: string | null | undefined, fallback = "—") {
  if (!date) return fallback;
  const parsed = parseDateOnlyAsBangkok(date);
  return Number.isNaN(parsed.getTime()) ? fallback : SHORT_DATE.format(parsed);
}

export function formatDateTimeBangkok(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : DATE_TIME.format(parsed);
}

export function isBeforeTodayBangkok(date: string | null | undefined) {
  if (!date) return false;
  return date.slice(0, 10) < todayBangkokDate();
}
