import { intlLocale } from "./i18n";

/**
 * FR-S-07 — formatting follows the interface language.
 *
 * Read per call rather than captured once: a module constant would freeze the
 * locale at import time and every figure on screen would keep its Norwegian
 * formatting after the user switched. On a product that is mostly numbers, a
 * Norwegian reading "1,336" sees one point three three six — so this is a
 * correctness problem, not a cosmetic one.
 */
const LOCALE = () => intlLocale();

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALE(), opts).format(value);
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE(), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCurrency(value: number, currency = "NOK"): string {
  return new Intl.NumberFormat(LOCALE(), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE(), opts ?? { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatWeek(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const target = new Date(d.valueOf());
  const dayNumber = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return intlLocale().startsWith("en") ? `Week ${week}` : `Uke ${week}`;
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.valueOf() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE(), { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

/**
 * One way to show a phone number everywhere (master, design review round 1 — lanes showed
 * «+47 998 12 344» and «969 75 697» side by side).
 *
 *  - Norwegian (+47, 8 digits): «969 75 697» for mobiles (4/9…) and «22 33 44 55» for
 *    landlines — how Norwegians write them, no country code.
 *  - Foreign: the country code, then the rest grouped in threes: «+46 701 234 567».
 *  - Anything unparseable is shown as given (never guessed into a wrong number).
 *
 * `phoneHref` gives the tel: link in E.164, so a tap always dials correctly.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const e164 = toE164(raw);
  if (!e164) return raw.trim();
  if (e164.startsWith("+47") && e164.length === 11) {
    const n = e164.slice(3);
    return /^[49]/.test(n)
      ? `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5)}`
      : `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
  }
  const m = /^\+(1|7|[2-9]\d)(\d+)$/.exec(e164);
  if (!m) return e164;
  return `+${m[1]} ${m[2].replace(/(\d{3})(?=\d)/g, "$1 ")}`;
}

export function phoneHref(raw: string | null | undefined): string | undefined {
  const e164 = raw ? toE164(raw) : null;
  return e164 ? `tel:${e164}` : undefined;
}

/** Same normalisation as the backend (notify/phone.py): 8 digits → +47, 0047/47… → +47. */
function toE164(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (!d.startsWith("+")) {
    if (d.length === 8) d = "+47" + d;
    else if (d.length === 10 && d.startsWith("47")) d = "+" + d;
    else return null;
  }
  return /^\+\d{7,15}$/.test(d) ? d : null;
}

/**
 * The recruitment API sends ISO timestamps; the mock sends display strings («18. aug 2026»).
 * Format what parses as ISO, show anything else as is, render nothing for empty — a raw
 * «2026-10-21T19:34:44.359342+00:00» or «Invalid Date» must never reach the screen.
 * (From A2's show-date.ts, moved into the foundation — master 2026-10-22.)
 */
export function showDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(new Date(value).getTime())) return value;
  return withTime && value.length > 10 ? formatDateTime(value) : formatDate(value);
}
