import { IS_MOCK } from "@/lib/data-source";
import type { Shift } from "@/types/schedule";

/**
 * BEM-01 / BEM-06 colour codes, in ONE place for the leader calendar and the
 * promoter's own schedule, so the two can never disagree about what blue means.
 *
 *   blue  = planned working day (a plan)        «P»
 *   green = attended (a fact)                   «M» ✓
 *   red   = not attended (a fact)               «I» ✕
 *   ferie = neutral, hatched                    «F»   — NOT green: the old grid
 *           painted vacation the same green as «møtt», which made a week of
 *           holiday look like a week of perfect attendance
 *   syk   = amber                               «S»
 *   bytte = dashed accent outline + ⇄           (pending or completed swap)
 *
 * Colour is never the only signal: every cell carries a letter and a title, so
 * the grid reads in greyscale, for colour-blind users and to a screen reader.
 */
export const TODAY = IS_MOCK ? "2026-08-20" : new Date().toLocaleDateString("sv-SE");

const HATCH = "bg-[repeating-linear-gradient(135deg,var(--muted)_0_3px,transparent_3px_6px)]";
/**
 * BEM-01 says «blå». The design system's accent ramp is monochrome, so planned
 * gets its own blue — light and dark steps chosen for AA text-on-fill (6.9:1 and
 * 8.3:1, computed) — with a border, because the fill alone is too close to the
 * card. Shared tokens --planned / --planned-tint / --planned-on-tint (A1, ERP 44ff678).
 * Green vs red fails colour-blind separation (ΔE 5.1 deutan, dataviz validator),
 * which is legal only with secondary encoding: every cell carries M / I / P.
 */
const PLANNED = "border border-planned bg-planned-tint text-planned-on-tint";

export interface CellStyle { cls: string; label: string; title: string }

export function cellStyle(s: Shift | undefined): CellStyle {
  if (!s) return { cls: "bg-transparent", label: "", title: "Ingen vakt" };
  const swap = s.swapState === "pending" ? " outline-dashed outline-1 outline-offset-[-2px] outline-[var(--ab-accent-9)]" : "";
  const swapped = s.swapState === "swapped" ? " · byttet" : s.swapState === "pending" ? " · bytte venter" : "";
  if (s.kind === "ferie") return { cls: `${HATCH} border border-border text-foreground${swap}`, label: "F", title: `Ferie${swapped}` };
  if (s.kind === "syk") return { cls: `bg-warning/20 text-warning-on-tint${swap}`, label: "S", title: `Sykedag${swapped}` };
  if (s.kind === "fri") return { cls: "bg-muted/40 text-muted-foreground", label: "·", title: "Fri" };
  if (s.attendance === "mott") return { cls: `bg-success/25 text-success${swap}`, label: "M", title: `Møtt${swapped}` };
  if (s.attendance === "ikke-mott") return { cls: `bg-danger/25 text-danger${swap}`, label: "I", title: `Ikke møtt${swapped}` };
  const waiting = s.clearance && !s.clearance.cleared ? " · venter på signert kontrakt" : "";
  return { cls: `${PLANNED}${swap}`, label: "P", title: `Planlagt arbeidsdag${swapped}${waiting}` };
}

export const LEGEND: { cls: string; label: string; text: string }[] = [
  { cls: PLANNED, label: "P", text: "Planlagt" },
  { cls: "bg-success/25 text-success", label: "M", text: "Møtt ✓" },
  { cls: "bg-danger/25 text-danger", label: "I", text: "Ikke møtt ✕" },
  { cls: `${HATCH} border border-border text-foreground`, label: "F", text: "Ferie" },
  { cls: "bg-warning/20 text-warning-on-tint", label: "S", text: "Sykedag" },
  { cls: "bg-muted/40 text-muted-foreground", label: "·", text: "Fri" },
  { cls: "outline-dashed outline-1 outline-offset-[-2px] outline-[var(--ab-accent-9)] text-[var(--ab-accent-12)]", label: "⇄", text: "Vaktbytte" },
];

export function monthBounds(anchor: string) {
  const [y, m] = anchor.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(anchor: string, delta: number) {
  const [y, m] = anchor.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

/** Every date of [from, to] — BEM-01/06 «hele måneden», not only the days that have a shift. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const WD = new Intl.DateTimeFormat("nb-NO", { weekday: "short", timeZone: "UTC" });
/** «ma ti on to fr lø sø» — two letters, unambiguous (narrow gives two «T»s). */
export function weekday2(date: string): string {
  return WD.format(new Date(`${date}T00:00:00Z`)).replace(".", "").slice(0, 2).toLowerCase();
}
