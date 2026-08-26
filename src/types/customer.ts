import { z } from "zod";
import { customerFigureSchema } from "./quality";

/**
 * The customer surface. Note the absence of any staff vocabulary (FR-C-10) —
 * this shape must never carry a promoter id, a team name, or an internal status.
 */

export const figureDefinitionSchema = z.object({
  label: z.string(),
  definition: z.string(),
  source: z.string(),
  reportDate: z.string(),
  version: z.string().optional(),
});
export type FigureDefinition = z.infer<typeof figureDefinitionSchema>;

export const seriesPointSchema = z.object({
  label: z.string(),
  value: z.number(),
  /** Plan for the same bucket, where one exists. Rendered muted and dashed. */
  plan: z.number().optional(),
});
export type SeriesPoint = z.infer<typeof seriesPointSchema>;

/** FR-C-04 — the three granularities a contract can report on. */
export const granularitySchema = z.enum(["week", "month", "year"]);
export type Granularity = z.infer<typeof granularitySchema>;

/**
 * FR-C-03/FR-C-04 — the filter the report was computed for.
 *
 * Echoed back rather than assumed, because the endpoint is entitled to narrow
 * it: asking for a weekly view on a monthly contract does not fail, it answers
 * at the granularity the contract covers and says so. A screen that silently
 * kept showing the requested filter over corrected figures would be lying in
 * the most expensive possible place.
 */
export const reportFilterSchema = z.object({
  campaign: z.string(),
  granularity: granularitySchema,
  /** Machine key of the selected bucket, e.g. "2026-08" or "2026-W34". */
  period: z.string(),
  periodLabel: z.string(),
  location: z.string(),
  organisation: z.string(),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

/** The options the *contract* permits, so the portal never offers more. */
export const reportOptionsSchema = z.object({
  campaigns: z.array(z.string()),
  granularities: z.array(granularitySchema),
  periods: z.array(z.object({ value: z.string(), label: z.string() })),
  locations: z.array(z.string()),
  organisations: z.array(z.string()),
});
export type ReportOptions = z.infer<typeof reportOptionsSchema>;

/** One headline figure, already resolved against the agreement. */
export const reportFigureSchema = z.object({
  key: customerFigureSchema,
  label: z.string(),
  /** Preformatted on the server side of the boundary so units never drift. */
  display: z.string().nullable(),
  definition: z.string(),
  source: z.string(),
  version: z.string().optional(),
  /** Set when the figure is in the agreement but not yet reportable (FR-C-11). */
  withheldReason: z.string().nullable(),
});
export type ReportFigure = z.infer<typeof reportFigureSchema>;

/**
 * FR-C-08 — the work behind the numbers, and only when the contract permits it.
 *
 * Counts and averages, never a person. The customer is buying a result, not a
 * window onto named people who never agreed to be watched by them.
 */
export const fieldworkSchema = z.object({
  fundraisers: z.number().int(),
  daysInField: z.number().int(),
  averagePerFundraiser: z.number(),
  conversationsPerDonor: z.number(),
});
export type Fieldwork = z.infer<typeof fieldworkSchema>;

export const campaignReportSchema = z.object({
  campaign: z.string(),
  filter: reportFilterSchema,
  options: reportOptionsSchema,
  /** Set when the request asked for something the contract does not cover. */
  narrowedNotice: z.string().nullable(),
  /** One plain-language sentence, before any number. */
  verdict: z.string(),
  figures: z.array(reportFigureSchema),
  resultVsPlan: z.array(seriesPointSchema),
  accumulated: z.array(seriesPointSchema),
  /** One level finer than the selected granularity. */
  breakdown: z.object({ unit: z.string(), points: z.array(seriesPointSchema) }),
  byLocation: z.array(seriesPointSchema),
  byOrganisation: z.array(seriesPointSchema),
  fieldwork: fieldworkSchema.nullable(),
  correction: z.object({ date: z.string(), note: z.string() }).optional(),
  reportDate: z.string(),
});
export type CampaignReport = z.infer<typeof campaignReportSchema>;
