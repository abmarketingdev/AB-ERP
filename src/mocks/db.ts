/**
 * In-memory database behind the mock API.
 *
 * Mutable on purpose: a candidate created in a dialog must still be there after
 * navigating away and back, or the "closed loop" the product depends on is a lie.
 * Resets on hard reload, which is the correct scope for a demo.
 *
 * Fixture rules from doc 03 are enforced here, not decorative:
 * yes-rates sit between 4 % and 12 %, doors between 40 and 90, some people are
 * below threshold and some above, at least one correction is applied, and at
 * least one KPI reports an approved-only value visibly lower than its raw count.
 */

import type { KpiValue } from "@/types/kpi";
import type {
  WeekDay,
  GoalCard,
  Course,
  NewsItem,
  CorrectionNotice,
  DailyResult,
  PacePoint,
} from "@/types/promoter";
import type {
  FollowUpRow,
  Measure,
  TeamMember,
  TrendPoint,
  DeviationPoint,
  Threshold,
  TeamCourseRow,
  CourseGap,
  GoalPlan,
  PersonDetail,
  TeamHistory,
  PersonGoal,
  OrgGoalPlan,
} from "@/types/leader";
import type { Candidate, RecruitmentStage } from "@/types/recruitment";
import type {
  KpiDefinition,
  PendingCorrection,
  DecidedCorrection,
  AuditEntry,
  ImportRun,
  RejectedRow,
  UserAccess,
  CustomerAccount,
  OrgEntity,
  Integration,
  InboxFile,
  DefinitionImpact,
} from "@/types/quality";

import {
  UKEPLAN,
  PROMOTER_GOAL,
  LEADER_TEAM_GOAL,
  PROMOTER_COURSES,
  NEWS,
  MEASURES,
  KPI_DEFINITIONS,
  IMPORT_RUNS,
  REJECTED_ROWS,
  USER_ACCESS,
  PERMISSIONS,
  CUSTOMER_ACCOUNTS,
  CAMPAIGNS,
  INTEGRATIONS,
  INBOX_FILES,
  RECRUITMENT_STAGES,
  CANDIDATES,
  PENDING_CORRECTIONS,
  AUDIT_LOG,
} from "@/lib/mock-data";

/** Deterministic PRNG so fixtures never shift between renders. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NOW = "2026-08-20T09:12:00.000Z";

export const PERIOD_MONTH = {
  granularity: "month" as const,
  from: "2026-08-01",
  to: "2026-08-31",
  label: "August 2026",
};

// ── People ────────────────────────────────────────────────────────────────────
// Re-exported so fixtures here and the admin form share one definition.
export { CAMPAIGNS };

/**
 * Four teams under one sales chief. Doc 01: scope is a parameter, not a separate
 * build — the same screens, filtered.
 *
 * The teams differ on purpose, because a comparison view is worthless if every
 * team looks the same. Each one is a distinct management problem:
 *
 *  - **Vest** — mid-table, slightly behind plan. The reference case.
 *  - **Nord** — the strong team. Ahead of plan, almost no follow-ups. The point
 *    of including it is that a chief needs somewhere to look for what works.
 *  - **Sør** — in trouble. Most of the team under the door threshold, well
 *    behind plan, and carrying most of the region's follow-up load.
 *  - **Øst** — new and ramping. Low volume but on plan for its own target, with
 *    a large course backlog because it was staffed recently. Behind on *courses*
 *    while fine on *sales* — deliberately, so the two never collapse into one
 *    "good team / bad team" axis.
 */
export const TEAMS = [
  { id: "t1", name: "Team Vest", region: "Bergen", lead: "Ola Nordmann" },
  { id: "t2", name: "Team Nord", region: "Trondheim", lead: "Ingrid Aas" },
  { id: "t3", name: "Team Sør", region: "Kristiansand", lead: "Petter Ruud" },
  { id: "t4", name: "Team Øst", region: "Oslo", lead: "Hanne Lie" },
];

export const ALL_TEAM_IDS = TEAMS.map((t) => t.id);
export const teamName = (id: string) => TEAMS.find((t) => t.id === id)?.name ?? id;

/** Doors below this per day is what the follow-up engine flags (FR-L-14). */
const DOOR_THRESHOLD = 60;
/** Working days in the period, and how many have elapsed. */
const PERIOD_DAYS = 31;
const PERIOD_ELAPSED = 20;

export interface Person {
  id: string;
  name: string;
  teamId: string;
  campaign: string;
  /** Doors per day — the figure the threshold is applied to. */
  doors: number;
  yesRate: number;
  /** Active donors so far this period. The single source: KPIs, goals and rows all read it. */
  donors: number;
  /** Goal for the period, and the goal at period start (FR-L-13). */
  target: number;
  baseline: number;
  absenceDays: number;
  goalChange?: { at: string; by: string; reason: string };
}

/**
 * One row per person, and every other fixture is derived from it. Previously the
 * team KPI, the member list and the goal plan each carried their own copy of
 * "active donors" and quietly disagreed; deriving removes the whole class of
 * bug rather than fixing three numbers.
 */
const PEOPLE: Person[] = [
  // ── Team Vest — mid-table, slightly behind (donors sum to 401)
  { id: "p1", name: "Kari Nordmann", teamId: "t1", campaign: CAMPAIGNS[0], doors: 71, yesRate: 7.6, donors: 74, target: 140, baseline: 140, absenceDays: 3 },
  { id: "p2", name: "Jonas Berg", teamId: "t1", campaign: CAMPAIGNS[0], doors: 46, yesRate: 6.1, donors: 33, target: 52, baseline: 52, absenceDays: 0 },
  { id: "p3", name: "Sara Iversen", teamId: "t1", campaign: CAMPAIGNS[1], doors: 58, yesRate: 6.8, donors: 46, target: 68, baseline: 68, absenceDays: 0 },
  { id: "p4", name: "Kristoffer Bjørnstad-Sæther", teamId: "t1", campaign: CAMPAIGNS[0], doors: 84, yesRate: 8.2, donors: 71, target: 92, baseline: 92, absenceDays: 0 },
  { id: "p5", name: "Nora Larsen", teamId: "t1", campaign: CAMPAIGNS[2], doors: 42, yesRate: 4.4, donors: 26, target: 45, baseline: 50, absenceDays: 4, goalChange: { at: "18. aug 2026", by: "Ola Nordmann, teamleder", reason: "Redusert etter sykefravær i uke 33." } },
  { id: "p6", name: "Marius Hansen", teamId: "t1", campaign: CAMPAIGNS[1], doors: 63, yesRate: 7.0, donors: 50, target: 70, baseline: 70, absenceDays: 0 },
  { id: "p7", name: "Even Svendsen", teamId: "t1", campaign: CAMPAIGNS[0], doors: 77, yesRate: 7.9, donors: 61, target: 78, baseline: 78, absenceDays: 0 },
  { id: "p8", name: "Mari Haugen", teamId: "t1", campaign: CAMPAIGNS[2], doors: 51, yesRate: 6.4, donors: 40, target: 55, baseline: 55, absenceDays: 0 },

  // ── Team Nord — strongest, ahead of plan (donors 360 against 480)
  { id: "p9", name: "Åse Kvam", teamId: "t2", campaign: CAMPAIGNS[0], doors: 82, yesRate: 8.1, donors: 68, target: 88, baseline: 88, absenceDays: 0 },
  { id: "p10", name: "Lars Bakken", teamId: "t2", campaign: CAMPAIGNS[1], doors: 75, yesRate: 7.4, donors: 61, target: 80, baseline: 80, absenceDays: 0 },
  { id: "p11", name: "Silje Moen", teamId: "t2", campaign: CAMPAIGNS[0], doors: 69, yesRate: 7.9, donors: 58, target: 74, baseline: 74, absenceDays: 0 },
  { id: "p12", name: "Tom Rise", teamId: "t2", campaign: CAMPAIGNS[1], doors: 88, yesRate: 8.6, donors: 72, target: 92, baseline: 92, absenceDays: 0 },
  { id: "p13", name: "Ida Fossum", teamId: "t2", campaign: CAMPAIGNS[2], doors: 64, yesRate: 6.8, donors: 48, target: 68, baseline: 68, absenceDays: 2 },
  { id: "p14", name: "Henrik Dahl", teamId: "t2", campaign: CAMPAIGNS[0], doors: 71, yesRate: 7.2, donors: 53, target: 78, baseline: 78, absenceDays: 0 },

  // ── Team Sør — in trouble; five of seven under the door threshold (donors 194 against 460)
  { id: "p15", name: "Bjørn Ås", teamId: "t3", campaign: CAMPAIGNS[1], doors: 44, yesRate: 4.2, donors: 24, target: 62, baseline: 62, absenceDays: 0 },
  { id: "p16", name: "Kine Holt", teamId: "t3", campaign: CAMPAIGNS[1], doors: 39, yesRate: 3.9, donors: 19, target: 55, baseline: 55, absenceDays: 0 },
  { id: "p17", name: "Rune Sæther", teamId: "t3", campaign: CAMPAIGNS[0], doors: 58, yesRate: 5.1, donors: 34, target: 70, baseline: 70, absenceDays: 0 },
  { id: "p18", name: "Trine Berg", teamId: "t3", campaign: CAMPAIGNS[2], doors: 47, yesRate: 4.6, donors: 27, target: 64, baseline: 64, absenceDays: 0 },
  { id: "p19", name: "Ola Vik", teamId: "t3", campaign: CAMPAIGNS[0], doors: 52, yesRate: 5.4, donors: 31, target: 66, baseline: 66, absenceDays: 0 },
  { id: "p20", name: "Guro Lind", teamId: "t3", campaign: CAMPAIGNS[2], doors: 41, yesRate: 4.0, donors: 21, target: 58, baseline: 58, absenceDays: 5 },
  { id: "p21", name: "Stian Moe", teamId: "t3", campaign: CAMPAIGNS[1], doors: 61, yesRate: 5.8, donors: 38, target: 72, baseline: 72, absenceDays: 0 },

  // ── Team Øst — new, ahead of pace on its own target, big course backlog (donors 195 against 290)
  { id: "p22", name: "Amir Nazari", teamId: "t4", campaign: CAMPAIGNS[0], doors: 66, yesRate: 6.9, donors: 44, target: 60, baseline: 60, absenceDays: 0 },
  { id: "p23", name: "Emma Lund", teamId: "t4", campaign: CAMPAIGNS[1], doors: 59, yesRate: 6.2, donors: 33, target: 54, baseline: 54, absenceDays: 0 },
  { id: "p24", name: "Jakob Five", teamId: "t4", campaign: CAMPAIGNS[0], doors: 72, yesRate: 7.1, donors: 50, target: 64, baseline: 64, absenceDays: 0 },
  { id: "p25", name: "Sofie Hagen", teamId: "t4", campaign: CAMPAIGNS[2], doors: 55, yesRate: 5.9, donors: 29, target: 50, baseline: 50, absenceDays: 0 },
  { id: "p26", name: "Nils Berge", teamId: "t4", campaign: CAMPAIGNS[1], doors: 63, yesRate: 6.5, donors: 39, target: 58, baseline: 58, absenceDays: 0 },
];

/** Team-level figures the person rows cannot carry. */
/**
 * `loyalty` is 12-month retention for the cohort signed a year ago, so it is a
 * property of last August's work, not this month's — deliberately uncorrelated
 * with the current figures. Team Sør has the weakest approved share and the
 * best loyalty: the people they sign stay, they just sign fewer of them. A
 * fixture where every quality number moves together teaches the wrong lesson.
 */
const TEAM_FACTS: Record<
  string,
  { target: number; approvedShare: number; recruited: number; loyalty: number }
> = {
  t1: { target: 620, approvedShare: 94.2, recruited: 268, loyalty: 78.4 },
  t2: { target: 480, approvedShare: 96.1, recruited: 240, loyalty: 74.9 },
  t3: { target: 460, approvedShare: 89.4, recruited: 150, loyalty: 83.1 },
  t4: { target: 290, approvedShare: 92.8, recruited: 195, loyalty: 71.2 },
};

export function peopleIn(teamIds: string[]): Person[] {
  return PEOPLE.filter((p) => teamIds.includes(p.teamId));
}

function sparkFor(seed: number, base: number, len = 12): number[] {
  const r = rng(seed);
  return Array.from({ length: len }, () => Math.round(base * (0.78 + r() * 0.44)));
}

export function buildTeamMembers(teamIds: string[] = ALL_TEAM_IDS): TeamMember[] {
  return peopleIn(teamIds).map((p, i) => {
    const yes = Math.max(1, Math.round((p.doors * p.yesRate) / 100));
    return {
      id: p.id,
      name: p.name,
      team: teamName(p.teamId),
      campaign: p.campaign,
      doors: p.doors,
      yes,
      yesRate: p.yesRate,
      activeDonors: p.donors,
      spark: sparkFor(i * 31 + 7, p.doors),
      belowThreshold: p.doors < DOOR_THRESHOLD,
    };
  });
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function kpi(
  key: KpiValue["key"],
  label: string,
  value: number,
  unit: KpiValue["unit"],
  opts: Partial<KpiValue> = {},
): KpiValue {
  return {
    key,
    label,
    subject: "Kari Nordmann",
    value,
    unit,
    period: PERIOD_MONTH,
    approvedOnly: true,
    definitionVersion: "v2.1",
    computedAt: NOW,
    source: "analytics",
    ...opts,
  };
}

export type KpiGranularity = "day" | "week" | "month";

/**
 * FR-P-04: doors, active donors and yes-rate with a day / week / month toggle.
 * Each granularity returns its own figures, comparison label and trend length —
 * a toggle that only relabels the same number is worse than no toggle.
 */
export function promoterKpis(granularity: KpiGranularity = "week"): KpiValue[] {
  /*
   * Derived from the very rows the table below renders, not written by hand.
   *
   * The two used to be independent fixtures, and they disagreed: the day view
   * showed "62 dører" in the tile and 52 in the table for the same date. On a
   * screen whose whole job is "these are your numbers", two answers to one
   * question is the worst possible bug — the promoter cannot tell which is
   * theirs, and neither can the leader they take it to.
   */
  const rows = dailyResults(granularity);
  const doors = rows.reduce((n, d) => n + d.doors, 0);
  const yes = rows.reduce((n, d) => n + d.yes, 0);
  const rate = Math.round((yes / Math.max(1, doors)) * 1000) / 10;
  // Approved-only, and therefore visibly lower than the raw yes count. This is
  // the gap the "kun godkjente salg" label exists to explain (FR-P-05).
  const donors = rows.reduce(
    (n, d) => n + (d.fullyApproved ? d.yes : Math.round(d.yes * APPROVED_SHARE_PENDING)),
    0,
  );

  const cfg = {
    day: {
      compare: "mot i går",
      doorsDelta: -8,
      donorsDelta: 1,
      rateDelta: -0.7,
      period: { granularity: "day" as const, from: "2026-08-20", to: "2026-08-20", label: "20. august 2026" },
    },
    week: {
      compare: "mot forrige uke",
      doorsDelta: 12,
      donorsDelta: -4,
      rateDelta: 0.4,
      period: { granularity: "week" as const, from: "2026-08-17", to: "2026-08-23", label: "Uke 34" },
    },
    month: {
      compare: "mot forrige måned",
      doorsDelta: 5,
      donorsDelta: 22,
      rateDelta: -0.2,
      period: PERIOD_MONTH,
    },
  }[granularity];

  const base = { period: cfg.period };
  /*
   * The sparkline is the actual daily series, not a synthetic one shaped to
   * look plausible. One day has no series at all, and a flat line drawn for it
   * reads as "no activity" rather than "no trend to show" — so it gets none.
   */
  const spark = (pick: (d: DailyResult) => number) =>
    rows.length > 1 ? rows.map(pick) : undefined;

  return [
    kpi("doors_knocked", "Dører banket", doors, "count", {
      ...base,
      delta: {
        value: cfg.doorsDelta,
        direction: cfg.doorsDelta >= 0 ? "up" : "down",
        comparisonLabel: cfg.compare,
      },
      spark: spark((d) => d.doors),
      definitionVersion: "v2.1",
    }),
    kpi("active_donors", "Aktive givere", donors, "count", {
      ...base,
      delta: {
        value: cfg.donorsDelta,
        direction: cfg.donorsDelta >= 0 ? "up" : "down",
        comparisonLabel: cfg.compare,
      },
      spark: spark((d) => d.yes),
      definitionVersion: "v1.4",
    }),
    kpi("yes_rate", "Ja-prosent", rate, "percent", {
      ...base,
      delta: {
        value: cfg.rateDelta,
        direction: cfg.rateDelta >= 0 ? "up" : "down",
        comparisonLabel: cfg.compare,
      },
      spark: spark((d) => d.yesRate),
      definitionVersion: "v1.0",
    }),
  ];
}

export interface TeamRollup {
  id: string;
  name: string;
  region: string;
  lead: string;
  headcount: number;
  doorsPerDay: number;
  doorsTotal: number;
  yesRate: number;
  donors: number;
  target: number;
  /** Where a steady pace puts the team today. */
  expected: number;
  approvedShare: number;
  recruited: number;
  /** 12-month retention for the cohort signed a year ago (FR-Q-01). */
  loyalty: number;
  belowThreshold: number;
  coursesMissing: number;
  followUps: number;
  spark: number[];
}

export function teamRollup(teamId: string): TeamRollup {
  const team = TEAMS.find((t) => t.id === teamId)!;
  const members = PEOPLE.filter((p) => p.teamId === teamId);
  const facts = TEAM_FACTS[teamId];

  const doorsPerDay = members.reduce((n, p) => n + p.doors, 0);
  const yes = members.reduce((n, p) => n + (p.doors * p.yesRate) / 100, 0);
  // Read from mutable state, not the fixture: when a sales chief moves a team
  // target, every KPI and every chart derived from it has to move with it.
  const target = db.teamGoals.find((g) => g.id === teamId)?.target ?? facts.target;

  return {
    id: team.id,
    name: team.name,
    region: team.region,
    lead: team.lead,
    headcount: members.length,
    doorsPerDay,
    doorsTotal: doorsPerDay * PERIOD_ELAPSED,
    // Weighted by doors, not a mean of means — a mean of per-person rates would
    // let the smallest promoter move the team figure as much as the largest.
    yesRate: Math.round((yes / doorsPerDay) * 1000) / 10,
    donors: members.reduce((n, p) => n + p.donors, 0),
    target,
    expected: Math.round((target * PERIOD_ELAPSED) / PERIOD_DAYS),
    approvedShare: facts.approvedShare,
    recruited: facts.recruited,
    loyalty: facts.loyalty,
    belowThreshold: members.filter((p) => p.doors < DOOR_THRESHOLD).length,
    coursesMissing: teamCourseStatus([teamId]).reduce((n, r) => n + r.missing.length, 0),
    followUps: buildFollowUps([teamId]).length,
    spark: sparkFor(teamId.charCodeAt(1) * 97, Math.round(doorsPerDay / 8)),
  };
}

export function teamRollups(teamIds: string[] = ALL_TEAM_IDS): TeamRollup[] {
  return teamIds.map(teamRollup);
}

/**
 * FR-L-01 for whatever scope the caller is entitled to. A team lead gets their
 * team; a sales chief gets the sum across theirs, with the subject naming which.
 */
export function leaderKpis(teamIds: string[] = ["t1"]): KpiValue[] {
  const rolls = teamRollups(teamIds);
  const subject = rolls.length === 1 ? rolls[0].name : `${rolls.length} team`;
  const suffix = rolls.length === 1 ? ", team" : ", alle team";

  const sum = (pick: (r: TeamRollup) => number) => rolls.reduce((n, r) => n + pick(r), 0);
  const doorsTotal = sum((r) => r.doorsTotal);
  const weighted = (pick: (r: TeamRollup) => number) =>
    Math.round((rolls.reduce((n, r) => n + pick(r) * r.doorsTotal, 0) / doorsTotal) * 10) / 10;
  // Loyalty is a property of a cohort of donors, so it is weighted by how many
  // donors each team contributed — not by doors, which would let a team that
  // knocks a lot and signs few dominate a retention figure.
  const recruitedTotal = sum((r) => r.recruited);
  const weightedByCohort = (pick: (r: TeamRollup) => number) =>
    Math.round((rolls.reduce((n, r) => n + pick(r) * r.recruited, 0) / recruitedTotal) * 10) / 10;

  return [
    kpi("doors_knocked", `Dører banket${suffix}`, doorsTotal, "count", {
      subject,
      delta: { value: 6, direction: "up", comparisonLabel: "mot forrige måned" },
      spark: sparkFor(401, Math.round(doorsTotal / 29)),
    }),
    kpi("active_donors", `Aktive givere${suffix}`, sum((r) => r.donors), "count", {
      subject,
      delta: { value: -3, direction: "down", comparisonLabel: "mot forrige måned" },
      spark: sparkFor(402, Math.round(sum((r) => r.donors) / 12)),
    }),
    kpi("yes_rate", `Ja-prosent${suffix}`, weighted((r) => r.yesRate), "percent", {
      subject,
      delta: { value: -0.2, direction: "down", comparisonLabel: "mot forrige måned" },
      spark: sparkFor(403, 7),
    }),
    // FR-L-01 names quality explicitly — the approved share is what makes the
    // rest of the numbers trustworthy, so it is a tile, not a footnote.
    kpi("billable", `Andel godkjent${suffix}`, weighted((r) => r.approvedShare), "percent", {
      subject,
      delta: { value: 1.1, direction: "up", comparisonLabel: "mot forrige måned" },
      spark: sparkFor(405, 94),
      definitionVersion: "v3.0",
      source: "qc",
    }),
    kpi("recruited_donors", "Rekrutterte givere", sum((r) => r.recruited), "count", {
      subject,
      delta: { value: 9, direction: "up", comparisonLabel: "mot forrige måned" },
      spark: sparkFor(404, 22),
    }),
    /*
     * FR-Q-01's sixth KPI. Loyalty is 12-month retention, so it cannot describe
     * this month's work — it describes the donors signed a year ago, and the
     * period says exactly that. A retention figure stamped with the current
     * month is the most common way this number gets misread: a team lead sees
     * it fall and asks their people about last week.
     */
    kpi("loyalty", `Lojalitet${suffix}`, weightedByCohort((r) => r.loyalty), "percent", {
      subject,
      period: {
        granularity: "month",
        from: "2025-08-01",
        to: "2026-07-31",
        label: "Kohort aug. 2025",
      },
      delta: { value: 0.8, direction: "up", comparisonLabel: "mot kohorten før" },
      spark: sparkFor(406, 79),
      definitionVersion: "v1.0",
      source: "qc",
    }),
  ];
}

/**
 * Own results per day (FR-P-03). Deliberately uneven: doors between 40 and 90,
 * yes-rates in the real 4–12 % band, two days off, and one recent day still
 * awaiting quality approval so the "kun godkjente" label has something to explain.
 */
export function dailyResults(granularity: KpiGranularity = "week"): DailyResult[] {
  const r = rng(granularity === "day" ? 7 : granularity === "month" ? 31 : 14);
  // Working days in August 2026, ending today (the 20th, a Thursday in the
  // fixture's calendar). Weekends are absent because nobody knocks on Sunday,
  // and the weekday must match the date — a table with two Mondays in a row is
  // the kind of detail that makes a reader distrust every other number on the
  // page.
  const ALL_DAYS = [
    { n: 3, w: "Mandag" }, { n: 4, w: "Tirsdag" }, { n: 5, w: "Onsdag" },
    { n: 6, w: "Torsdag" }, { n: 7, w: "Fredag" },
    { n: 10, w: "Mandag" }, { n: 11, w: "Tirsdag" }, { n: 12, w: "Onsdag" },
    { n: 13, w: "Torsdag" }, { n: 14, w: "Fredag" },
    { n: 17, w: "Mandag" }, { n: 18, w: "Tirsdag" }, { n: 19, w: "Onsdag" },
    { n: 20, w: "Torsdag" },
  ];
  const days =
    granularity === "day"
      ? ALL_DAYS.slice(-1)
      : granularity === "week"
        ? ALL_DAYS.slice(-3)
        : ALL_DAYS;

  return days.map((day, i) => {
    const doors = Math.round(40 + r() * 50);
    const rate = 4 + r() * 8;
    const yes = Math.max(1, Math.round((doors * rate) / 100));
    return {
      date: `2026-08-${String(day.n).padStart(2, "0")}`,
      label: `${day.n}. aug`,
      weekday: day.w,
      doors,
      yes,
      yesRate: Math.round((yes / doors) * 1000) / 10,
      // The most recent day is still partly unapproved.
      fullyApproved: i < days.length - 1,
      isToday: day.n === 20,
    };
  });
}

/** The share of a not-yet-approved day's sales that survives quality control.
 *  Doc 03 requires at least one KPI whose approved-only value is visibly lower
 *  than its raw count; this is where that gap comes from. */
const APPROVED_SHARE_PENDING = 0.6;

/**
 * Actual against expected pace across the month (FR-P-07). Actual stops at
 * today — the remaining days are null rather than zero, so the line ends
 * instead of diving to the axis.
 */
/**
 * The promoter's goal as one function, so every endpoint that describes it
 * describes the same thing.
 *
 * The `goal-reached` scenario used to be applied in the handler for
 * `/promoter/goal` alone, which put "146 of 140" on the card and a line ending
 * at 74 in the chart directly beneath it. Same screen, same figure, two
 * answers. A scenario has to move the whole picture or it isn't a scenario.
 */
export function promoterGoalFor(reached = false): GoalCard {
  if (!reached) return db.promoterGoal;
  return {
    ...db.promoterGoal,
    // Reached, and reached with days to spare — the honest shape of the moment,
    // not a figure sitting exactly on its target.
    current: db.promoterGoal.target + 6,
    status: "ahead",
  };
}

export function goalPace(reached = false): PacePoint[] {
  const g = promoterGoalFor(reached);
  const effectiveTotal = Math.max(1, g.daysTotal - g.absenceDays);
  const elapsedDays = Math.max(0, g.daysTotal - g.daysRemaining);
  const r = rng(88);

  const points = Array.from({ length: 7 }, (_, i) => {
    const dayOfPeriod = Math.round(((i + 1) / 7) * g.daysTotal);
    // Expected pace is spread over working days with absence removed — the same
    // rule `goalMath` applies to the card, so the chart and the card beside it
    // can never tell different stories.
    const workedDay = Math.max(0, Math.min(effectiveTotal, dayOfPeriod - g.absenceDays));
    return {
      dayOfPeriod,
      expected: Math.round((g.target * workedDay) / effectiveTotal),
      past: dayOfPeriod <= elapsedDays,
    };
  });

  // A monotone climb with some wobble, normalised so the final elapsed point
  // lands exactly on the figure the goal card shows.
  let acc = 0;
  const walk = points.filter((p) => p.past).map(() => (acc += 0.85 + r() * 0.3));
  const last = walk[walk.length - 1] ?? 1;

  let k = 0;
  return points.map((p) => ({
    label: `${p.dayOfPeriod}. aug`,
    expected: p.expected,
    actual: p.past ? Math.round((walk[k++] / last) * g.current) : null,
  }));
}

/**
 * FR-L-11 / FR-L-12 — team course status.
 *
 * Kari's row is built from the same course list her own Kurs screen renders, so
 * what her leader sees and what she sees cannot drift apart. The gap pattern is
 * deliberate: GDPR is missing for most of the team, which is a rollout problem
 * rather than five individual failures — and the screen is built to show it that
 * way round.
 */
export function teamCourseStatus(teamIds: string[] = ALL_TEAM_IDS): TeamCourseRow[] {
  const catalogue = PROMOTER_COURSES.filter((c) => c.mandatory);
  const gap = (id: string, status: "not-started" | "in-progress"): CourseGap => {
    const c = catalogue.find((x) => x.id === id)!;
    return {
      courseId: c.id,
      title: c.title,
      status,
      deadline: c.deadline,
      daysToDeadline: c.daysToDeadline,
    };
  };

  const missingBy: Record<string, CourseGap[]> = {
    // Mirrors db.courses exactly — same person, same four outstanding courses.
    "Kari Nordmann": [
      gap("c1", "not-started"),
      gap("c2", "in-progress"),
      gap("c3", "not-started"),
      gap("c6", "not-started"),
    ],
    "Jonas Berg": [gap("c1", "in-progress")],
    "Sara Iversen": [gap("c1", "not-started"), gap("c6", "not-started")],
    "Kristoffer Bjørnstad-Sæther": [],
    "Nora Larsen": [],
    "Marius Hansen": [gap("c1", "not-started")],
    "Even Svendsen": [gap("c1", "not-started"), gap("c2", "not-started"), gap("c6", "not-started")],
    "Mari Haugen": [gap("c1", "not-started"), gap("c3", "not-started")],
  };

  /**
   * How much course backlog each team carries. Team Øst is the point: it is on
   * plan for sales and badly behind on courses, because it was staffed
   * recently. Keeping those two axes independent stops the whole product
   * collapsing into one "good team / bad team" ranking.
   */
  const BACKLOG: Record<string, number> = { t2: 0.12, t3: 0.4, t4: 0.72 };
  const OPTIONAL = catalogue.filter((c) => c.id !== "c5");

  return peopleIn(teamIds).map((p, i) => {
    let missing: CourseGap[];
    if (p.teamId === "t1") {
      missing = missingBy[p.name] ?? [];
    } else {
      const r = rng(i * 613 + p.id.charCodeAt(1) * 31);
      const rate = BACKLOG[p.teamId] ?? 0.2;
      missing = OPTIONAL.filter(() => r() < rate).map((c) =>
        gap(c.id, r() < 0.3 ? "in-progress" : "not-started"),
      );
    }
    return {
      person: p.name,
      completed: catalogue.length - missing.length,
      mandatory: catalogue.length,
      missing,
    };
  });
}

/**
 * FR-L-03 / FR-L-04 — people below an approved threshold, ordered by priority,
 * each row naming the rule and the actual numbers in readable text.
 *
 * Derived from the same person rows the KPIs are built from rather than kept as
 * a separate list. A follow-up queue that can disagree with the figures it cites
 * is worse than none: the first thing a leader does is check the number.
 */
export function buildFollowUps(teamIds: string[] = ALL_TEAM_IDS): FollowUpRow[] {
  const rows: FollowUpRow[] = [];

  for (const [i, p] of peopleIn(teamIds).entries()) {
    const team = teamName(p.teamId);
    const spark = sparkFor(i * 47 + 3, p.doors, 12);

    if (p.doors < DOOR_THRESHOLD) {
      const short = Math.round(((DOOR_THRESHOLD - p.doors) / DOOR_THRESHOLD) * 100);
      rows.push({
        id: `fu-${p.id}-doors`,
        personId: p.id,
        name: p.name,
        team,
        rule: "Under terskel for dører per dag",
        numbers: `${p.doors} dører per dag mot terskel ${DOOR_THRESHOLD}, snitt siste 10 arbeidsdager (${short} % under)`,
        threshold: `${DOOR_THRESHOLD} dører/dag`,
        thresholdOwner: "Drift",
        suggestedAction: short > 25 ? "Feltobservasjon" : "Samtale om planlegging av ruter",
        priority: short > 25 ? "high" : "medium",
        spark,
      });
    }

    if (p.yesRate < 5) {
      rows.push({
        id: `fu-${p.id}-yes`,
        personId: p.id,
        name: p.name,
        team,
        rule: "Ja-prosent under godkjent grense",
        numbers: `${String(p.yesRate).replace(".", ",")} % ja mot grense 5,0 %, siste 3 uker`,
        threshold: "5,0 % ja",
        thresholdOwner: "Drift",
        suggestedAction: "Samtale om teknikk",
        priority: p.yesRate < 4.2 ? "high" : "medium",
        spark,
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return rows.sort((a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name, "nb-NO"));
}


/** Person-level goals for every team, derived from the single person table. */
export function buildPersonGoals(): PersonGoal[] {
  return PEOPLE.map((p) => ({
    id: `g-${p.id}`,
    person: p.name,
    campaign: p.campaign,
    teamId: p.teamId,
    target: p.target,
    baseline: p.baseline,
    current: p.donors,
    daysRemaining: PERIOD_DAYS - PERIOD_ELAPSED,
    daysTotal: PERIOD_DAYS,
    absenceDays: p.absenceDays,
    updatedAt: p.goalChange?.at ?? null,
    updatedBy: p.goalChange?.by ?? null,
    reason: p.goalChange?.reason ?? null,
  }));
}

/** Team-level goals — the figures a sales chief distributes and adjusts. */
export function buildTeamGoals() {
  return TEAMS.map((t) => ({
    id: t.id,
    target: TEAM_FACTS[t.id].target,
    baseline: TEAM_FACTS[t.id].target,
    updatedAt: null as string | null,
    updatedBy: null as string | null,
    reason: null as string | null,
  }));
}

export const GOAL_LIMIT = {
  maxChangePct: 15,
  minTarget: 20,
  maxTarget: 200,
  owner: "Salgssjef Vest",
  effectiveFrom: "1. jan 2026",
  rationale:
    "M\u00e5l kan justeres inntil 15 % fra utgangspunktet ved frav\u00e6r, kampanjebytte eller endret omr\u00e5de. St\u00f8rre endringer avtales med salgssjef.",
};

/** The same limit one level up, in team-sized units. */
export const TEAM_GOAL_LIMIT = {
  maxChangePct: 15,
  minTarget: 100,
  maxTarget: 1200,
  owner: "Regiondirekt\u00f8r",
  effectiveFrom: "1. jan 2026",
  rationale:
    "Teammål kan justeres inntil 15 % fra utgangspunktet ved omfordeling mellom team. Større endringer avtales med regiondirektør.",
};

export const ORG_TARGET = 1900;

/** FR-L-13 for one team: its target, its limit, and its people. */
export function goalPlanFor(teamId: string): GoalPlan {
  const roll = teamRollup(teamId);
  return {
    period: PERIOD_MONTH.label,
    unit: "givere",
    teamTarget: roll.target,
    teamTargetSetBy: "Salgssjef Vest",
    daysRemaining: PERIOD_DAYS - PERIOD_ELAPSED,
    daysTotal: PERIOD_DAYS,
    limit: GOAL_LIMIT,
    people: db.personGoals.filter((g) => g.teamId === teamId),
  };
}

/** FR-L-13 for the sales chief: the org target distributed across teams. */
export function orgGoalPlan(teamIds: string[] = ALL_TEAM_IDS): OrgGoalPlan {
  return {
    period: PERIOD_MONTH.label,
    unit: "givere",
    orgTarget: ORG_TARGET,
    orgTargetSetBy: "Regiondirekt\u00f8r",
    daysRemaining: PERIOD_DAYS - PERIOD_ELAPSED,
    daysTotal: PERIOD_DAYS,
    limit: TEAM_GOAL_LIMIT,
    teams: teamIds.map((id) => {
      const roll = teamRollup(id);
      const g = db.teamGoals.find((x) => x.id === id)!;
      return {
        id,
        name: roll.name,
        region: roll.region,
        lead: roll.lead,
        headcount: roll.headcount,
        target: roll.target,
        baseline: g.baseline,
        current: roll.donors,
        allocated: db.personGoals.filter((x) => x.teamId === id).reduce((n, x) => n + x.target, 0),
        updatedAt: g.updatedAt,
        updatedBy: g.updatedBy,
        reason: g.reason,
      };
    }),
  };
}


/**
 * FR-A-01 — the cross-organisation overview.
 *
 * Counts alone are a vanity panel; each row also carries the few items an
 * administrator would otherwise open another screen to see, and a link to where
 * the real work happens. Everything is derived from the same tables the rest of
 * the product reads, so the overview cannot claim a team that does not exist.
 */
export function orgOverview(): OrgEntity[] {
  const active = db.userAccess.filter((u) => u.active);
  const provisioned = db.customerAccounts.filter((c) => c.provisioned);

  return [
    {
      key: "customers",
      label: "Kunder",
      count: db.customerAccounts.length,
      detail: `${provisioned.length} med portaltilgang, ${db.customerAccounts.length - provisioned.length} uten`,
      href: "/admin/kunder",
      items: db.customerAccounts.map((c) => ({
        name: c.organisation,
        meta: c.provisioned ? `Portal aktiv · ${c.campaigns.length} kampanjer` : "Ingen portaltilgang",
      })),
    },
    {
      key: "campaigns",
      label: "Kampanjer",
      count: CAMPAIGNS.length,
      detail: "Aktive kampanjer i perioden",
      href: null,
      items: CAMPAIGNS.map((c) => ({
        name: c,
        meta: `${PEOPLE.filter((p) => p.campaign === c).length} personer`,
      })),
    },
    {
      key: "departments",
      label: "Avdelinger",
      count: new Set(TEAMS.map((t) => t.region)).size,
      detail: "Geografiske avdelinger",
      href: null,
      items: TEAMS.map((t) => ({ name: t.region, meta: t.name })),
    },
    {
      key: "teams",
      label: "Team",
      count: TEAMS.length,
      detail: `${PEOPLE.length} personer totalt`,
      href: "/leder/team",
      items: TEAMS.map((t) => ({
        name: t.name,
        meta: `${t.lead} · ${PEOPLE.filter((p) => p.teamId === t.id).length} personer`,
      })),
    },
    {
      key: "users",
      label: "Brukere",
      count: db.userAccess.length,
      detail: `${active.length} aktive, ${db.userAccess.length - active.length} deaktivert`,
      href: "/admin/tilganger",
      items: db.userAccess.map((u) => ({
        name: u.name,
        meta: u.active ? `${u.role}${u.mfa ? " · 2FA" : ""}` : "Deaktivert",
      })),
    },
  ];
}

/**
 * Doc 04 person detail. The band is derived from the person's own doors figure
 * rather than a constant, so a low-volume promoter gets a low band and reads as
 * normal — which is the entire argument for showing it.
 */
export function personDetail(personId: string): PersonDetail | null {
  const p = PEOPLE.find((x) => x.id === personId);
  if (!p) return null;

  const r = rng(p.id.charCodeAt(1) * 811 + 17);
  const spread = Math.max(6, Math.round(p.doors * 0.16));
  const series = Array.from({ length: 30 }, (_, i) => {
    const drift = Math.sin(i / 5) * spread * 0.35;
    const doors = Math.max(8, Math.round(p.doors + drift + (r() - 0.5) * spread * 1.6));
    return {
      label: `${i + 1}. aug`,
      doors,
      yes: Math.max(0, Math.round((doors * p.yesRate) / 100)),
      band: [Math.round(p.doors - spread), Math.round(p.doors + spread)] as [number, number],
      belowThreshold: doors < DOOR_THRESHOLD,
    };
  });

  const mix = ["Uke 31", "Uke 32", "Uke 33", "Uke 34"].map((label, w) => ({
    label,
    segments: CAMPAIGNS.map((c, ci) => ({
      key: c,
      // The person's own campaign carries most of it; the rest is spillover.
      value: Math.max(0, Math.round((c === p.campaign ? 14 : 4) * (0.7 + r() * 0.6) + w * 0.4 - ci)),
    })),
  }));

  return {
    id: p.id,
    name: p.name,
    team: teamName(p.teamId),
    teamId: p.teamId,
    campaign: p.campaign,
    baseline: p.doors,
    threshold: DOOR_THRESHOLD,
    thresholdOwner: "Drift",
    doorsPerDay: p.doors,
    yesRate: p.yesRate,
    donors: p.donors,
    target: p.target,
    daysBelowThreshold: series.filter((d) => d.belowThreshold).length,
    daysBelowBaseline: series.filter((d) => d.doors < d.band[0]).length,
    series,
    mix,
  };
}

/**
 * FR-K-06 — recompute three past periods under a proposed rule.
 *
 * Deterministic from the definition id and the proposal text, so the same
 * proposal always produces the same impact — a preview that shifted between
 * viewings would be worse than none.
 */
export function definitionImpact(definitionId: string, proposal: string): DefinitionImpact[] {
  const seed =
    definitionId.charCodeAt(1) * 131 +
    [...proposal].reduce((n, c) => n + c.charCodeAt(0), 0);
  const r = rng(seed);

  return ["Juni 2026", "Juli 2026", "August 2026"].map((period, i) => {
    const current = Math.round(380 + r() * 260);
    // A wording change that narrows a rule reduces the count; the sign is
    // stable per proposal so the preview reads consistently across periods.
    const direction = seed % 2 === 0 ? -1 : 1;
    const delta = Math.round(current * (0.02 + r() * 0.07)) * direction;
    const people = 2 + Math.floor(r() * 4);

    const names = ["Kari Nordmann", "Even Svendsen", "Mari Haugen", "Sara Iversen", "Jonas Berg"];
    return {
      period,
      currentValue: current,
      proposedValue: current + delta,
      unit: "givere",
      affectedPeople: people,
      // Only closed periods were ever sent to a customer.
      affectedCustomerReports: i < 2 ? [`Røde Kors ${period.toLowerCase()}`] : [],
      examples: Array.from({ length: Math.min(3, people) }, (_, k) => {
        const from = 20 + Math.round(r() * 40);
        return { name: names[(seed + k) % names.length], from, to: from + Math.round(delta / people) };
      }),
    };
  });
}

/**
 * Doc 04's Teamresultater series, scoped. Derived from the same team targets
 * everything else reads, so the monthly plan here and the goal screen's target
 * cannot disagree.
 */
export function teamHistory(teamIds: string[] = ["t1"]): TeamHistory {
  const rolls = teamRollups(teamIds);
  const monthlyTarget = rolls.reduce((n, t) => n + t.target, 0);
  const r = rng(teamIds.join("").length * 733 + 11);

  const MONTHS = ["Mar", "Apr", "Mai", "Jun", "Jul", "Aug"];
  const months = MONTHS.map((label, i) => {
    // August is the period in progress, so it is deliberately short — a partial
    // month drawn as if it were complete is the most common dashboard lie.
    const inProgress = i === MONTHS.length - 1;
    const factor = inProgress ? 0.63 : 0.86 + r() * 0.3;
    return { label, actual: Math.round(monthlyTarget * factor), plan: monthlyTarget };
  });

  let a = 0;
  let p = 0;
  const accumulated = months.map((m) => {
    a += m.actual;
    p += m.plan;
    return { label: m.label, actual: a, plan: p };
  });

  const recruitedPerWeek = Array.from({ length: 12 }, (_, i) => ({
    label: `Uke ${23 + i}`,
    value: Math.round((rolls.reduce((n, t) => n + t.recruited, 0) / 12) * (0.7 + r() * 0.7)),
  }));

  return { months, accumulated, recruitedPerWeek };
}

export function permissionCatalogue() {
  return PERMISSIONS;
}

/** FR-L-14 — the thresholds the follow-up engine applies, with their owners. */
export function thresholds(): Threshold[] {
  return [
    { key: "doors_per_day", label: "Dører per dag", value: 60, unit: "dører/dag", owner: "Drift", effectiveFrom: "1. jan 2026" },
    { key: "yes_rate", label: "Ja-prosent", value: 5, unit: "%", owner: "Drift", effectiveFrom: "1. jun 2026" },
    { key: "baseline_drop", label: "Fall mot egen baseline", value: -20, unit: "%", owner: "Drift", effectiveFrom: "1. jan 2026" },
  ];
}

/** FR-L-01 — is follow-up load rising? Fourteen days, one bar per day. */
export function deviationTrend(teamIds: string[] = ["t1"]): DeviationPoint[] {
  const r = rng(4242);
  // Scale with the number of flagged people actually in scope, so a sales chief
  // sees a bigger bar than a team lead rather than the same chart relabelled.
  const load = Math.max(1, buildFollowUps(teamIds).length / 3);
  return Array.from({ length: 14 }, (_, i) => ({
    label: `${7 + i}. aug`,
    value: Math.round(r() * 4 * load),
  }));
}

/**
 * Weekly active donors against the weekly share of the month's target.
 *
 * This used to plot **doors** against a plan computed from the **donor**
 * target — around 2 475 against 2 604, two different quantities on one pair of
 * axes with the dashed line labelled "Plan". The numbers looked plausible,
 * sat next to a tile reading 401, and answered no question at all.
 *
 * Both series are now donors, derived from the same target the goal card and
 * the KPI tile read, so all three agree by construction rather than by luck.
 */
export function teamTrend(teamIds: string[] = ["t1"]): TrendPoint[] {
  const r = rng(555);
  const rolls = teamRollups(teamIds);
  const monthlyTarget = rolls.reduce((n, t) => n + t.target, 0);
  const donorsSoFar = rolls.reduce((n, t) => n + t.donors, 0);

  // A month is 31 days; the weekly plan is the target spread across them.
  const weeklyPlan = Math.round((monthlyTarget * 7) / PERIOD_DAYS);
  // And the weekly run-rate is what has actually been delivered, per week
  // elapsed — so the line sits where the tile above it says the team is.
  const weeklyActual = (donorsSoFar * 7) / PERIOD_ELAPSED;

  return ["Uke 30", "Uke 31", "Uke 32", "Uke 33", "Uke 34"].map((label, i) => ({
    label,
    actual: Math.round(weeklyActual * (0.9 + r() * 0.18) + i * (weeklyActual * 0.015)),
    plan: weeklyPlan,
  }));
}

// ── Mutable state ─────────────────────────────────────────────────────────────
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const STORAGE_KEY = "ab-erp-mock-db";

/**
 * Bump this whenever the *shape* of anything in `seed` changes.
 *
 * The snapshot below is merged key by key, so an object restored from an older
 * session replaces its seed counterpart whole — and any field added to that
 * fixture since is simply absent. The API client then rejects its own mock
 * payload, which surfaces to the user as "Dataene fra serveren hadde uventet
 * format" on a product that has no server at all.
 *
 * Discarding a stale snapshot is the right fix rather than deep-merging it:
 * a deep merge would silently graft new fields onto old values and could
 * assemble a record that never existed in either version.
 *
 * v2 — goals gained absenceDays/absenceNote/setBy; courses gained minutes,
 *      modules, completedOn, nullable deadlines, and lost the "overdue" status.
 * v3 — added goalPlan (FR-L-13).
 * v4 — goalPlan gained period length (daysRemaining/daysTotal).
 * v5 — four teams; goalPlan split into personGoals + teamGoals; follow-ups derived.
 * v6 — admin: richer userAccess, permission catalogue, customer accounts.
 * v7 — audit entries gained a sortable ts.
 * v8 — KPI version history; import preview/commit; decided corrections.
 * v9 — integration health (FR-A-10); automated ingestion inbox (FR-I-08).
 */
const SCHEMA_VERSION = 11;

interface Snapshot {
  v: number;
  data: Partial<Db>;
}

const seed = {
  weekPlan: clone(UKEPLAN) as WeekDay[],
  promoterGoal: clone(PROMOTER_GOAL) as GoalCard,
  leaderGoal: clone(LEADER_TEAM_GOAL) as GoalCard,
  personGoals: buildPersonGoals(),
  teamGoals: buildTeamGoals(),
  courses: clone(PROMOTER_COURSES) as Course[],
  news: clone(NEWS) as NewsItem[],
  measures: clone(MEASURES) as Measure[],
  kpiDefinitions: clone(KPI_DEFINITIONS) as KpiDefinition[],
  importRuns: clone(IMPORT_RUNS) as ImportRun[],
  rejectedRows: clone(REJECTED_ROWS) as RejectedRow[],
  userAccess: clone(USER_ACCESS) as UserAccess[],
  customerAccounts: clone(CUSTOMER_ACCOUNTS) as CustomerAccount[],
  integrations: clone(INTEGRATIONS) as Integration[],
  inbox: clone(INBOX_FILES) as InboxFile[],
  stages: clone(RECRUITMENT_STAGES) as RecruitmentStage[],
  candidates: clone(CANDIDATES) as Candidate[],
  corrections: clone(PENDING_CORRECTIONS) as PendingCorrection[],
  decidedCorrections: [] as DecidedCorrection[],
  audit: clone(AUDIT_LOG) as AuditEntry[],
  teamMembers: buildTeamMembers(ALL_TEAM_IDS),

  /** Corrections that have been committed, surfaced to promoter and customer. */
  correctionNotices: [
    {
      id: "cn-1",
      at: "18. aug 2026",
      summary: "2 salg justert etter kvalitetssjekk 12. juni",
      delta: -2,
    },
  ] as CorrectionNotice[],

  followUps: buildFollowUps(ALL_TEAM_IDS),

  /**
   * The samleinnboks overlay.
   *
   * The 10 000-lead corpus is generated, not stored (see mocks/leads.ts). Only
   * what the demo actually changes lives here, which keeps the persisted
   * snapshot small enough for sessionStorage and makes "what did I change in
   * this session" inspectable.
   */
  leadOverrides: {} as Record<string, Partial<import("@/types/lead").Lead>>,
  /** Leads created during the demo — the stand form (LEAD-05) writes here. */
  leadExtra: [] as import("@/types/lead").Lead[],
};

export type Db = typeof seed;

/**
 * Persisted to sessionStorage so a write survives a full page reload.
 *
 * Without this the cascade is not demonstrable: an administrator approves a
 * correction, reloads, and it is gone — which reads as a bug rather than as a
 * deliberate scope limit. Session scope is right: a new tab starts clean, and
 * `resetDb()` is wired to the demo scenario switch.
 */
function hydrate(): Db {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const saved = JSON.parse(raw) as Partial<Snapshot>;
    // A snapshot from a different shape is thrown away, not repaired. Anything
    // without a stamp predates versioning and is stale by definition.
    if (saved?.v !== SCHEMA_VERSION || !saved.data) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return seed;
    }
    // Merge over the seed so a fixture added after a session started still appears.
    return { ...seed, ...saved.data };
  } catch {
    return seed;
  }
}

export const db: Db = hydrate();

export function persistDb() {
  if (typeof window === "undefined") return;
  try {
    const snapshot: Snapshot = { v: SCHEMA_VERSION, data: db };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private mode — the demo still works, it just won't survive reload.
  }
}

export function resetDb() {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(STORAGE_KEY);
  Object.assign(db, clone(seed));
}
