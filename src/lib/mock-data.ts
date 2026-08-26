/**
 * Demo/dummy data shared across screens. No backend — plain fixtures, shaped the
 * way the real API responses will eventually look.
 *
 * FR-Q-05 lives here: the report elements that come out of Dashboard.xlsx are
 * keyed to a promoter, a team or a campaign, so every screen can resolve the
 * right subject without a lookup table maintained by hand somewhere else. The
 * fixture rules from doc 03 are enforced rather than decorative — yes-rates
 * between 4 % and 12 %, doors between 40 and 90, people on both sides of the
 * threshold, at least one applied correction, and at least one KPI whose
 * approved-only value is visibly lower than its raw count.
 */

import type { CustomerAccount, CustomerAgreement } from "@/types/quality";

export type { CustomerAccount };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Campaign names, used by fixtures and by the customer-account form. */
export const CAMPAIGNS = [
  "Høstkampanjen 2026",
  "Vårkampanjen 2026",
  "Strømmestiftelsen",
  "Leger Uten Grenser",
];

export interface WeekDay {
  day: string;
  date: string;
  doors: number;
  yes: number;
  isToday?: boolean;
}

export const UKEPLAN: WeekDay[] = [
  { day: "Mandag", date: "18. aug", doors: 22, yes: 4 },
  { day: "Tirsdag", date: "19. aug", doors: 31, yes: 7 },
  { day: "Onsdag", date: "20. aug", doors: 18, yes: 3, isToday: true },
  { day: "Torsdag", date: "21. aug", doors: 0, yes: 0 },
  { day: "Fredag", date: "22. aug", doors: 0, yes: 0 },
  { day: "Lørdag", date: "23. aug", doors: 0, yes: 0 },
  { day: "Søndag", date: "24. aug", doors: 0, yes: 0 },
];

export interface GoalCard {
  label: string;
  target: number;
  current: number;
  unit: string;
  period: string;
  daysRemaining: number;
  daysTotal: number;
  absenceDays: number;
  absenceNote: string | null;
  setBy: string;
  status: "behind" | "on-track" | "ahead";
}

export const PROMOTER_GOAL: GoalCard = {
  label: "Aktive givere denne måneden",
  target: 140,
  current: 74,
  unit: "givere",
  period: "August 2026",
  daysRemaining: 11,
  daysTotal: 31,
  absenceDays: 3,
  absenceNote: "Egenmelding 12.–14. august er trukket fra forventet takt.",
  setBy: "Ola Nordmann, teamleder",
  status: "behind",
};

export const LEADER_TEAM_GOAL: GoalCard = {
  label: "Team — aktive givere denne måneden",
  target: 620,
  current: 401,
  unit: "givere",
  period: "August 2026",
  daysRemaining: 11,
  daysTotal: 31,
  absenceDays: 0,
  absenceNote: null,
  setBy: "Salgssjef Vest",
  status: "behind",
};

/**
 * FR-L-13 — the goal plan a team lead distributes.
 *
 * The team figure is owned one level up: a sales chief sets 620 for August, and
 * the team lead's job is dividing it across people. That mirrors the "one
 * portal, two scopes" split in doc 01 and makes "within permitted limits"
 * concrete — the leader's freedom is in the distribution, bounded per person.
 *
 * Kari's row is the same 140 / 74 / 3 absence days her own Mål screen renders,
 * and the PATCH handler writes through to it. A leader adjusting a target that
 * the person never sees change would make the closed loop a lie.
 */
export interface PersonGoal {
  id: string;
  person: string;
  campaign: string;
  target: number;
  baseline: number;
  current: number;
  daysRemaining: number;
  daysTotal: number;
  absenceDays: number;
  updatedAt: string | null;
  updatedBy: string | null;
  reason: string | null;
}

export interface GoalPlan {
  period: string;
  unit: string;
  teamTarget: number;
  teamTargetSetBy: string;
  daysRemaining: number;
  daysTotal: number;
  limit: {
    maxChangePct: number;
    minTarget: number;
    maxTarget: number;
    owner: string;
    effectiveFrom: string;
    rationale: string;
  };
  people: PersonGoal[];
}

const RK = "Røde Kors";
const SS = "Strømmestiftelsen";
const LN = "Leger Uten Grenser";

function pg(
  id: string,
  person: string,
  campaign: string,
  target: number,
  current: number,
  extra: Partial<PersonGoal> = {},
): PersonGoal {
  return {
    id,
    person,
    campaign,
    target,
    baseline: target,
    current,
    daysRemaining: 11,
    daysTotal: 31,
    absenceDays: 0,
    updatedAt: null,
    updatedBy: null,
    reason: null,
    ...extra,
  };
}

export const GOAL_PLAN: GoalPlan = {
  period: "August 2026",
  unit: "givere",
  teamTarget: 620,
  teamTargetSetBy: "Salgssjef Vest",
  daysRemaining: 11,
  daysTotal: 31,
  limit: {
    maxChangePct: 15,
    minTarget: 20,
    maxTarget: 200,
    owner: "Salgssjef Vest",
    effectiveFrom: "1. jan 2026",
    rationale:
      "Mål kan justeres inntil 15 % fra utgangspunktet ved fravær, kampanjebytte eller endret område. Større endringer avtales med salgssjef.",
  },
  people: [
    pg("g1", "Kari Nordmann", RK, 140, 74, { absenceDays: 3 }),
    pg("g2", "Jonas Berg", RK, 52, 33),
    pg("g3", "Sara Iversen", SS, 68, 46),
    pg("g4", "Kristoffer Bjørnstad-Sæther", RK, 92, 71),
    // Already adjusted once this period — the provenance fields carry the story.
    pg("g5", "Nora Larsen", LN, 45, 26, {
      baseline: 50,
      absenceDays: 4,
      updatedAt: "18. aug 2026",
      updatedBy: "Ola Nordmann, teamleder",
      reason: "Redusert etter sykefravær i uke 33.",
    }),
    pg("g6", "Marius Hansen", SS, 70, 50),
    pg("g7", "Even Svendsen", RK, 78, 61),
    pg("g8", "Mari Haugen", LN, 55, 40),
  ],
};

export interface Course {
  id: string;
  title: string;
  deadline: string | null;
  status: "not-started" | "in-progress" | "completed";
  mandatory: boolean;
  /** Deep link into the learning platform — the ERP never renders course content. */
  url: string;
  daysToDeadline: number | null;
  minutes: number;
  modules: { done: number; total: number } | null;
  completedOn: string | null;
}

const L = "https://laering.abmarketing.no/kurs";

/**
 * The demo's "today". Every relative date in the fixtures is measured from here.
 */
export const FIXTURE_TODAY = "2026-08-20";

const NB_MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

/** `2026-08-17` -> `17. aug 2026`. A table, not Intl: the demo must format the
 *  same way on every machine, and nb-NO short months differ by ICU version. */
export function formatFixtureDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${NB_MONTHS[m - 1]} ${y}`;
}

/** Whole days from FIXTURE_TODAY to `iso`. Negative is in the past. */
export function daysFromToday(iso: string): number {
  // Date.UTC takes a 0-indexed month; an ISO string does not. Passing the ISO
  // month straight through silently shifts anything crossing a month boundary
  // by that month's length, which is the least visible kind of date bug.
  const utc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(iso) - utc(FIXTURE_TODAY)) / 86_400_000);
}

/**
 * Courses are authored with one date and the rest is derived.
 *
 * `deadline` and `daysToDeadline` used to be written by hand side by side, and
 * four of the five disagreed — the GDPR course rendered "frist gikk ut 22. aug
 * 2026 (3 dager siden)" on a screen whose own header said it was the 20th. Two
 * fields that can contradict each other eventually will; one field and a
 * function cannot.
 */
interface CourseSeed {
  id: string;
  title: string;
  /** ISO, or null where the learning platform sets no date. */
  due: string | null;
  status: Course["status"];
  mandatory: boolean;
  url: string;
  minutes: number;
  modules?: { done: number; total: number } | null;
  completedOn?: string | null;
}

function course(seed: CourseSeed): Course {
  return {
    id: seed.id,
    title: seed.title,
    deadline: seed.due ? formatFixtureDate(seed.due) : null,
    daysToDeadline: seed.due ? daysFromToday(seed.due) : null,
    status: seed.status,
    mandatory: seed.mandatory,
    url: seed.url,
    minutes: seed.minutes,
    modules: seed.modules ?? null,
    completedOn: seed.completedOn ?? null,
  };
}

export const PROMOTER_COURSES: Course[] = [
  // Overdue *and* never started — two separate facts, both worth showing.
  course({ id: "c1", title: "GDPR og personvern i felt", due: "2026-08-17", status: "not-started", mandatory: true, url: `${L}/gdpr`, minutes: 30 }),
  course({ id: "c2", title: "Produktkunnskap — høst 2026", due: "2026-08-27", status: "in-progress", mandatory: true, url: `${L}/produktkunnskap-h26`, minutes: 45, modules: { done: 2, total: 4 } }),
  course({ id: "c3", title: "Sikkerhet ved dør-til-dør-salg", due: "2026-09-04", status: "not-started", mandatory: true, url: `${L}/sikkerhet-dor-til-dor`, minutes: 25 }),
  // Required, but the learning platform sets no date — "når som helst" rather than a fabricated deadline.
  course({ id: "c6", title: "Innsamlingskontrollen — regler og god skikk", due: null, status: "not-started", mandatory: true, url: `${L}/innsamlingskontrollen`, minutes: 20 }),
  course({ id: "c4", title: "Etisk salg og samtykke", due: "2026-07-11", status: "completed", mandatory: true, url: `${L}/etisk-salg`, minutes: 35, completedOn: "9. jul 2026" }),
  course({ id: "c5", title: "Introduksjon til AB Marketing", due: "2026-06-01", status: "completed", mandatory: true, url: `${L}/introduksjon`, minutes: 60, completedOn: "28. mai 2026" }),
];

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  scope: string;
  publishedAt: string;
  read: boolean;
}

export const NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "Ny kampanje starter mandag",
    body: "Vi lanserer kampanjen for Røde Kors i Bergen-området fra og med 25. august. Se ukeplanen for oppdaterte mål.",
    scope: "Alle",
    publishedAt: "20. aug 2026",
    read: false,
  },
  {
    id: "n2",
    title: "Endring i godkjenningsrutine",
    body: "Fra denne uken godkjennes salg fortløpende i stedet for ved ukeslutt. Tallene dine kan derfor oppdateres oftere.",
    scope: "Avdeling Vest",
    publishedAt: "18. aug 2026",
    read: true,
  },
  {
    id: "n3",
    title: "Sommerfest 30. august",
    body: "Meld deg på sommerfesten innen fredag. Lenke til påmelding kommer på e-post.",
    scope: "Alle",
    publishedAt: "14. aug 2026",
    read: true,
  },
];

export interface FollowUpRow {
  id: string;
  name: string;
  team: string;
  rule: string;
  numbers: string;
  threshold: string;
  thresholdOwner: string;
  suggestedAction: string;
  priority: "high" | "medium" | "low";
  outcome?: { type: "accepted" | "modified" | "rejected"; note?: string };
}

export const FOLLOW_UPS: FollowUpRow[] = [
  {
    id: "f1",
    name: "Nora Larsen",
    team: "Team Vest",
    rule: "Ja-prosent under godkjent grense tre uker på rad",
    numbers: "Ja-prosent 9 % mot grense 15 %, siste 3 uker",
    threshold: "Ja-prosent ≥ 15 % over rullerende 3 uker",
    thresholdOwner: "Kvalitetsansvarlig — Petter Holm",
    suggestedAction: "Samtale om teknikk og feltobservasjon",
    priority: "high",
  },
  {
    id: "f2",
    name: "Even Svendsen",
    team: "Team Vest",
    rule: "Dører banket under 60 % av plan denne uken",
    numbers: "62 av forventet 105 dører denne uken",
    threshold: "Minimum 60 % av ukesplan",
    thresholdOwner: "Salgssjef — Marte Solberg",
    suggestedAction: "Kurs i tidsbruk i felt",
    priority: "medium",
  },
  {
    id: "f3",
    name: "Mari Haugen",
    team: "Team Vest",
    rule: "Kvalitetsavvik registrert på to salg denne uken",
    numbers: "2 av 14 salg flagget for kvalitetskontroll",
    threshold: "Maks 1 avvik per uke uten oppfølging",
    thresholdOwner: "Kvalitetsansvarlig — Petter Holm",
    suggestedAction: "Kvalitetssjekk av siste registreringer",
    priority: "low",
  },
];

export interface Measure {
  id: string;
  person: string;
  action: string;
  owner: string;
  deadline: string;
  status: "open" | "closed";
  outcomeNote?: string;
}

export const MEASURES: Measure[] = [
  { id: "m1", person: "Jonas Berg", action: "Feltobservasjon gjennomført", owner: "Ola Nordmann", deadline: "14. aug 2026", status: "closed", outcomeNote: "Teknikk forbedret, følges opp igjen om 3 uker." },
  { id: "m2", person: "Sara Iversen", action: "Kurs i produktkunnskap", owner: "Ola Nordmann", deadline: "27. aug 2026", status: "open" },
];

export interface KpiDefinition {
  id: string;
  name: string;
  rule: string;
  version: string;
  effectiveFrom: string;
  owner: string;
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  consumers: string[];
  history: { version: string; at: string; by: string; note: string; rule: string }[];
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  { id: "k1", name: "Dører banket", rule: "Antall registrerte dørbesøk per promoter per dag", version: "v2.1", effectiveFrom: "1. jan 2026", owner: "Petter Holm", locked: true, lockedBy: "Petter Holm", lockedAt: "3. jan 2026", consumers: ["Promoter forside", "Leder teamresultater", "Dashboard.xlsx"], history: [{ version: "v2.1", at: "3. jan 2026", by: "Petter Holm", note: "Presisert at kun registrerte besøk teller, ikke planlagte.", rule: "Antall registrerte dørbesøk per promoter per dag" }, { version: "v2.0", at: "12. nov 2025", by: "Petter Holm", note: "Endret fra per uke til per dag.", rule: "Antall dørbesøk per promoter per dag" }, { version: "v1.0", at: "4. feb 2025", by: "Ola Nordmann", note: "Første definisjon.", rule: "Antall dørbesøk per promoter per uke" }] },
  { id: "k2", name: "Aktive givere", rule: "Godkjente donorer med aktiv avtale i perioden", version: "v1.4", effectiveFrom: "15. mar 2026", owner: "Petter Holm", locked: true, lockedBy: "Petter Holm", lockedAt: "15. mar 2026", consumers: ["Promoter forside", "Kundeportal", "KPI-ordbok"], history: [{ version: "v1.4", at: "15. mar 2026", by: "Petter Holm", note: "Lagt til krav om aktiv avtale ved periodeslutt.", rule: "Godkjente donorer med aktiv avtale i perioden" }, { version: "v1.3", at: "2. okt 2025", by: "Petter Holm", note: "Presisert at kun godkjente donorer teller.", rule: "Godkjente donorer i perioden" }, { version: "v1.0", at: "4. feb 2025", by: "Petter Holm", note: "Første definisjon.", rule: "Donorer registrert i perioden" }] },
  { id: "k3", name: "Ja-prosent", rule: "Andel dørbesøk som resulterer i registrert ja, ekskl. reklamasjoner", version: "v1.0", effectiveFrom: "1. jun 2026", owner: "Ola Nordmann", locked: false, consumers: ["Promoter forside", "Oppfølgingsbehov"], history: [{ version: "v1.0", at: "1. jun 2026", by: "Ola Nordmann", note: "Første definisjon. Reklamasjoner holdes utenfor.", rule: "Andel dørbesøk som resulterer i registrert ja, ekskl. reklamasjoner" }] },
  { id: "k4", name: "Rekrutterte givere", rule: "Nye donorer registrert og godkjent i perioden", version: "v1.2", effectiveFrom: "1. feb 2026", owner: "Petter Holm", locked: true, lockedBy: "Petter Holm", lockedAt: "2. feb 2026", consumers: ["Kundeportal", "Leder teamresultater"], history: [{ version: "v1.2", at: "2. feb 2026", by: "Petter Holm", note: "Lagt til krav om godkjenning.", rule: "Nye donorer registrert og godkjent i perioden" }, { version: "v1.0", at: "4. feb 2025", by: "Petter Holm", note: "Første definisjon.", rule: "Nye donorer registrert i perioden" }] },
  { id: "k5", name: "Fakturerbare givere", rule: "Aktive givere som oppfyller kundens faktureringsvilkår", version: "v0.9", effectiveFrom: "—", owner: "Ikke satt", locked: false, consumers: ["Kundeportal (økonomi, bak flagg)"], history: [{ version: "v0.9", at: "—", by: "Ikke satt", note: "Utkast. Faktureringsvilkår ikke avklart med økonomi.", rule: "Aktive givere som oppfyller kundens faktureringsvilkår" }] },
  { id: "k6", name: "Lojalitet", rule: "Andel givere som fortsatt er aktive etter 12 måneder", version: "v1.0", effectiveFrom: "1. jan 2026", owner: "Petter Holm", locked: true, lockedBy: "Petter Holm", lockedAt: "5. jan 2026", consumers: ["KPI-ordbok"], history: [{ version: "v1.0", at: "5. jan 2026", by: "Petter Holm", note: "Første definisjon.", rule: "Andel givere som fortsatt er aktive etter 12 måneder" }] },
  { id: "k7", name: "Kampanjekostnad", rule: "Ikke definert — venter på avklaring med økonomi", version: "v0.1", effectiveFrom: "—", owner: "Ikke satt", locked: false, consumers: ["Kundeportal (bak flagg)"], history: [{ version: "v0.1", at: "—", by: "Ikke satt", note: "Plassholder.", rule: "Ikke definert — venter på avklaring med økonomi" }] },
  { id: "k8", name: "Godkjent data", rule: "Data som har passert kvalitetskontroll og ikke er korrigert siden", version: "v3.0", effectiveFrom: "1. jan 2026", owner: "Petter Holm", locked: true, lockedBy: "Petter Holm", lockedAt: "1. jan 2026", consumers: ["Alle KPI-visninger"], history: [{ version: "v3.0", at: "1. jan 2026", by: "Petter Holm", note: "Lagt til at korrigering nullstiller godkjenning.", rule: "Data som har passert kvalitetskontroll og ikke er korrigert siden" }, { version: "v2.0", at: "8. sep 2025", by: "Petter Holm", note: "Skilt godkjent fra importert.", rule: "Data som har passert kvalitetskontroll" }, { version: "v1.0", at: "4. feb 2025", by: "Petter Holm", note: "Første definisjon.", rule: "Data importert fra Dashboard.xlsx" }] },
];

export interface Integration {
  id: string;
  name: string;
  consequence: string;
  kind: "import" | "job" | "feed";
  status: "ok" | "late" | "failed";
  schedule: string;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  minutesSinceSuccess: number | null;
  expectedEveryMinutes: number;
  owner: string;
  note: string | null;
}

/**
 * FR-A-10. One row per thing that can silently stop working.
 *
 * Deliberately mixed states: one healthy, one late but not yet failed, one
 * outright failed, and one that has never run. "Late" exists as its own state
 * because the interesting moment is *before* the failure — an administrator who
 * only ever sees red has already lost the morning.
 */
export const INTEGRATIONS: Integration[] = [
  { id: "int-1", name: "Dashboard.xlsx — nattlig import", consequence: "Uten denne står alle tall stille fra i går.", kind: "import", status: "ok", schedule: "Hver natt 03:00", lastSuccessAt: "21. aug 2026, 03:04", lastRunAt: "21. aug 2026, 03:04", minutesSinceSuccess: 1240, expectedEveryMinutes: 1440, owner: "Drift", note: null },
  { id: "int-2", name: "Kvalitetskontroll — godkjenning av salg", consequence: "Uten denne viser tallene rå registreringer, ikke godkjente salg.", kind: "feed", status: "late", schedule: "Hver time", lastSuccessAt: "21. aug 2026, 19:12", lastRunAt: "21. aug 2026, 22:00", minutesSinceSuccess: 190, expectedEveryMinutes: 60, owner: "Kvalitetsansvarlig — Petter Holm", note: "Siste kjøring startet, men fullførte ikke." },
  { id: "int-3", name: "AB Maps — ukeplan og ruter", consequence: "Uten denne oppdateres ikke ukeplanen for promotørene.", kind: "feed", status: "ok", schedule: "Hvert 15. minutt", lastSuccessAt: "21. aug 2026, 22:45", lastRunAt: "21. aug 2026, 22:45", minutesSinceSuccess: 9, expectedEveryMinutes: 15, owner: "Drift", note: null },
  { id: "int-4", name: "Læringsplattform — kursstatus", consequence: "Uten denne kan en promotør stå som manglende kurs etter at det er tatt.", kind: "feed", status: "failed", schedule: "Hver natt 02:30", lastSuccessAt: "19. aug 2026, 02:31", lastRunAt: "21. aug 2026, 02:30", minutesSinceSuccess: 2900, expectedEveryMinutes: 1440, owner: "HR", note: "Pålogging mot læringsplattformen ble avvist." },
  { id: "int-5", name: "Kunderapport — månedlig utsending", consequence: "Uten denne får ikke kundene rapporten sin automatisk.", kind: "job", status: "ok", schedule: "Den 1. hver måned", lastSuccessAt: "1. aug 2026, 06:00", lastRunAt: "1. aug 2026, 06:00", minutesSinceSuccess: 29820, expectedEveryMinutes: 44640, owner: "Drift", note: null },
  { id: "int-6", name: "Automatisk innlesing fra e-post", consequence: "Filer som sendes inn havner i køen for gjennomgang.", kind: "import", status: "ok", schedule: "Kontinuerlig", lastSuccessAt: "21. aug 2026, 21:38", lastRunAt: "21. aug 2026, 21:38", minutesSinceSuccess: 76, expectedEveryMinutes: 1440, owner: "Drift", note: null },
];

export interface InboxFile {
  id: string;
  file: string;
  period: string;
  arrivedAt: string;
  source: string;
  status: "awaiting-review" | "committed" | "rejected";
}

/** FR-I-08 — files that arrived on their own, waiting for the same review. */
export const INBOX_FILES: InboxFile[] = [
  { id: "in-1", file: "Dashboard_uke35.xlsx", period: "Uke 35, 2026", arrivedAt: "21. aug 2026, 21:38", source: "E-post fra rapport@abmarketing.no", status: "awaiting-review" },
];

export interface ImportCandidate {
  file: string;
  period: string;
  label: string;
}

/**
 * Files the demo can "upload". The third is deliberately a re-run of a period
 * already imported, so FR-I-03 (no double counting) has something to catch.
 */
export const IMPORT_CANDIDATES: ImportCandidate[] = [
  { file: "Dashboard_uke35.xlsx", period: "Uke 35, 2026", label: "Ny uke — 3 rader med feil" },
  { file: "Dashboard_uke35_rettet.xlsx", period: "Uke 35, 2026", label: "Rettet fil — ingen feil" },
  { file: "Dashboard_uke34.xlsx", period: "Uke 34, 2026", label: "Allerede importert — test av dobbelttelling" },
];

export interface ImportRun {
  id: string;
  file: string;
  period: string;
  accepted: number;
  rejected: number;
  runBy: string;
  runAt: string;
  status: "success" | "partial" | "failed";
}

export const IMPORT_RUNS: ImportRun[] = [
  { id: "r1", file: "Dashboard_uke34.xlsx", period: "Uke 34, 2026", accepted: 842, rejected: 3, runBy: "Admin Bruker", runAt: "20. aug 2026, 08:12", status: "partial" },
  { id: "r2", file: "Dashboard_uke33.xlsx", period: "Uke 33, 2026", accepted: 811, rejected: 0, runBy: "Admin Bruker", runAt: "13. aug 2026, 08:05", status: "success" },
  { id: "r3", file: "Dashboard_uke32.xlsx", period: "Uke 32, 2026", accepted: 0, rejected: 0, runBy: "Admin Bruker", runAt: "6. aug 2026, 07:58", status: "failed" },
];

export interface RejectedRow {
  id: string;
  row: number;
  reason: string;
  person: string;
}

export const REJECTED_ROWS: RejectedRow[] = [
  { id: "rr1", row: 47, reason: "Ukjent promoter-ID", person: "PR-1182" },
  { id: "rr2", row: 112, reason: "Negativt beløp uten korrigeringskode", person: "Even Svendsen" },
  { id: "rr3", row: 118, reason: "Manglende kampanjekobling", person: "Mari Haugen" },
];

export interface UserAccess {
  id: string;
  name: string;
  role: string;
  roleDefaults: string[];
  granted: string[];
  revoked: string[];
}

/**
 * FR-S-04 — the permission catalogue. Readable names, because "leader.view" is
 * a key and an administrator granting access to a colleague's results deserves
 * a sentence, not a token.
 */
export const PERMISSIONS = [
  { key: "promoter.view", label: "Egen promoterflate", description: "Egne resultater, ukeplan, mål, kurs og nyheter.", area: "Promoter", sensitive: false },
  { key: "leader.view", label: "Teamledelse", description: "Teamresultater, oppfølgingsbehov og tiltak for eget team.", area: "Leder", sensitive: true },
  { key: "saleschief.view", label: "Salgssjef", description: "Alle team i regionen, og fordeling av mål mellom dem.", area: "Leder", sensitive: true },
  { key: "recruitment.view", label: "Rekruttering", description: "Kandidatpipeline, kontrakter og onboarding.", area: "Rekruttering", sensitive: true },
  { key: "kpi.view", label: "KPI-ordbok", description: "Definisjoner, versjoner og hvilke skjermer som bruker dem.", area: "Kvalitet", sensitive: false },
  { key: "import.view", label: "Import", description: "Last opp Dashboard.xlsx, se avviste rader og kjørehistorikk.", area: "Kvalitet", sensitive: true },
  { key: "admin.view", label: "Administrasjon", description: "Brukere, tilganger, kundekontoer, forhåndsvisning og revisjonslogg.", area: "Administrasjon", sensitive: true },
];

export interface UserAccess {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
  active: boolean;
  mfa: boolean;
  lastSeen: string | null;
  roleDefaults: string[];
  granted: string[];
  revoked: string[];
  reasons: Record<string, string>;
}

export const USER_ACCESS: UserAccess[] = [
  { id: "u1", name: "Kari Nordmann", email: "kari@abmarketing.no", role: "Promoter", team: "Team Vest", active: true, mfa: false, lastSeen: "21. aug 2026, 07:41", roleDefaults: ["promoter.view"], granted: [], revoked: [], reasons: {} },
  // Granted one extra thing by hand — the case the screen exists to make visible.
  { id: "u2", name: "Ola Nordmann", email: "ola@abmarketing.no", role: "Team lead", team: "Team Vest", active: true, mfa: false, lastSeen: "21. aug 2026, 08:12", roleDefaults: ["leader.view", "promoter.view"], granted: ["kpi.view"], revoked: [], reasons: { "kpi.view": "Deltar i arbeidsgruppen for KPI-definisjoner." } },
  // Revoked from the role default — access removed by hand, and why.
  { id: "u3", name: "Sara Iversen", email: "sara@abmarketing.no", role: "Promoter", team: "Team Vest", active: true, mfa: false, lastSeen: "20. aug 2026, 16:02", roleDefaults: ["promoter.view"], granted: [], revoked: ["promoter.view"], reasons: { "promoter.view": "Permisjon ut september 2026, tilgang midlertidig fjernet." } },
  { id: "u4", name: "Marte Solberg", email: "marte@abmarketing.no", role: "Salgssjef", team: null, active: true, mfa: true, lastSeen: "21. aug 2026, 08:05", roleDefaults: ["leader.view", "saleschief.view"], granted: [], revoked: [], reasons: {} },
  { id: "u5", name: "Ingrid Aas", email: "ingrid@abmarketing.no", role: "Team lead", team: "Team Nord", active: true, mfa: false, lastSeen: "21. aug 2026, 07:58", roleDefaults: ["leader.view", "promoter.view"], granted: [], revoked: [], reasons: {} },
  { id: "u6", name: "Petter Ruud", email: "petter@abmarketing.no", role: "Team lead", team: "Team Sør", active: true, mfa: false, lastSeen: "21. aug 2026, 09:20", roleDefaults: ["leader.view", "promoter.view"], granted: [], revoked: [], reasons: {} },
  { id: "u7", name: "Hanne Lie", email: "hanne@abmarketing.no", role: "Team lead", team: "Team Øst", active: true, mfa: false, lastSeen: "19. aug 2026, 15:44", roleDefaults: ["leader.view", "promoter.view"], granted: [], revoked: [], reasons: {} },
  { id: "u8", name: "Fredrik Amundsen", email: "fredrik@abmarketing.no", role: "Rekrutterer", team: null, active: true, mfa: false, lastSeen: "21. aug 2026, 08:30", roleDefaults: ["recruitment.view"], granted: [], revoked: [], reasons: {} },
  { id: "u9", name: "Admin Bruker", email: "admin@abmarketing.no", role: "Administrator", team: null, active: true, mfa: true, lastSeen: "21. aug 2026, 08:44", roleDefaults: ["admin.view", "kpi.view", "import.view"], granted: [], revoked: [], reasons: {} },
  // Left the company — kept for the audit trail, but no access.
  { id: "u10", name: "Jonas Berg", email: "jonas@abmarketing.no", role: "Promoter", team: "Team Vest", active: false, mfa: false, lastSeen: "3. aug 2026, 17:12", roleDefaults: ["promoter.view"], granted: [], revoked: [], reasons: {} },
];

/**
 * FR-A-03 — customer accounts and their portal logins.
 *
 * Røde Kors and Strømmestiftelsen match the working demo logins in
 * `customer-session.tsx`, so the accounts an administrator sees here are the
 * ones that actually sign in — including the agreement, which the portal reads
 * back out of this same record. Leger Uten Grenser shows the state before a
 * login exists at all.
 */
/**
 * Three accounts on three deliberately different agreements (FR-C-07).
 *
 * The differences are the point. Røde Kors negotiated the full economics and
 * aggregate fieldwork; Strømmestiftelsen buys the headline result only, monthly,
 * with no view of the work behind it. If both saw the same screen the agreement
 * would be decoration, and the requirement asks for the opposite.
 *
 * `DEFAULT_AGREEMENT` is what a newly created account gets: the two figures
 * nobody argues about, and nothing else. A new customer is entitled to less
 * until somebody decides otherwise, not more until somebody notices.
 */
export const DEFAULT_AGREEMENT: CustomerAgreement = {
  figures: ["donorsAcquired", "totalPaid"],
  fieldworkDetail: "none",
  granularities: ["month", "year"],
  organisations: [],
  costDefinitionAgreed: false,
};

export const CUSTOMER_ACCOUNTS: CustomerAccount[] = [
  {
    id: "ca1", organisation: "Røde Kors", orgNumber: "864 138 442", contactName: "Ingrid Haug",
    email: "kontakt@rodekors.no", campaigns: ["Høstkampanjen 2026", "Vårkampanjen 2026"],
    provisioned: true, provisionedAt: "2. jun 2026", provisionedBy: "Admin Bruker",
    lastLogin: "20. aug 2026, 11:24", createdAt: "28. mai 2026",
    credentialsSentTo: "kontakt@rodekors.no", credentialsSentAt: "2. jun 2026, 09:12",
    agreement: {
      figures: ["donorsAcquired", "totalPaid", "averageMonthlyGift", "retention90", "campaignCost", "costPerDonor"],
      fieldworkDetail: "aggregate",
      granularities: ["week", "month", "year"],
      organisations: ["Røde Kors Hordaland", "Røde Kors Oslo", "Røde Kors Trøndelag"],
      costDefinitionAgreed: false,
    },
  },
  {
    id: "ca2", organisation: "Strømmestiftelsen", orgNumber: "952 002 139", contactName: "Bjarte Nes",
    email: "rapport@strommestiftelsen.no", campaigns: ["Strømmestiftelsen"],
    provisioned: true, provisionedAt: "14. jul 2026", provisionedBy: "Admin Bruker",
    lastLogin: null, createdAt: "12. jul 2026",
    credentialsSentTo: "rapport@strommestiftelsen.no", credentialsSentAt: "14. jul 2026, 15:40",
    agreement: {
      figures: ["donorsAcquired", "totalPaid", "averageMonthlyGift"],
      fieldworkDetail: "none",
      granularities: ["month", "year"],
      organisations: [],
      costDefinitionAgreed: false,
    },
  },
  {
    id: "ca3", organisation: "Leger Uten Grenser", orgNumber: "977 076 235", contactName: "Sofia Ratkovic",
    email: "norge@legerutengrenser.no", campaigns: ["Leger Uten Grenser"],
    provisioned: false, provisionedAt: null, provisionedBy: null, lastLogin: null,
    createdAt: "18. aug 2026", credentialsSentTo: null, credentialsSentAt: null,
    agreement: clone(DEFAULT_AGREEMENT),
  },
];

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  area: string;
  affected: string;
  before?: string;
  after?: string;
  at: string;
  ts: string;
}

/** Stages are an explicit, preliminary list (clarification 6 in the requirements
 * doc) — kept as plain data so the real stage set can drop in without touching
 * any component. Board view (FR-R-05) is intentionally not built until the
 * stages are confirmed; the list view below works with any stage set. */
export interface RecruitmentStage {
  id: string;
  label: string;
  fields: { id: string; label: string; placeholder?: string }[];
  terminal?: "hired" | "withdrawn";
}

export const RECRUITMENT_STAGES: RecruitmentStage[] = [
  { id: "ny", label: "Ny henvendelse", fields: [{ id: "kilde", label: "Bekreft kilde" }] },
  { id: "screening", label: "Screening", fields: [{ id: "screener", label: "Gjennomført av" }, { id: "notat", label: "Kort vurdering" }] },
  { id: "intervju", label: "Intervju", fields: [{ id: "dato", label: "Intervjudato" }, { id: "inntrykk", label: "Inntrykk" }] },
  { id: "referanse", label: "Referansesjekk", fields: [{ id: "referanse", label: "Referanseperson" }, { id: "resultat", label: "Resultat" }] },
  { id: "tilbud", label: "Tilbud sendt", fields: [{ id: "vilkar", label: "Tilbudte vilkår" }] },
  { id: "ansatt", label: "Ansatt", fields: [{ id: "startdato", label: "Startdato" }], terminal: "hired" },
  { id: "avsluttet", label: "Avsluttet", fields: [{ id: "arsak", label: "Årsak" }], terminal: "withdrawn" },
];

export interface CandidateHistoryEntry {
  id: string;
  at: string;
  actor: string;
  type: "created" | "stage-change" | "note";
  stageId?: string;
  detail: string;
}

export interface Candidate {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  campaign: string;
  appliedDate: string;
  owner: string;
  stageId: string;
  nextActivity?: { label: string; date: string; overdue?: boolean };
  history: CandidateHistoryEntry[];
  contract: "not-sent" | "sent" | "signed";
  onboarding: { id: string; task: string; done: boolean }[];
  closure: CandidateClosure | null;
}

/** FR-R-10 — access stops at closure; retention runs on for an agreed period. */
export interface CandidateClosure {
  endedAt: string;
  reason: string;
  accessRevokedAt: string;
  retentionUntil: string;
  retentionMonths: number;
  basis: string;
  minimised: boolean;
  retained: string[];
  removed: string[];
}

export const RETENTION_MONTHS = 6;
export const RETENTION_BASIS =
  "Avtalt oppbevaring: 6 måneder etter avsluttet prosess, for å kunne dokumentere begrunnelsen for ansettelsesvalget.";
export const RETENTION_RETAINED = [
  "Navn",
  "Kampanje og kilde",
  "Hvilket steg prosessen ble avsluttet på",
  "Begrunnelsen som ble registrert",
];
export const RETENTION_REMOVED = [
  "Telefonnummer",
  "E-postadresse",
  "Fritekstnotater fra intervju og referanser",
];

export const CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "Amalie Strand",
    phone: "+47 912 34 567",
    email: "amalie.strand@email.no",
    source: "Finn.no annonse",
    campaign: "Høstkampanjen 2026",
    appliedDate: "12. aug 2026",
    owner: "Fredrik Amundsen",
    stageId: "intervju",
    nextActivity: { label: "Ring for å avtale intervjutid", date: "19. aug 2026", overdue: true },
    contract: "not-sent",
    onboarding: [],
    closure: null,
    history: [
      { id: "h1", at: "12. aug 2026, 09:14", actor: "Fredrik Amundsen", type: "created", detail: "Kandidat opprettet fra Finn.no-annonse." },
      { id: "h2", at: "13. aug 2026, 11:02", actor: "Fredrik Amundsen", type: "stage-change", stageId: "screening", detail: "Flyttet til Screening. Kort vurdering: Godt muntlig, ingen erfaring fra dør-til-dør." },
      { id: "h3", at: "16. aug 2026, 14:30", actor: "Fredrik Amundsen", type: "stage-change", stageId: "intervju", detail: "Flyttet til Intervju. Intervjudato ikke avtalt ennå." },
    ],
  },
  {
    id: "c2",
    name: "Tobias Wiig",
    phone: "+47 934 55 210",
    email: "tobias.wiig@email.no",
    source: "Henvist av ansatt",
    campaign: "Høstkampanjen 2026",
    appliedDate: "5. aug 2026",
    owner: "Fredrik Amundsen",
    stageId: "referanse",
    nextActivity: { label: "Følge opp referanseperson", date: "21. aug 2026" },
    contract: "not-sent",
    onboarding: [],
    closure: null,
    history: [
      { id: "h1", at: "5. aug 2026, 08:40", actor: "Fredrik Amundsen", type: "created", detail: "Kandidat opprettet — henvist av Kari Nordmann." },
      { id: "h2", at: "7. aug 2026, 10:15", actor: "Fredrik Amundsen", type: "stage-change", stageId: "screening", detail: "Flyttet til Screening. Gjennomført av: Fredrik Amundsen." },
      { id: "h3", at: "11. aug 2026, 13:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "intervju", detail: "Flyttet til Intervju. Inntrykk: Strukturert, motivert, spørsmål om provisjon." },
      { id: "h4", at: "18. aug 2026, 09:45", actor: "Fredrik Amundsen", type: "stage-change", stageId: "referanse", detail: "Flyttet til Referansesjekk. Referanseperson: tidligere leder hos Elkjøp." },
    ],
  },
  {
    id: "c3",
    name: "Sunniva Berge",
    phone: "+47 998 12 344",
    email: "sunniva.berge@email.no",
    source: "Instagram-kampanje",
    campaign: "Vårkampanjen 2026",
    appliedDate: "2. jul 2026",
    owner: "Fredrik Amundsen",
    stageId: "tilbud",
    nextActivity: { label: "Purre svar på tilbud", date: "17. aug 2026", overdue: true },
    contract: "sent",
    onboarding: [],
    closure: null,
    history: [
      { id: "h1", at: "2. jul 2026, 12:00", actor: "Fredrik Amundsen", type: "created", detail: "Kandidat opprettet fra Instagram-kampanje." },
      { id: "h2", at: "4. jul 2026, 09:30", actor: "Fredrik Amundsen", type: "stage-change", stageId: "screening", detail: "Flyttet til Screening." },
      { id: "h3", at: "9. jul 2026, 15:20", actor: "Fredrik Amundsen", type: "stage-change", stageId: "intervju", detail: "Flyttet til Intervju. Inntrykk: Svært god." },
      { id: "h4", at: "16. jul 2026, 10:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "referanse", detail: "Flyttet til Referansesjekk. Resultat: Positiv." },
      { id: "h5", at: "24. jul 2026, 11:10", actor: "Fredrik Amundsen", type: "stage-change", stageId: "tilbud", detail: "Flyttet til Tilbud sendt. Tilbudte vilkår: Standard promoteravtale." },
    ],
  },
  {
    id: "c4",
    name: "Markus Ellingsen",
    phone: "+47 901 22 887",
    email: "markus.ellingsen@email.no",
    source: "Finn.no annonse",
    campaign: "Vårkampanjen 2026",
    appliedDate: "18. jun 2026",
    owner: "Fredrik Amundsen",
    stageId: "ansatt",
    contract: "signed",
    history: [
      { id: "h1", at: "18. jun 2026, 08:00", actor: "Fredrik Amundsen", type: "created", detail: "Kandidat opprettet fra Finn.no-annonse." },
      { id: "h2", at: "20. jun 2026, 10:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "screening", detail: "Flyttet til Screening." },
      { id: "h3", at: "24. jun 2026, 13:30", actor: "Fredrik Amundsen", type: "stage-change", stageId: "intervju", detail: "Flyttet til Intervju." },
      { id: "h4", at: "1. jul 2026, 09:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "referanse", detail: "Flyttet til Referansesjekk." },
      { id: "h5", at: "6. jul 2026, 14:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "tilbud", detail: "Flyttet til Tilbud sendt." },
      { id: "h6", at: "12. jul 2026, 11:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "ansatt", detail: "Flyttet til Ansatt. Startdato: 1. august 2026." },
    ],
    onboarding: [
      { id: "o1", task: "Arbeidsavtale signert", done: true },
      { id: "o2", task: "Personalia registrert i systemet", done: true },
      { id: "o3", task: "GDPR og personvern i felt fullført", done: true },
      { id: "o4", task: "Introduksjon til AB Marketing fullført", done: false },
      { id: "o5", task: "Utstyr utlevert", done: false },
    ],
    closure: null,
  },
  {
    id: "c5",
    name: "Ida Karlsen",
    phone: "+47 977 40 019",
    email: "ida.karlsen@email.no",
    source: "Henvist av ansatt",
    campaign: "Høstkampanjen 2026",
    appliedDate: "8. aug 2026",
    owner: "Fredrik Amundsen",
    stageId: "ny",
    nextActivity: { label: "Førstegangskontakt", date: "22. aug 2026" },
    contract: "not-sent",
    onboarding: [],
    closure: null,
    history: [{ id: "h1", at: "8. aug 2026, 16:20", actor: "Fredrik Amundsen", type: "created", detail: "Kandidat opprettet — henvist av Ola Nordmann." }],
  },
  {
    id: "c6",
    name: "Henrik Moe",
    phone: "+47 920 66 133",
    email: "henrik.moe@email.no",
    source: "Finn.no annonse",
    campaign: "Vårkampanjen 2026",
    appliedDate: "14. mai 2026",
    owner: "Fredrik Amundsen",
    stageId: "avsluttet",
    contract: "not-sent",
    onboarding: [],
    closure: null,
    history: [
      { id: "h1", at: "14. mai 2026, 10:00", actor: "Fredrik Amundsen", type: "created", detail: "Kandidat opprettet fra Finn.no-annonse." },
      { id: "h2", at: "16. mai 2026, 09:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "screening", detail: "Flyttet til Screening." },
      { id: "h3", at: "22. mai 2026, 11:00", actor: "Fredrik Amundsen", type: "stage-change", stageId: "avsluttet", detail: "Flyttet til Avsluttet. Årsak: Kandidat trakk søknaden." },
    ],
  },
];

export interface PendingCorrection {
  id: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  reason: string;
  affectedPeriods: string[];
  affectedKpis: string[];
  affectedPeople: string[];
  affectedCustomerReports: string[];
  before: string;
  after: string;
}

export const PENDING_CORRECTIONS: PendingCorrection[] = [
  {
    id: "corr-1",
    description: "Even Svendsen — dører uke 33 korrigert fra 58 til 62",
    requestedBy: "Ola Nordmann",
    requestedAt: "19. aug 2026, 14:20",
    reason: "Manuell telling avdekket at 4 dører ikke ble registrert i appen pga. nettverksfeil i felt.",
    before: "58 dører",
    after: "62 dører",
    affectedPeriods: ["Uke 33, 2026"],
    affectedKpis: ["Dører banket", "Ja-prosent"],
    affectedPeople: ["Even Svendsen"],
    affectedCustomerReports: [],
  },
  {
    id: "corr-2",
    description: "12 givere flyttet fra Vårkampanjen til Høstkampanjen",
    requestedBy: "Petter Holm",
    requestedAt: "18. aug 2026, 09:10",
    reason: "Feil kampanjekobling ved import — giverne ble registrert dagen kampanjen byttet.",
    before: "12 givere på Vårkampanjen 2026",
    after: "12 givere på Høstkampanjen 2026",
    affectedPeriods: ["Uke 33, 2026", "Uke 34, 2026"],
    affectedKpis: ["Aktive givere", "Rekrutterte givere"],
    affectedPeople: ["Nora Larsen", "Mari Haugen"],
    affectedCustomerReports: ["Røde Kors — Kampanjerapport"],
  },
];

export const AUDIT_LOG: AuditEntry[] = [
  { id: "a4", actor: "Ola Nordmann", action: "Avviste forslag", area: "Oppfølgingsbehov", affected: "Nora Larsen — signal ja-prosent", at: "20. aug 2026, 10:05", ts: "2026-08-20T10:05:00.000Z" },
  { id: "a1", actor: "Admin Bruker", action: "Korrigerte KPI", area: "Kvalitet", affected: "Even Svendsen — Uke 33", before: "58 dører", after: "62 dører", at: "19. aug 2026, 16:40", ts: "2026-08-19T16:40:00.000Z" },
  { id: "a3", actor: "Admin Bruker", action: "Fjernet tilgang", area: "Tilganger", affected: "Sara Iversen", before: "promoter.view", after: "—", at: "12. aug 2026, 11:03", ts: "2026-08-12T11:03:00.000Z" },
  { id: "a2", actor: "Petter Holm", action: "Låste KPI-definisjon", area: "KPI-ordbok", affected: "Aktive givere v1.4", at: "15. mar 2026, 09:12", ts: "2026-03-15T09:12:00.000Z" },
];
