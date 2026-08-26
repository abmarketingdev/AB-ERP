import type { Course } from "@/types/promoter";

/**
 * Course status vocabulary.
 *
 * The rule this file exists to enforce: **overdue is a modifier on an
 * unfinished course, not a status of its own.** That is the convention in the
 * compliance-LMS products this screen will be compared against (Cornerstone,
 * Workday), and it is the right one — "Forfalt" alone hides whether the person
 * has started, which changes what they should do next.
 *
 * The four deadline buckets are SAP's — overdue / due soon / upcoming / due
 * anytime. The last one matters: some required courses genuinely have no date,
 * and inventing one to fill the column is a lie the person will act on.
 */

export const EXPIRING_WITHIN_DAYS = 14;

export type DeadlineBucket = "overdue" | "soon" | "upcoming" | "anytime";

export function deadlineBucket(c: Course): DeadlineBucket {
  if (c.daysToDeadline === null) return "anytime";
  if (c.daysToDeadline < 0) return "overdue";
  if (c.daysToDeadline <= EXPIRING_WITHIN_DAYS) return "soon";
  return "upcoming";
}

export function isOverdue(c: Course): boolean {
  return c.status !== "completed" && deadlineBucket(c) === "overdue";
}

export const STATUS_LABEL: Record<Course["status"], string> = {
  "not-started": "Ikke startet",
  "in-progress": "Påbegynt",
  completed: "Fullført",
};

/**
 * The deadline half of a row, as text. WCAG 1.4.1 is Level A: the status must
 * be readable without relying on the colour it is painted in, so every caller
 * renders this string rather than encoding the same fact as a coloured pill.
 */
export function deadlineText(c: Course): string {
  const d = c.daysToDeadline;
  if (d === null) return "Frist når som helst";
  if (c.status === "completed") return `Frist ${c.deadline}`;
  if (d < 0) {
    const n = Math.abs(d);
    return `Frist gikk ut ${c.deadline} (${n} ${n === 1 ? "dag" : "dager"} siden)`;
  }
  if (d === 0) return `Frist i dag, ${c.deadline}`;
  if (d <= EXPIRING_WITHIN_DAYS) return `Frist ${c.deadline} (${d} ${d === 1 ? "dag" : "dager"} igjen)`;
  return `Frist ${c.deadline}`;
}

export function effortText(c: Course): string {
  return c.minutes >= 60
    ? `ca. ${Math.round((c.minutes / 60) * 10) / 10} t`.replace(".", ",")
    : `ca. ${c.minutes} min`;
}

/**
 * The suggested order — and it is only ever a suggestion. Nothing in this
 * product locks a course behind another one: there is no pedagogical reason a
 * promoter cannot take the security course before the GDPR one, and gating them
 * would remove a choice without buying any compliance.
 */
const BAND: Record<DeadlineBucket, number> = { overdue: 0, soon: 1, upcoming: 2, anytime: 3 };

export function bySuggested(a: Course, b: Course): number {
  const band = BAND[deadlineBucket(a)] - BAND[deadlineBucket(b)];
  if (band !== 0) return band;
  // Started work comes before untouched work inside the same band.
  const started = Number(b.status === "in-progress") - Number(a.status === "in-progress");
  if (started !== 0) return started;
  return (a.daysToDeadline ?? Infinity) - (b.daysToDeadline ?? Infinity);
}

export function byDeadline(a: Course, b: Course): number {
  return (a.daysToDeadline ?? Infinity) - (b.daysToDeadline ?? Infinity);
}

export function byTitle(a: Course, b: Course): number {
  return a.title.localeCompare(b.title, "nb-NO");
}
