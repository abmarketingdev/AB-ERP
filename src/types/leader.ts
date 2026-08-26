import { z } from "zod";

/**
 * The follow-up row is the most constrained shape in the product — it will be
 * read by an employee representative. Note what it deliberately does NOT carry:
 * no score, no percentage badge, no "risk: high". The explanation is readable
 * text naming the rule and the numbers, and the threshold owner is always visible.
 */
export const followUpRowSchema = z.object({
  id: z.string(),
  personId: z.string(),
  name: z.string(),
  team: z.string(),
  /** Names the rule in plain Norwegian. */
  rule: z.string(),
  /** The actual figures behind the flag: "42 dører/dag mot terskel 60, 5 av siste 10 arbeidsdager" */
  numbers: z.string(),
  threshold: z.string(),
  thresholdOwner: z.string(),
  suggestedAction: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  /** Trend that triggered the flag. Context only — no axes, no interaction. */
  spark: z.array(z.number()).optional(),
  outcome: z
    .object({
      type: z.enum(["accepted", "modified", "rejected"]),
      note: z.string().optional(),
    })
    .optional(),
});
export type FollowUpRow = z.infer<typeof followUpRowSchema>;

export const measureSchema = z.object({
  id: z.string(),
  person: z.string(),
  action: z.string(),
  owner: z.string(),
  deadline: z.string(),
  status: z.enum(["open", "closed"]),
  outcomeNote: z.string().optional(),
});
export type Measure = z.infer<typeof measureSchema>;

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.string(),
  /** Needed for FR-L-02 — results filterable by campaign. */
  campaign: z.string(),
  doors: z.number(),
  yes: z.number(),
  yesRate: z.number(),
  activeDonors: z.number(),
  /** 12-point trend for the row sparkline. Shared scale across rows. */
  spark: z.array(z.number()),
  belowThreshold: z.boolean(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const trendPointSchema = z.object({
  label: z.string(),
  actual: z.number(),
  plan: z.number().optional(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

/** FR-L-01 — deviation load over time, so a leader can see whether it is rising. */
export const deviationPointSchema = z.object({
  label: z.string(),
  value: z.number().int(),
});
export type DeviationPoint = z.infer<typeof deviationPointSchema>;

/**
 * FR-L-14 — every threshold the follow-up engine uses is visible to the leader,
 * together with who owns it. Owning a threshold means owning the consequences of
 * it firing, so the owner is part of the data, never a UI footnote.
 */
export const thresholdSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  owner: z.string(),
  effectiveFrom: z.string(),
});
export type Threshold = z.infer<typeof thresholdSchema>;

/**
 * FR-L-11 / FR-L-12 — the leader sees aggregated course status for the team and
 * who is missing mandatory courses, and can do nothing to it. Course completion
 * is owned by the learning platform; a leader who could edit it could edit away
 * a compliance gap, which is the one thing this record exists to prevent.
 *
 * The payload is person-shaped, and the course-shaped view is derived from it in
 * the UI — one source, two lenses, so the two can never disagree.
 */
export const courseGapSchema = z.object({
  courseId: z.string(),
  title: z.string(),
  status: z.enum(["not-started", "in-progress"]),
  deadline: z.string().nullable(),
  daysToDeadline: z.number().int().nullable(),
});
export type CourseGap = z.infer<typeof courseGapSchema>;

export const teamCourseRowSchema = z.object({
  person: z.string(),
  /** Mandatory courses completed, out of the mandatory courses assigned. */
  completed: z.number().int().nonnegative(),
  mandatory: z.number().int().positive(),
  missing: z.array(courseGapSchema),
});
export type TeamCourseRow = z.infer<typeof teamCourseRowSchema>;

export const teamCourseListSchema = z.array(teamCourseRowSchema);

/**
 * Doc 04, Teamresultater — the three charts and the decision each supports:
 * "Which months missed?", "Are we recoverable?", "Which weeks broke pattern?"
 *
 * Monthly carries plan alongside actual so the first two questions are answered
 * from one series pair; the weekly recruitment series is separate because it is
 * a different cadence and mixing them on one axis would be a lie about time.
 */
export const teamHistorySchema = z.object({
  months: z.array(z.object({ label: z.string(), actual: z.number(), plan: z.number() })),
  /** Running totals of the same months, for the "will we recover" read. */
  accumulated: z.array(z.object({ label: z.string(), actual: z.number(), plan: z.number() })),
  recruitedPerWeek: z.array(z.object({ label: z.string(), value: z.number() })),
});
export type TeamHistory = z.infer<typeof teamHistorySchema>;

/**
 * Doc 04, person detail — pace against the person's OWN baseline.
 *
 * The band is the point. The follow-up engine flags deviation from a personal
 * baseline, not from a team average, so a chart without the band invites the
 * exact misreading the engine was built to avoid: a promoter who has always
 * done 45 doors a day looks like a problem next to one who has always done 85.
 */
export const personDaySchema = z.object({
  label: z.string(),
  doors: z.number().int(),
  yes: z.number().int(),
  /** [low, high] of this person's normal range, from their own history. */
  band: z.tuple([z.number(), z.number()]),
  belowThreshold: z.boolean(),
});
export type PersonDay = z.infer<typeof personDaySchema>;

export const personDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.string(),
  teamId: z.string(),
  campaign: z.string(),
  baseline: z.number(),
  /** The org-wide threshold this person is measured against (FR-L-14). */
  threshold: z.number(),
  thresholdOwner: z.string(),
  doorsPerDay: z.number(),
  yesRate: z.number(),
  donors: z.number().int(),
  target: z.number().int(),
  daysBelowThreshold: z.number().int(),
  daysBelowBaseline: z.number().int(),
  series: z.array(personDaySchema),
  /** Composition of the period's yes by campaign — the StackedBar case. */
  mix: z.array(z.object({ label: z.string(), segments: z.array(z.object({ key: z.string(), value: z.number() })) })),
});
export type PersonDetail = z.infer<typeof personDetailSchema>;

/**
 * FR-L-13 — the limits a leader may move a goal within.
 *
 * The band is measured from `baseline`, the target agreed at the start of the
 * period — **not** from the current target. Measuring from the current value
 * would let a leader ratchet the same 15 % over and over until the limit means
 * nothing, which is the usual way a control like this fails in practice.
 *
 * `owner` and `rationale` are part of the data for the same reason they are on
 * `thresholdSchema` (FR-L-14): a limit whose owner is not named cannot be
 * appealed, and one whose reason is not stated reads as an arbitrary ceiling.
 */
export const goalLimitSchema = z.object({
  /** Maximum move from baseline, in either direction, as a percentage. */
  maxChangePct: z.number(),
  /** Hard floor and ceiling per person, whatever the percentage allows. */
  minTarget: z.number().int(),
  maxTarget: z.number().int(),
  owner: z.string(),
  effectiveFrom: z.string(),
  rationale: z.string(),
});
export type GoalLimit = z.infer<typeof goalLimitSchema>;

export const personGoalSchema = z.object({
  id: z.string(),
  person: z.string(),
  campaign: z.string(),
  /** Which team the person belongs to — the unit scope is enforced on. */
  teamId: z.string(),
  target: z.number().int(),
  /** The figure the limit is measured from. Set at period start; never moved by an edit. */
  baseline: z.number().int(),
  current: z.number().int(),
  daysRemaining: z.number().int(),
  daysTotal: z.number().int(),
  absenceDays: z.number().int(),
  /** Provenance of the last change — mirrors what the promoter is shown on their own Mål. */
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  reason: z.string().nullable(),
});
export type PersonGoal = z.infer<typeof personGoalSchema>;

/**
 * FR-L-13 one level up: the sales chief distributes an org target across teams,
 * exactly as a team lead distributes a team target across people. Same shape,
 * same limit mechanism, same mandatory reason — so the rule is learned once.
 */
export const teamGoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  lead: z.string(),
  headcount: z.number().int(),
  target: z.number().int(),
  baseline: z.number().int(),
  current: z.number().int(),
  /** What the team lead has actually handed out to people, so a chief sees the shortfall. */
  allocated: z.number().int(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  reason: z.string().nullable(),
});
export type TeamGoal = z.infer<typeof teamGoalSchema>;

export const orgGoalPlanSchema = z.object({
  period: z.string(),
  unit: z.string(),
  orgTarget: z.number().int(),
  orgTargetSetBy: z.string(),
  daysRemaining: z.number().int(),
  daysTotal: z.number().int(),
  limit: goalLimitSchema,
  teams: z.array(teamGoalSchema),
});
export type OrgGoalPlan = z.infer<typeof orgGoalPlanSchema>;

/** FR-L-01 across teams — one row per team for the sales chief's comparison. */
export const teamRollupSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  lead: z.string(),
  headcount: z.number().int(),
  doorsPerDay: z.number(),
  doorsTotal: z.number(),
  yesRate: z.number(),
  donors: z.number(),
  target: z.number(),
  expected: z.number(),
  approvedShare: z.number(),
  recruited: z.number(),
  belowThreshold: z.number().int(),
  coursesMissing: z.number().int(),
  followUps: z.number().int(),
  spark: z.array(z.number()),
});
export type TeamRollupRow = z.infer<typeof teamRollupSchema>;
export const teamRollupListSchema = z.array(teamRollupSchema);

export const goalPlanSchema = z.object({
  period: z.string(),
  unit: z.string(),
  /** Owned one level up: a team lead distributes this figure, a sales chief sets it. */
  teamTarget: z.number().int(),
  teamTargetSetBy: z.string(),
  /** Period length lives on the plan; absence stays per person. */
  daysRemaining: z.number().int(),
  daysTotal: z.number().int(),
  limit: goalLimitSchema,
  people: z.array(personGoalSchema),
});
export type GoalPlan = z.infer<typeof goalPlanSchema>;
export const thresholdListSchema = z.array(thresholdSchema);
export const deviationSeriesSchema = z.array(deviationPointSchema);
export const followUpListSchema = z.array(followUpRowSchema);
export const measureListSchema = z.array(measureSchema);
export const teamMemberListSchema = z.array(teamMemberSchema);
export const trendSeriesSchema = z.array(trendPointSchema);
