import { z } from "zod";

/**
 * BEM-01 … BEM-07 — vaktplan, oppmøte og bemanningsprognose.
 *
 * Two distinct things share this file because the SRS keeps conflating them and
 * the distinction is the whole point of BEM-03: what somebody is *planned* for is
 * not what they *delivered*. The colour codes in BEM-01 encode exactly that
 * — blue is a plan, green and red are outcomes.
 *
 * Contract: recruitment-service `/api/recruitment/staffing/…` (A5). Attendance is
 * append-only on the server: a correction is a new row with a reason, so a cell
 * carries its history rather than just its current colour.
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

const followUpSchema = z.object({ at: z.string(), by: z.string(), note: z.string() });

/** ONB-03 via A4: «møtt» is refused until the contract is signed. */
export const clearanceSchema = z.object({
  cleared: z.boolean(),
  reasons: z.array(z.object({ code: z.string(), label: z.string() })),
});

export const swapStateSchema = z.enum(["none", "pending", "swapped"]);

/**
 * A colleague's day offered as a swap target carries only the base fields: the
 * server never sends a promoter somebody else's attendance or absence notes.
 */
export const shiftSchema = z.object({
  id: z.string(),
  personRef: z.object({ kind: z.enum(["user", "candidate"]), id: z.string() }),
  employeeId: z.string(),
  employeeName: z.string(),
  teamId: z.string(),
  team: z.string(),
  /** YYYY-MM-DD */
  date: z.string(),
  kind: dayKindSchema,
  /** plan | first_day (A4's first working day) | swap (BEM-06 «vaktbytte» colour). */
  source: z.enum(["plan", "first_day", "swap"]),
  swapPending: z.boolean(),
  swapState: swapStateSchema,
  kindAtPlan: dayKindSchema.optional(),
  declaredAvailable: z.boolean().nullable().optional(),
  attendance: attendanceSchema.nullable().optional(),
  attendanceHistory: z
    .array(z.object({ status: attendanceSchema, at: z.string(), by: z.string(), reason: z.string().nullable(),
      correction: z.boolean() }))
    .optional(),
  /** BEM-02 — follow-ups recorded against the absence, from the calendar. */
  followUps: z.array(followUpSchema).optional(),
  followUp: followUpSchema.nullable().optional(),
  clearance: clearanceSchema.nullable().optional(),
});
export type Shift = z.infer<typeof shiftSchema>;
export const shiftListSchema = z.array(shiftSchema);

/**
 * BEM-07 — a swap is a request, not an action. The colleague accepts first
 * (configurable, on by default), then the leader decides; only the leader's
 * approval changes either day.
 */
export const swapStatusSchema = z.enum([
  "venter_kollega", "venter_leder", "godkjent", "avvist_leder", "avslatt_kollega", "trukket", "utlopt",
]);
export type SwapStatus = z.infer<typeof swapStatusSchema>;
export const SWAP_STATUS_LABEL: Record<SwapStatus, string> = {
  venter_kollega: "Venter på kollega",
  venter_leder: "Venter på leder",
  godkjent: "Godkjent",
  avvist_leder: "Avvist av leder",
  avslatt_kollega: "Avslått av kollega",
  trukket: "Trukket",
  utlopt: "Utløpt",
};
export const swapRequestSchema = z.object({
  id: z.string(),
  fromEmployee: z.string(),
  fromEmployeeId: z.string(),
  toEmployee: z.string(),
  toEmployeeId: z.string(),
  teamId: z.string(),
  fromShiftId: z.string(),
  toShiftId: z.string(),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string(),
  status: swapStatusSchema,
  requestedAt: z.string(),
  counterpartRespondedAt: z.string().nullable(),
  counterpartComment: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decisionComment: z.string().nullable(),
});
export type SwapRequest = z.infer<typeof swapRequestSchema>;
export const swapRequestListSchema = z.array(swapRequestSchema);

/**
 * BEM-03 / BEM-04 — reelt behov for dagsverk, regnet fra historisk oppmøte og
 * "uavhengig av tilgjengeligheten de ansatte selv oppgir".
 *
 * The forecast carries a range and how much history it rests on, because §7.2
 * leaves open how much history is enough: it says so instead of faking precision.
 */
export const forecastSchema = z.object({
  teamId: z.string(),
  team: z.string(),
  /** Working days planned in the forecast window. */
  plannedDays: z.number(),
  /** What history says will actually be worked. */
  expectedDays: z.number(),
  /** 80 % interval. */
  expectedLow: z.number(),
  expectedHigh: z.number(),
  /** expected / planned, 0-1. */
  showRate: z.number(),
  /** Registered days of history the rate rests on. Below a floor, `reliable` is false. */
  basisDays: z.number(),
  reliable: z.boolean(),
  windowWeeks: z.number(),
  neededForTarget: z.number().nullable(),
  /** One sentence, on screen, explaining the model. */
  explanation: z.string(),
  perPerson: z
    .array(z.object({ userId: z.string(), name: z.string(), planned: z.number(), attended: z.number(),
      lost: z.number(), rate: z.number() }))
    .optional(),
});
export type Forecast = z.infer<typeof forecastSchema>;
export const forecastListSchema = z.array(forecastSchema);

/** BEM-05 — who is behind their planned attendance, and the reminder they would get. */
export const behindPlanSchema = z.array(
  z.object({ userId: z.string(), name: z.string(), teamId: z.string(), planned: z.number(), missed: z.number(),
    body: z.string() }),
);
export type BehindPlan = z.infer<typeof behindPlanSchema>;

export const requestSwapSchema = z.object({
  fromShiftId: z.string().min(1),
  toShiftId: z.string().min(1),
  reason: z.string().min(3, "Skriv en kort begrunnelse"),
});
