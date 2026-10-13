import { z } from "zod";

/**
 * DASH-01 … DASH-08 — rekrutteringsdashboardet.
 *
 * DASH-01 says this replaces the PDF reports sent by e-mail, which sets the
 * bar: it has to answer the questions the PDF answered, on screen, filtered.
 * Everything here is computed from the status log, because DASH-05 and the note
 * under §5 both say the status log is what frafall and no-shows are counted
 * from — anything derived another way would disagree with it.
 */

export const funnelStepSchema = z.object({
  stageId: z.string(),
  label: z.string(),
  /** How many have ever reached this step, not how many sit there now. */
  reached: z.number(),
  /** Lost between the previous step and this one. */
  droppedBefore: z.number(),
  /** reached / reached-at-first-step, 0-1. */
  conversion: z.number(),
});
export type FunnelStep = z.infer<typeof funnelStepSchema>;

/** DASH-02 — ikke møtt, both to interview and to the first working day. */
export const noShowRowSchema = z.object({
  key: z.string(),
  interviewsBooked: z.number(),
  interviewNoShows: z.number(),
  firstDayExpected: z.number(),
  firstDayNoShows: z.number(),
  /** Share, 0-1, over both kinds combined. Null when nothing was booked. */
  rate: z.number().nullable(),
});
export type NoShowRow = z.infer<typeof noShowRowSchema>;

/** DASH-03 — promotørkvalitet: leads, kvalifiserte, ansatte, oppmøte, effektivitet. */
export const promoterQualityRowSchema = z.object({
  promoter: z.string(),
  leads: z.number(),
  qualified: z.number(),
  hired: z.number(),
  /** Attendance days worked, from the shift data. */
  attendanceDays: z.number(),
  sales: z.number(),
  /**
   * sales / attendanceDays. The SRS answers its own open question here: "En
   * promotør med 50 oppmøtedager og 20 salg leverer svakt."
   */
  efficiency: z.number().nullable(),
});
export type PromoterQualityRow = z.infer<typeof promoterQualityRowSchema>;

/**
 * DASH-04 — kanalkvalitet: which channels produce candidates who *stay*.
 *
 * "Robust kandidat" is defined in the SRS's own answered open question: 50
 * sales. So retention here is not a guess — it is that threshold.
 */
export const ROBUST_SALES_THRESHOLD = 50;

export const channelQualityRowSchema = z.object({
  channel: z.string(),
  leads: z.number(),
  hired: z.number(),
  /** Still employed today. */
  retained: z.number(),
  /** Reached the robust threshold. */
  robust: z.number(),
  /** hired / leads, 0-1. */
  hireRate: z.number().nullable(),
  /** robust / hired, 0-1 — the number DASH-04 actually asks for. */
  robustRate: z.number().nullable(),
});
export type ChannelQualityRow = z.infer<typeof channelQualityRowSchema>;

/** DASH-06 — tid fra lead til intervju og fra lead til ansatt, i dager. */
export const timingSchema = z.object({
  leadToInterviewDays: z.number().nullable(),
  leadToHireDays: z.number().nullable(),
});

export const dashboardSchema = z.object({
  funnel: z.array(funnelStepSchema),
  noShowByChannel: z.array(noShowRowSchema),
  noShowByLeader: z.array(noShowRowSchema),
  promoterQuality: z.array(promoterQualityRowSchema),
  channelQuality: z.array(channelQualityRowSchema),
  timing: timingSchema,
  /** What the filter actually matched, so the reader knows the base. */
  basis: z.object({ candidates: z.number(), leads: z.number(), period: z.string() }),
});
export type RecruitmentDashboard = z.infer<typeof dashboardSchema>;
