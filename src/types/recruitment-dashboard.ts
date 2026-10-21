import { z } from "zod";

/**
 * DASH-01 … DASH-08 — rekrutteringsdashboardet.
 *
 * DASH-01 says this replaces the PDF reports sent by e-mail, which sets the
 * bar: it has to answer the questions the PDF answered, on screen, filtered.
 * Everything here is computed by recruitment-service from the status log on
 * read (A5, `/api/recruitment/dashboard/…`), because DASH-05 and the note under
 * §5 both say the status log is what frafall and no-shows are counted from.
 * Each rule is written once, in the server's KPI dictionary (`kpi-definitions`).
 */

export const funnelStepSchema = z.object({
  stageId: z.string(),
  label: z.string(),
  /** How many have ever reached this step, not how many sit there now. */
  reached: z.number(),
  /** Lost between the previous step and this one. */
  droppedBefore: z.number(),
  /** reached / leads received, 0-1. */
  conversion: z.number(),
});
export type FunnelStep = z.infer<typeof funnelStepSchema>;

/** DASH-02 — ikke møtt, both to interview and to the first working day. */
export const noShowRowSchema = z.object({
  key: z.string(),
  interviewsHeldOrMissed: z.number(),
  interviewNoShows: z.number(),
  firstDayExpected: z.number(),
  firstDayNoShows: z.number(),
  interviewRate: z.number().nullable(),
  firstDayRate: z.number().nullable(),
  /** Share over both kinds combined. Null when there was nothing to count. */
  rate: z.number().nullable(),
  /** Observations behind `rate`. Under the server's floor, `alarm` is false. */
  n: z.number(),
  alarm: z.boolean(),
});
export type NoShowRow = z.infer<typeof noShowRowSchema>;

/**
 * DASH-03 — promotørkvalitet. Two halves in one row (master, 2026-10-21): what
 * the people they brought in became, and their own work — attendance days,
 * approved agreements (HR, final) and agreements per attendance day.
 */
export const promoterQualityRowSchema = z.object({
  promoterId: z.string(),
  promoter: z.string(),
  leads: z.number(),
  qualified: z.number(),
  hired: z.number(),
  robust: z.number(),
  attendanceDays: z.number(),
  /** «Godkjente avtaler» in the UI (SRS l.4); the field keeps HR's name. */
  sales: z.number(),
  salesProvisional: z.number(),
  efficiency: z.number().nullable(),
});
export type PromoterQualityRow = z.infer<typeof promoterQualityRowSchema>;

/**
 * DASH-04 — kanalkvalitet: which channels produce people who stay and become robust.
 * "Robust" is the SRS's own answered question: 50 approved agreements (final).
 */
export const ROBUST_SALES_THRESHOLD = 50;

export const channelQualityRowSchema = z.object({
  channel: z.string(),
  leads: z.number(),
  hired: z.number(),
  /** Still active 90 days after hire, among those hired at least 90 days ago. */
  retained: z.number(),
  retained30: z.number(),
  eligible30: z.number(),
  retained90: z.number(),
  eligible90: z.number(),
  robust: z.number(),
  hireRate: z.number().nullable(),
  robustRate: z.number().nullable(),
  retention30Rate: z.number().nullable(),
  retention90Rate: z.number().nullable(),
});
export type ChannelQualityRow = z.infer<typeof channelQualityRowSchema>;

const durationSchema = z.object({ median: z.number().nullable(), p75: z.number().nullable(), n: z.number() });

/** DASH-06 — tid fra lead til intervju og til ansatt, i dager. Median, not mean. */
export const timingSchema = z.object({ leadToInterview: durationSchema, leadToHire: durationSchema });

export const dashboardSchema = z.object({
  funnel: z.array(funnelStepSchema),
  noShowByChannel: z.array(noShowRowSchema),
  noShowByLeader: z.array(noShowRowSchema),
  noShowByPeriod: z.array(noShowRowSchema),
  promoterQuality: z.array(promoterQualityRowSchema),
  channelQuality: z.array(channelQualityRowSchema),
  timing: timingSchema,
  /** What the filter actually matched, so the reader knows the base. */
  basis: z.object({
    candidates: z.number(),
    leads: z.number(),
    period: z.string(),
    filters: z.record(z.string(), z.unknown()),
    scope: z.enum(["alle", "egne"]),
    computedAt: z.string(),
    definitionVersion: z.string(),
    sources: z.object({ salesSyncedAt: z.string().nullable(), salesSource: z.enum(["hr", "mock"]).nullable().optional() }),
    minObservationsForAlarm: z.number(),
    /** Leads from A3's mock applicant generator (staging demos), left out unless asked for. */
    simulatedLeads: z.number().default(0),
  }),
});
export type RecruitmentDashboard = z.infer<typeof dashboardSchema>;

export const dashboardFilterOptionsSchema = z.object({
  channels: z.array(z.object({ key: z.string(), name: z.string(), kind: z.string() })),
  teams: z.array(z.object({ id: z.string(), name: z.string(), region: z.string() })),
  regions: z.array(z.string()),
});
export type DashboardFilterOptions = z.infer<typeof dashboardFilterOptionsSchema>;

export const kpiDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  srs: z.string(),
  rule: z.string(),
  source: z.string(),
  version: z.string(),
  common: z.string(),
});
export const kpiDefinitionListSchema = z.array(kpiDefinitionSchema);

export const reportSubscriptionSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["ukentlig", "manedlig"]),
  filters: z.record(z.string(), z.unknown()),
  scope: z.enum(["alle", "egne"]),
  lastSentAt: z.string().nullable(),
});
export type ReportSubscription = z.infer<typeof reportSubscriptionSchema>;

export interface DashboardFilter {
  from?: string;
  to?: string;
  region?: string;
  teamId?: string;
  channel?: string;
  includeImported?: boolean;
  includeSimulated?: boolean;
  groupBy?: "uke" | "maned";
}
