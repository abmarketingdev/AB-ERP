import { z } from "zod";

/**
 * OPPG-01 … OPPG-03 — den obligatoriske oppgavelisten for ledere.
 *
 * The SRS is unusually blunt about why this exists: "En obligatorisk
 * oppgaveliste sørger for at lederne faktisk bruker systemet." So the two
 * things that matter are that the system generates tasks itself, and that
 * somebody can see who is not doing them (OPPG-02). `source` separates the two
 * kinds, because a leader's own note being counted against their compliance
 * would make the measure useless.
 *
 * Contract: recruitment-service `/api/recruitment/tasks/…` (A5). «Forfalt» is
 * not a stored status — the server derives `overdue` from the deadline on read.
 */

export const taskSourceSchema = z.enum(["system", "egen"]);
export const taskStatusSchema = z.enum(["apen", "fullfort", "kansellert"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_STATUS_LABEL: Record<TaskStatus | "forfalt", string> = {
  apen: "Åpen",
  fullfort: "Fullført",
  kansellert: "Kansellert",
  forfalt: "Forfalt",
};

/** OPPG-01 — «Hver oppgave har svarfelt, som i Asana»: text, number, choice, date, yes/no. */
export const responseFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "number", "choice", "date", "bool"]),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  integer: z.boolean().optional(),
  minLength: z.number().optional(),
});
export type ResponseField = z.infer<typeof responseFieldSchema>;

export const leaderTaskSchema = z.object({
  id: z.string(),
  leaderId: z.string(),
  leaderName: z.string(),
  kind: z.string(),
  kindLabel: z.string(),
  source: taskSourceSchema,
  title: z.string(),
  detail: z.string(),
  /** What the task is about, so it can link back. */
  relatedCandidateId: z.string().nullable(),
  dueAt: z.string(),
  status: taskStatusSchema,
  overdue: z.boolean(),
  /** False for tasks only the underlying action can close (GODK-01 data to Ole). */
  answerable: z.boolean(),
  responseSchema: z.array(responseFieldSchema),
  response: z.record(z.unknown()).nullable(),
  completedAt: z.string().nullable(),
  closedReason: z.string().nullable(),
  payload: z.record(z.unknown()).optional(),
});
export type LeaderTask = z.infer<typeof leaderTaskSchema>;
export const leaderTaskListSchema = z.array(leaderTaskSchema);

/** OPPG-02 — etterlevelse per leder. */
export const complianceRowSchema = z.object({
  leaderId: z.string(),
  leader: z.string(),
  open: z.number(),
  onTime: z.number(),
  late: z.number(),
  completed: z.number(),
  overdue: z.number(),
  cancelled: z.number(),
  /** (onTime + late) / (onTime + late + overdue), 0-1. Null when there is nothing to judge. */
  rate: z.number().nullable(),
});
export type ComplianceRow = z.infer<typeof complianceRowSchema>;
export const complianceListSchema = z.array(complianceRowSchema);

export const newTaskSchema = z.object({
  title: z.string().min(3, "Skriv en tittel"),
  detail: z.string().optional(),
  dueAt: z.string().min(1, "Velg en frist"),
});
export type NewTask = z.infer<typeof newTaskSchema>;
