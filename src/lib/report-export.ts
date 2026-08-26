import type { CampaignReport } from "@/types/customer";

/**
 * FR-C-06 — export the agreed report.
 *
 * "Agreed" is doing the work in that sentence. The export is built from the
 * report object the endpoint returned, which was already computed against the
 * agreement — so a figure outside the contract cannot appear in the file even
 * by accident. There is no second code path deciding what to include.
 *
 * Two formats, because the two real uses are different: a spreadsheet for
 * somebody who wants to do their own arithmetic, and a printable page for
 * somebody taking the result to a board meeting. Both are produced in the
 * browser from data already on screen — nothing is sent anywhere.
 */

/** Excel opens UTF-8 CSV correctly only with a BOM, and nb-NO uses ; as the
 * separator because , is the decimal mark. Both details are the difference
 * between "it works" and "the customer emails us a screenshot of mojibake". */
const BOM = "﻿";

function cell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rows(report: CampaignReport): (string | number)[][] {
  const f = report.filter;
  const out: (string | number)[][] = [
    ["Kampanjerapport", report.campaign],
    ["Periode", f.periodLabel],
    ["Lokasjon", f.location === "alle" ? "Alle lokasjoner" : f.location],
  ];
  if (report.options.organisations.length) {
    out.push(["Organisasjon", f.organisation === "alle" ? "Alle" : f.organisation]);
  }
  out.push(["Rapportdato", report.reportDate], [], ["Tall", "Verdi", "Definisjon"]);

  for (const fig of report.figures) {
    out.push([fig.label, fig.display ?? "Ikke tilgjengelig", fig.definition]);
  }

  out.push([], ["Resultat mot plan", "Faktisk", "Plan"]);
  for (const p of report.resultVsPlan) out.push([p.label, p.value, p.plan ?? ""]);

  out.push([], ["Akkumulert", "Faktisk", "Plan"]);
  for (const p of report.accumulated) out.push([p.label, p.value, p.plan ?? ""]);

  out.push([], [`Fordelt per ${report.breakdown.unit}`, "Givere"]);
  for (const p of report.breakdown.points) out.push([p.label, p.value]);

  out.push([], ["Sted", "Givere"]);
  for (const p of report.byLocation) out.push([p.label, p.value]);

  if (report.byOrganisation.length) {
    out.push([], ["Organisasjon", "Givere"]);
    for (const p of report.byOrganisation) out.push([p.label, p.value]);
  }

  if (report.fieldwork) {
    out.push(
      [],
      ["Innsats bak tallene", ""],
      ["Ververe i felt", report.fieldwork.fundraisers],
      ["Dager i felt", report.fieldwork.daysInField],
      ["Snitt givere per verver", report.fieldwork.averagePerFundraiser],
      ["Samtaler per giver", report.fieldwork.conversationsPerDonor],
    );
  }

  if (report.correction) {
    out.push([], ["Korrigering", report.correction.date, report.correction.note]);
  }
  return out;
}

export function reportToCsv(report: CampaignReport): string {
  return BOM + rows(report).map((r) => r.map(cell).join(";")).join("\r\n");
}

export function reportFilename(report: CampaignReport, ext: string): string {
  const slug = (s: string) =>
    s.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug(report.campaign)}-${slug(report.filter.periodLabel)}.${ext}`;
}

export function downloadCsv(report: CampaignReport): void {
  const blob = new Blob([reportToCsv(report)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = reportFilename(report, "csv");
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately races the download in Safari; a tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Wait until the charts have stopped moving.
 *
 * Widening the page for print makes every chart re-run its entry animation, and
 * that animation takes about a second and a half. Printing during it captures a
 * line that stops two-thirds of the way across the plot — which reads as the
 * campaign collapsing in the final month. A fixed sleep would either be too
 * short on a slow machine or waste a second on a fast one, so this samples the
 * actual path geometry and returns as soon as two consecutive samples match.
 *
 * The timeout is a floor on correctness, not a target: if something never
 * settles, printing a slightly-wrong chart still beats a button that does
 * nothing.
 */
export async function waitForChartsToSettle(timeout = 2500): Promise<void> {
  const sample = () =>
    Array.from(
      document.querySelectorAll(".recharts-line-curve, .recharts-bar-rectangle path"),
    )
      .map((el) => el.getAttribute("d") ?? "")
      .join("|");

  const started = performance.now();
  let previous: string | null = null;
  while (performance.now() - started < timeout) {
    await new Promise((r) => setTimeout(r, 120));
    const current = sample();
    if (current && current === previous) return;
    previous = current;
  }
}
