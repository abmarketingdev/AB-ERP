import { z } from "zod";
import { dataSourceSchema, periodRefSchema } from "./common";

export const kpiKeySchema = z.enum([
  "doors_knocked",
  "active_donors",
  "yes_rate",
  "recruited_donors",
  "billable",
  "loyalty",
]);
export type KpiKey = z.infer<typeof kpiKeySchema>;

export const kpiDeltaSchema = z.object({
  value: z.number(),
  direction: z.enum(["up", "down", "flat"]),
  /** Named comparison period — a bare "+12 %" is not a delta. */
  comparisonLabel: z.string(),
});
export type KpiDelta = z.infer<typeof kpiDeltaSchema>;

export const kpiValueSchema = z.object({
  key: kpiKeySchema,
  label: z.string(),
  /** Who the figure applies to (FR-P-02). "Kari Nordmann", "Team Vest". */
  subject: z.string(),
  value: z.number(),
  unit: z.enum(["count", "percent", "currency"]),
  period: periodRefSchema,
  /**
   * Only quality-approved records counted. Drives the approved-data label.
   * Do not drop this from fixtures because it is inconvenient — the whole
   * point is that the figure is visibly lower than the raw count.
   */
  approvedOnly: z.boolean(),
  definitionVersion: z.string(),
  computedAt: z.string(),
  source: dataSourceSchema,
  delta: kpiDeltaSchema.optional(),
  /** Optional 7–12 point trend for the tile sparkline. No axes, endpoint emphasised. */
  spark: z.array(z.number()).optional(),
});
export type KpiValue = z.infer<typeof kpiValueSchema>;

export const kpiListSchema = z.array(kpiValueSchema);
