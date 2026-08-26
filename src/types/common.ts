import { z } from "zod";

/**
 * Shared response vocabulary.
 *
 * Three fields appear on nearly every response — `period`, `source`, `computedAt` —
 * because every data screen renders a PageHeader that states them. If a shape you
 * are defining lacks them, check whether the screen needs a header. It almost
 * certainly does.
 */

export const dataSourceSchema = z.enum([
  "maps",
  "hr",
  "qc",
  "learning",
  "analytics",
  "dashboard_xlsx",
]);
export type DataSource = z.infer<typeof dataSourceSchema>;

export const periodRefSchema = z.object({
  granularity: z.enum(["day", "week", "month", "custom"]),
  /** ISO date */
  from: z.string(),
  to: z.string(),
  /** Human label, already localised: "Juni 2026", "Uke 24" */
  label: z.string(),
});
export type PeriodRef = z.infer<typeof periodRefSchema>;

/** Provenance carried by anything a PageHeader describes. */
export const provenanceSchema = z.object({
  period: periodRefSchema,
  source: dataSourceSchema,
  /** ISO timestamp */
  computedAt: z.string(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/**
 * Wraps a payload with its provenance. Using this consistently is what lets
 * every screen show where its numbers came from without bespoke plumbing.
 */
export function envelope<T extends z.ZodTypeAny>(data: T) {
  return provenanceSchema.extend({ data });
}

export type Envelope<T> = Provenance & { data: T };
