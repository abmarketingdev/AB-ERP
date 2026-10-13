import { z } from "zod";

/**
 * BEM-01 … BEM-07 — vaktplan, oppmøte og bemanningsprognose.
 *
 * Two distinct things share this file because the SRS keeps conflating them and
 * the distinction is the whole point of BEM-03: what somebody is *planned* for
 * is not what they *delivered*. The colour codes in BEM-01 encode exactly that
 * — blue is a plan, green and red are outcomes.
 */

export const dayKindSchema = z.enum(["arbeid", "ferie", "syk", "fri"]);
export type DayKind = z.infer<typeof dayKindSchema>;

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  arbeid: "Arbeidsdag",
  ferie: "Ferie",
  syk: "Sykedag",
  fri: "Fri",
};

export const attendanceSchema = z.enum(["planlagt", "mott", "ikke-mott"]);
export type Attendance = z.infer<typeof attendanceSchema>;

/** BEM-01 — blå planlagt, grønn møtt, rød ikke møtt. */
export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  planlagt: "Planlagt",
  mott: "Møtt",
  "ikke-mott": "Ikke møtt",
};

export const shiftSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeName: z.string(),
  team: z.string(),
  /** YYYY-MM-DD */
  date: z.string(),
  kind: dayKindSchema,
  attendance: attendanceSchema.nullable(),
  /** BEM-02 — follow-up recorded against the absence, from the calendar. */
  followUp: z.object({ at: z.string(), by: z.string(), note: z.string() }).nullable(),
  /** Set while a swap is proposed, so the cell can show it (BEM-06). */
  swapPending: z.boolean(),
});
export type Shift = z.infer<typeof shiftSchema>;
export const shiftListSchema = z.array(shiftSchema);

/**
 * BEM-07 — a swap is a request, not an action. It only takes effect once the
 * leader approves, which is why the two shift ids live on the request rather
 * than the shifts simply being rewritten optimistically.
 */
export const swapStatusSchema = z.enum(["venter", "godkjent", "avvist"]);
export const swapRequestSchema = z.object({
  id: z.string(),
  fromEmployee: z.string(),
  toEmployee: z.string(),
  fromShiftId: z.string(),
  toShiftId: z.string(),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string(),
  status: swapStatusSchema,
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedBy: z.string().nullable(),
});
export type SwapRequest = z.infer<typeof swapRequestSchema>;
export const swapRequestListSchema = z.array(swapRequestSchema);

/**
 * BEM-03 / BEM-04 — reelt behov for dagsverk, regnet fra historisk oppmøte og
 * "uavhengig av tilgjengeligheten de ansatte selv oppgir".
 *
 * That clause is the requirement. The forecast therefore carries both numbers
 * and the ratio between them, because a leader who sees only the forecast
 * cannot tell whether it is low because people are unavailable or because
 * people do not turn up — and those call for different responses.
 */
export const forecastSchema = z.object({
  team: z.string(),
  /** What people said they could work. */
  plannedDays: z.number(),
  /** What history says will actually be worked. */
  expectedDays: z.number(),
  /** expected / planned, 0-1. The "show rate" this is built on. */
  showRate: z.number(),
  /** How many days of history this is based on. Below a floor, say so. */
  basisDays: z.number(),
  reliable: z.boolean(),
});
export type Forecast = z.infer<typeof forecastSchema>;
export const forecastListSchema = z.array(forecastSchema);

export const requestSwapSchema = z.object({
  fromShiftId: z.string().min(1),
  toShiftId: z.string().min(1),
  reason: z.string().min(3, "Skriv en kort begrunnelse"),
});
