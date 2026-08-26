import type {
  CampaignReport,
  Granularity,
  ReportFigure,
  SeriesPoint,
} from "@/types/customer";
import type { CustomerAgreement, CustomerFigureKey } from "@/types/quality";

/**
 * The customer report, computed for a filter and an agreement.
 *
 * Two decisions shape this whole file.
 *
 * **The filters must actually move the numbers.** A period/location/organisation
 * control that leaves the figures untouched is worse than no control: it invites
 * a campaign manager to draw a conclusion from a difference that isn't there.
 * So every figure and every series is derived from the selected bucket, and the
 * derivation is deterministic — the same filter yields the same number on every
 * reload, because a report that shifts under a refresh is not a report.
 *
 * **The agreement is an input, not a display flag.** A figure outside the
 * contract is never computed and never leaves this function, so there is no
 * hidden field to find in a response body (FR-C-07, FR-C-08).
 *
 * Deterministic variation comes from an FNV-1a hash of the bucket key, never
 * from Math.random.
 */

const TODAY = { year: 2026, month: 8, week: 34, day: 20 };

const MONTHS = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];
const DAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

interface CampaignBase {
  donorsPerMonth: number;
  avgGift: number;
  costPerMonth: number;
  retention: number;
  conversationsPerDonor: number;
  /** Months the campaign has been running, for the year view. */
  activeMonths: number;
}

const CAMPAIGNS: Record<string, CampaignBase> = {
  "Høstkampanjen 2026": { donorsPerMonth: 380, avgGift: 245, costPerMonth: 214000, retention: 0.871, conversationsPerDonor: 11.4, activeMonths: 8 },
  "Vårkampanjen 2026": { donorsPerMonth: 265, avgGift: 219, costPerMonth: 158000, retention: 0.844, conversationsPerDonor: 12.9, activeMonths: 6 },
  Strømmestiftelsen: { donorsPerMonth: 198, avgGift: 262, costPerMonth: 121000, retention: 0.902, conversationsPerDonor: 10.1, activeMonths: 5 },
  "Leger Uten Grenser": { donorsPerMonth: 143, avgGift: 288, costPerMonth: 96000, retention: 0.886, conversationsPerDonor: 13.2, activeMonths: 2 },
};

/** Shares sum to 1. A single selected location scales everything by its share. */
const LOCATIONS: Record<string, number> = {
  Bergen: 0.41, Oslo: 0.34, Trondheim: 0.15, Stavanger: 0.1,
};

// ── deterministic noise ───────────────────────────────────────────────────────
function seedOf(...parts: string[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable multiplier in [1 - spread, 1 + spread]. */
function vary(seed: number, spread: number): number {
  return 1 + ((seed % 2001) / 1000 - 1) * spread;
}

/** Summer dips, autumn peaks — the shape door-to-door fundraising actually has. */
const SEASON = [0.86, 0.94, 1.02, 1.05, 1.03, 0.9, 0.72, 1.08, 1.12, 1.06, 0.98, 0.83];

// ── period keys ───────────────────────────────────────────────────────────────
function monthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}
function weekKey(y: number, w: number) {
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export function periodLabel(key: string): string {
  if (/^\d{4}$/.test(key)) return key;
  const week = key.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `Uke ${Number(week[2])} ${week[1]}`;
  const month = key.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1]}`;
  return key;
}

function granularityOf(key: string): Granularity {
  if (/^\d{4}$/.test(key)) return "year";
  if (/-W\d{2}$/.test(key)) return "week";
  return "month";
}

/** The buckets a contract may select, newest first. */
export function periodsFor(granularity: Granularity): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  if (granularity === "year") {
    for (let y = TODAY.year; y >= TODAY.year - 2; y--) out.push({ value: String(y), label: String(y) });
  } else if (granularity === "month") {
    for (let m = TODAY.month; m >= 1; m--) {
      const k = monthKey(TODAY.year, m);
      out.push({ value: k, label: periodLabel(k) });
    }
  } else {
    // Half a year of weeks. Beyond that nobody is comparing week to week, and
    // a 34-item dropdown in January is worse than a shorter honest one.
    for (let w = TODAY.week; w > TODAY.week - 26 && w > 0; w--) {
      const k = weekKey(TODAY.year, w);
      out.push({ value: k, label: periodLabel(k) });
    }
  }
  return out;
}

/** Walk back `count` buckets from `key`, oldest first. */
function previousBuckets(key: string, count: number): string[] {
  const g = granularityOf(key);
  const out: string[] = [];
  if (g === "year") {
    const y = Number(key);
    for (let i = count - 1; i >= 0; i--) out.push(String(y - i));
  } else if (g === "month") {
    const [ys, ms] = key.split("-").map(Number);
    for (let i = count - 1; i >= 0; i--) {
      let m = ms - i, y = ys;
      while (m <= 0) { m += 12; y -= 1; }
      out.push(monthKey(y, m));
    }
  } else {
    const [ys, ws] = key.replace("W", "").split("-").map(Number);
    for (let i = count - 1; i >= 0; i--) {
      let w = ws - i, y = ys;
      while (w <= 0) { w += 52; y -= 1; }
      out.push(weekKey(y, w));
    }
  }
  return out;
}

/**
 * A month's completed weeks, and a year's elapsed months.
 *
 * These two functions are the spine of the model: every figure is built up from
 * the finest bucket, so a year equals the sum of its months and a month equals
 * the sum of its weeks. Computing each level independently is easier and gives
 * a report whose headline disagrees with the chart below it — the single fastest
 * way to lose a customer's trust in a number.
 */
function weeksOfMonth(key: string): string[] {
  const [y, m] = key.split("-").map(Number);
  const first = Math.round(((m - 1) / 12) * 52) + 1;
  // The running month reports its completed weeks only. A part-week drawn as a
  // whole one reads as a collapse in performance that never happened.
  const count = y === TODAY.year && m === TODAY.month ? 3 : 4;
  return Array.from({ length: count }, (_, i) => weekKey(y, first + i));
}

function monthsOfYear(key: string): string[] {
  const y = Number(key);
  const upto = y === TODAY.year ? TODAY.month : 12;
  return Array.from({ length: upto }, (_, i) => monthKey(y, i + 1));
}

function seasonOfWeek(key: string): number {
  const w = Number(key.split("-W")[1]);
  return SEASON[Math.min(11, Math.floor(((w - 1) / 52) * 12))];
}

// ── the model ───────────────────────────────────────────────────
interface Scope {
  campaign: string;
  location: string;
  organisation: string;
  organisations: string[];
}

function scopeFactor(scope: Scope): number {
  const loc = scope.location === "alle" ? 1 : (LOCATIONS[scope.location] ?? 0.2);
  const orgs = scope.organisations.length || 1;
  const org = scope.organisation === "alle" ? 1 : 1 / orgs;
  return loc * org;
}

/** One week — the only figure in the model that is invented rather than summed. */
function weekDonors(key: string, scope: Scope, kind: "actual" | "plan"): number {
  const base = CAMPAIGNS[scope.campaign] ?? CAMPAIGNS["Høstkampanjen 2026"];
  const seed = seedOf(kind, key, scope.campaign, scope.location, scope.organisation);
  const spread = kind === "plan" ? 0.05 : 0.13;
  const raw = (base.donorsPerMonth / 4.345) * seasonOfWeek(key) * scopeFactor(scope) * vary(seed, spread);
  return Math.max(1, Math.round(raw));
}

function valueFor(key: string, scope: Scope, kind: "actual" | "plan"): number {
  const g = granularityOf(key);
  if (g === "week") return weekDonors(key, scope, kind);
  if (g === "month") return weeksOfMonth(key).reduce((n, w) => n + weekDonors(w, scope, kind), 0);
  return monthsOfYear(key).reduce((n, m) => n + valueFor(m, scope, kind), 0);
}

const donorsFor = (key: string, scope: Scope) => valueFor(key, scope, "actual");
const planFor = (key: string, scope: Scope) => valueFor(key, scope, "plan");

/** How many months of volume one bucket represents, for the rate-style figures. */
function bucketMonths(key: string): number {
  const g = granularityOf(key);
  if (g === "week") return 1 / 4.345;
  if (g === "month") return weeksOfMonth(key).length / 4.345;
  return monthsOfYear(key).reduce((n, m) => n + bucketMonths(m), 0);
}

function series(key: string, scope: Scope, count: number): SeriesPoint[] {
  return previousBuckets(key, count).map((k) => ({
    label: shortLabel(k),
    value: donorsFor(k, scope),
    plan: planFor(k, scope),
  }));
}

function shortLabel(key: string): string {
  const g = granularityOf(key);
  if (g === "year") return key;
  if (g === "week") return `Uke ${Number(key.split("-W")[1])}`;
  return MONTHS[Number(key.split("-")[1]) - 1].slice(0, 3);
}

/**
 * One level finer than the selected granularity, because "which part of the
 * period carried it" is a different question from "how are we tracking".
 *
 * These points sum to the headline exactly. The day split uses largest-remainder
 * rounding for the same reason — seven independently rounded days that add up to
 * one short of the week is the kind of thing a board member spots.
 */
function breakdownFor(key: string, scope: Scope): { unit: string; points: SeriesPoint[] } {
  const g = granularityOf(key);
  if (g === "year") {
    return {
      unit: "måned",
      points: monthsOfYear(key).map((m) => ({
        label: MONTHS[Number(m.split("-")[1]) - 1].slice(0, 3),
        value: donorsFor(m, scope),
      })),
    };
  }
  if (g === "month") {
    return {
      unit: "uke",
      points: weeksOfMonth(key).map((w) => ({
        label: `Uke ${Number(w.split("-W")[1])}`,
        value: donorsFor(w, scope),
      })),
    };
  }

  const total = donorsFor(key, scope);
  // Sunday is not worked; Saturday is a half day.
  const weights = [0.185, 0.19, 0.185, 0.19, 0.16, 0.09, 0];
  const exact = weights.map((w, i) => total * w * vary(seedOf(key, DAYS[i], scope.campaign), 0.12));
  const scale = total / exact.reduce((a, b) => a + b, 0);
  const scaled = exact.map((v) => v * scale);
  const floors = scaled.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    if (weights[i] === 0) continue;
    floors[i] += 1;
    remainder -= 1;
  }
  return {
    unit: "dag",
    points: DAYS.map((d, i) => ({ label: d.slice(0, 3), value: floors[i] })),
  };
}

// ── figures ───────────────────────────────────────────────────────────────────
const nb = (n: number, opts?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat("nb-NO", opts).format(n);

const REPORT_DATE = "20. august 2026";
const SOURCE = "Analyse · Dashboard.xlsx";

function buildFigures(
  key: string,
  scope: Scope,
  agreement: CustomerAgreement,
  donors: number,
): ReportFigure[] {
  const base = CAMPAIGNS[scope.campaign] ?? CAMPAIGNS["Høstkampanjen 2026"];
  const months = bucketMonths(key);
  const avgGift = Math.round(base.avgGift * vary(seedOf("gift", key, scope.campaign), 0.05));
  const paidMonths = granularityOf(key) === "year" ? 5.4 : granularityOf(key) === "month" ? 1.9 : 0.6;
  const totalPaid = Math.round(donors * avgGift * paidMonths);
  const cost = Math.round(base.costPerMonth * months * scopeFactor(scope));
  const retention = base.retention * vary(seedOf("ret", key, scope.campaign), 0.03);

  const all: Record<CustomerFigureKey, ReportFigure> = {
    donorsAcquired: {
      key: "donorsAcquired",
      label: "Givere rekruttert",
      display: nb(donors),
      definition: "Antall nye givere med godkjent og aktiv avtale i valgt periode.",
      source: SOURCE, version: "v1.2", withheldReason: null,
    },
    totalPaid: {
      key: "totalPaid",
      label: "Totalt innbetalt",
      display: `${nb(totalPaid)} kr`,
      definition: "Sum innbetalt fra givere rekruttert i kampanjen, i valgt periode.",
      source: SOURCE, version: "v1.0", withheldReason: null,
    },
    averageMonthlyGift: {
      key: "averageMonthlyGift",
      label: "Snitt månedsbeløp",
      display: `${nb(avgGift)} kr`,
      definition: "Gjennomsnittlig avtalt månedsbeløp for giverne rekruttert i perioden.",
      source: SOURCE, version: "v1.0", withheldReason: null,
    },
    retention90: {
      key: "retention90",
      label: "Aktive etter 90 dager",
      display: nb(retention, { style: "percent", maximumFractionDigits: 1 }),
      definition: "Andel av giverne som fortsatt har aktiv avtale 90 dager etter signering.",
      source: SOURCE, version: "v1.1", withheldReason: null,
    },
    campaignCost: {
      key: "campaignCost",
      label: "Kampanjekostnad",
      display: agreement.costDefinitionAgreed ? `${nb(cost)} kr` : null,
      definition: agreement.costDefinitionAgreed
        ? "Avtalt kostnad for kampanjen i valgt periode, slik den er definert i avtalen."
        : "Definisjonen er ikke avklart ennå. Tallet vises derfor ikke.",
      source: SOURCE, version: agreement.costDefinitionAgreed ? "v1.0" : "v0.1",
      withheldReason: agreement.costDefinitionAgreed
        ? null
        : "Ikke tilgjengelig ennå — definisjonen av kampanjekostnad er ikke avklart med dere.",
    },
    costPerDonor: {
      key: "costPerDonor",
      label: "Kostnad per giver",
      display: agreement.costDefinitionAgreed ? `${nb(Math.round(cost / donors))} kr` : null,
      definition: "Kampanjekostnad delt på antall givere rekruttert i perioden.",
      source: SOURCE, version: agreement.costDefinitionAgreed ? "v1.0" : "v0.1",
      withheldReason: agreement.costDefinitionAgreed
        ? null
        : "Bygger på kampanjekostnad, som ikke er avklart ennå.",
    },
  };

  return agreement.figures.map((k) => all[k]).filter(Boolean);
}

// ── entry point ───────────────────────────────────────────────────────────────
export interface ReportRequest {
  campaign?: string | null;
  granularity?: string | null;
  period?: string | null;
  location?: string | null;
  organisation?: string | null;
}

export function buildCampaignReport(
  req: ReportRequest,
  agreement: CustomerAgreement,
  allowedCampaigns: string[],
): CampaignReport {
  const campaign = allowedCampaigns.includes(req.campaign ?? "")
    ? (req.campaign as string)
    : allowedCampaigns[0];

  // Asking for a granularity outside the contract is answered, not refused —
  // at the nearest granularity the contract does cover, with a notice.
  const wanted = (req.granularity ?? "month") as Granularity;
  const granularity = agreement.granularities.includes(wanted)
    ? wanted
    : (agreement.granularities[0] ?? "month");
  const granularityNotice =
    granularity === wanted
      ? null
      : `Avtalen deres rapporterer per ${granularity === "month" ? "måned" : granularity === "year" ? "år" : "uke"}. Viser nærmeste nivå.`;

  const periods = periodsFor(granularity);
  const asIsPeriod = periods.some((p) => p.value === req.period);
  const period = asIsPeriod ? (req.period as string) : periods[0].value;
  /*
   * Falling back to the newest bucket is right; doing it silently is not. A
   * request for a period outside the reported window would otherwise come back
   * looking like an answer to the question that was asked.
   */
  const outOfRange = !asIsPeriod && !!req.period;

  const location = req.location && req.location in LOCATIONS ? req.location : "alle";
  const organisation =
    req.organisation && agreement.organisations.includes(req.organisation)
      ? req.organisation
      : "alle";

  const scope: Scope = { campaign, location, organisation, organisations: agreement.organisations };
  const donors = donorsFor(period, scope);
  const plan = planFor(period, scope);
  const pct = Math.round(((donors - plan) / plan) * 100);
  const label = periodLabel(period);

  const verdict =
    pct >= 3
      ? `Kampanjen ligger ${pct} % over plan for ${label.toLowerCase()}.`
      : pct <= -3
        ? `Kampanjen ligger ${Math.abs(pct)} % under plan for ${label.toLowerCase()}.`
        : `Kampanjen ligger på plan for ${label.toLowerCase()}.`;

  const trend = series(period, scope, granularity === "year" ? 3 : 6);
  let running = 0;
  let runningPlan = 0;
  const accumulated = trend.map((p) => {
    running += p.value;
    runningPlan += p.plan ?? 0;
    return { label: p.label, value: running, plan: runningPlan };
  });

  const byLocation = Object.keys(LOCATIONS)
    .map((l) => ({
      label: l,
      value: donorsFor(period, { ...scope, location: l }),
    }))
    .sort((a, b) => b.value - a.value);

  const byOrganisation = agreement.organisations
    .map((o) => ({ label: o, value: donorsFor(period, { ...scope, organisation: o }) }))
    .sort((a, b) => b.value - a.value);

  const base = CAMPAIGNS[campaign] ?? CAMPAIGNS["Høstkampanjen 2026"];
  /*
   * Headcount comes from the volume, and the average then comes from the
   * headcount — in that order. Deriving the average straight from the ratio it
   * was built with returns the ratio back unchanged, which looks like a real
   * measurement and is not one.
   */
  const fundraisers = Math.max(1, Math.round(donors / (21 * Math.max(0.25, bucketMonths(period)))));
  const fieldwork =
    agreement.fieldworkDetail === "aggregate"
      ? {
          fundraisers,
          daysInField: Math.max(1, Math.round(bucketMonths(period) * 21)),
          averagePerFundraiser: Math.round((donors / fundraisers) * 10) / 10,
          conversationsPerDonor:
            Math.round(base.conversationsPerDonor * vary(seedOf("conv", period, campaign), 0.08) * 10) / 10,
        }
      : null;

  return {
    campaign,
    filter: { campaign, granularity, period, periodLabel: label, location, organisation },
    options: {
      campaigns: allowedCampaigns,
      granularities: agreement.granularities,
      periods,
      locations: Object.keys(LOCATIONS),
      organisations: agreement.organisations,
    },
    narrowedNotice:
      granularityNotice ??
      (outOfRange
        ? `Perioden du ba om ligger utenfor det som rapporteres. Viser ${label.toLowerCase()}.`
        : null),
    verdict,
    figures: buildFigures(period, scope, agreement, donors),
    resultVsPlan: trend,
    accumulated,
    breakdown: breakdownFor(period, scope),
    byLocation,
    byOrganisation,
    fieldwork,
    /*
     * FR-C-09 — the notice belongs to the period *and the campaign* it
     * corrected. Showing every customer the same correction text is how a
     * charity ends up asking why 12 of their donors moved when none did.
     */
    correction:
      campaign === "Høstkampanjen 2026" && (period === "2026-08" || period === "2026")
        ? {
            date: "18. aug 2026",
            note: "12 givere registrert i august ble flyttet til riktig kampanje etter kvalitetskontroll. Tallet for august er justert ned tilsvarende.",
          }
        : undefined,
    reportDate: REPORT_DATE,
  };
}
