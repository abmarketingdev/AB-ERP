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
