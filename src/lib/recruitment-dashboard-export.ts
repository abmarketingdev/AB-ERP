import type { RecruitmentDashboard } from "@/types/recruitment-dashboard";

/**
 * DASH-08 in MOCK mode only. In api mode the server builds the Excel/PDF from the
 * same figures and audits the export; with no server, the demo builds an
 * Excel-readable CSV (BOM + «;», since nb-NO uses «,» as the decimal mark) or
 * opens the print dialog for PDF — the same pattern as report-export.ts.
 */
const BOM = "﻿";
const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function rows(d: RecruitmentDashboard): (string | number)[][] {
  const out: (string | number)[][] = [["Rekrutteringsrapport", d.basis.period], ["Definisjoner", d.basis.definitionVersion], [],
    ["Steg", "Nådd", "Frafall før"]];
  for (const s of d.funnel) out.push([s.label, s.reached, s.droppedBefore]);
  out.push([], ["Kanal", "Intervjuer", "Ikke møtt intervju", "Første dager", "Ikke møtt første dag"]);
  for (const r of d.noShowByChannel) out.push([r.key, r.interviewsHeldOrMissed, r.interviewNoShows, r.firstDayExpected, r.firstDayNoShows]);
  out.push([], ["Kanal", "Leads", "Ansatte", "Aktive etter 90 dager", "Robuste"]);
  for (const c of d.channelQuality) out.push([c.channel, c.leads, c.hired, c.retained90, c.robust]);
  return out;
}

export function downloadDashboardLocally(format: "xlsx" | "pdf", d: RecruitmentDashboard) {
  if (format === "pdf") {
    window.print();
    return;
  }
  const csv = BOM + rows(d).map((r) => r.map(cell).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `rekruttering-${d.basis.period.replace(/[^\d]+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
