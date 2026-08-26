import { z } from "zod";

export const weekDaySchema = z.object({
  day: z.string(),
  date: z.string(),
  doors: z.number().int().nonnegative(),
  yes: z.number().int().nonnegative(),
  isToday: z.boolean().optional(),
});
export type WeekDay = z.infer<typeof weekDaySchema>;

export const goalCardSchema = z.object({
  label: z.string(),
  target: z.number(),
  current: z.number(),
  unit: z.string(),
  period: z.string(),
  daysRemaining: z.number().int(),
  /** Length of the whole period, so "expected by now" is computed not guessed. */
  daysTotal: z.number().int(),
  /**
   * Protected absence (sick leave, holiday) already inside the period. Expected
   * pace is computed over working days *minus* these, so time off does not
   * quietly become a shortfall. Todoist's vacation mode, applied to a quota.
   */
  absenceDays: z.number().int().nonnegative(),
  absenceNote: z.string().nullable(),
  /**
   * Who set the target. Arbeidsmiljøloven §9-2 expects control measures to be
   * discussed and explained, and goal-commitment needs a rationale — so the
   * screen names the author rather than presenting the number as weather.
   */
  setBy: z.string(),
  /**
   * Advisory only. Every surface derives behind/on-track/ahead from the figures
   * via `goalMath`, so a stale flag here can never contradict what is drawn.
   */
  status: z.enum(["behind", "on-track", "ahead"]),
});
export type GoalCard = z.infer<typeof goalCardSchema>;

export const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** Null when the course is required but undated — rendered "når som helst". */
  deadline: z.string().nullable(),
  /**
   * Progress only. "Overdue" is deliberately NOT a status: it is a property of
   * the deadline, and storing it here erases whether the course was ever
   * started — which is the thing the person needs to know. Derived by
   * `deadlineBucket` instead.
   */
  status: z.enum(["not-started", "in-progress", "completed"]),
  /** FR-P-08 — mandatory courses are the ones that gate campaign access. */
  mandatory: z.boolean(),
  /** Deep link into the learning platform. The ERP surfaces status; it never renders course content. */
  url: z.string(),
  /** Days until the deadline; negative when overdue, null when undated. */
  daysToDeadline: z.number().int().nullable(),
  /** Typical time to complete, so the list can be planned around. */
  minutes: z.number().int().positive(),
  /** Sub-steps where the learning platform exposes them; null when it only reports a status. */
  modules: z.object({ done: z.number().int().nonnegative(), total: z.number().int().positive() }).nullable(),
  completedOn: z.string().nullable(),
});
export type Course = z.infer<typeof courseSchema>;

/**
 * One worked day. FR-P-03 — this is always the signed-in promoter's own row;
 * there is no promoterId in the shape because the endpoint resolves "me".
 */
export const dailyResultSchema = z.object({
  date: z.string(),
  label: z.string(),
  weekday: z.string(),
  doors: z.number().int(),
  yes: z.number().int(),
  yesRate: z.number(),
  /** False when some of the day's sales are still awaiting quality approval. */
  fullyApproved: z.boolean(),
  isToday: z.boolean().optional(),
});
export type DailyResult = z.infer<typeof dailyResultSchema>;

/** FR-P-07 — actual against expected pace across the period. */
export const pacePointSchema = z.object({
  label: z.string(),
  actual: z.number().nullable(),
  expected: z.number(),
});
export type PacePoint = z.infer<typeof pacePointSchema>;

export const dailyResultListSchema = z.array(dailyResultSchema);
export const paceSeriesSchema = z.array(pacePointSchema);

export const newsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  scope: z.string(),
  publishedAt: z.string(),
  read: z.boolean(),
});
export type NewsItem = z.infer<typeof newsItemSchema>;

/** A figure changed after the fact. Rendered inline and persistently — never a toast. */
export const correctionNoticeSchema = z.object({
  id: z.string(),
  at: z.string(),
  summary: z.string(),
  /** Negative when the correction reduced the figure. */
  delta: z.number().optional(),
});
export type CorrectionNotice = z.infer<typeof correctionNoticeSchema>;

export const weekPlanSchema = z.array(weekDaySchema);
export const courseListSchema = z.array(courseSchema);
export const newsListSchema = z.array(newsItemSchema);
export const correctionNoticeListSchema = z.array(correctionNoticeSchema);
