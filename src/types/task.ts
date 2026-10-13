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
 */

export const taskSourceSchema = z.enum(["system", "egen"]);
export const taskStatusSchema = z.enum(["apen", "fullfort", "forfalt"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  apen: "Åpen",
  fullfort: "Fullført",
  forfalt: "Forfalt",
};

export const leaderTaskSchema = z.object({
  id: z.string(),
  leader: z.string(),
  title: z.string(),
  detail: z.string(),
  source: taskSourceSchema,
  /** What the task is about, so it can link back. */
  relatedCandidateId: z.string().nullable(),
  dueDate: z.string(),
  status: taskStatusSchema,
  /** OPPG-01 — "Hver oppgave har svarfelt, som i Asana". */
  response: z.string().nullable(),
  completedAt: z.string().nullable(),
});
export type LeaderTask = z.infer<typeof leaderTaskSchema>;
export const leaderTaskListSchema = z.array(leaderTaskSchema);

/** OPPG-02 — etterlevelse per leder. */
export const complianceRowSchema = z.object({
  leader: z.string(),
  open: z.number(),
  completed: z.number(),
  overdue: z.number(),
  /** completed / (completed + overdue), 0-1. Null when there is nothing to judge. */
  rate: z.number().nullable(),
});
export type ComplianceRow = z.infer<typeof complianceRowSchema>;
export const complianceListSchema = z.array(complianceRowSchema);

export const completeTaskSchema = z.object({
  id: z.string(),
  response: z.string().min(1, "Skriv et svar før du fullfører"),
});

export const newTaskSchema = z.object({
  title: z.string().min(3, "Skriv en tittel"),
  detail: z.string().optional(),
  dueDate: z.string().min(1, "Velg en frist"),
});
export type NewTask = z.infer<typeof newTaskSchema>;
