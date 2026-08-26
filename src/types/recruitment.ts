import { z } from "zod";

/**
 * Stages are plain data (clarification 6 — the real stage set is unconfirmed),
 * so the board view can drop in later without touching a component.
 */
export const recruitmentStageSchema = z.object({
  id: z.string(),
  label: z.string(),
  fields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      placeholder: z.string().optional(),
    }),
  ),
  terminal: z.enum(["hired", "withdrawn"]).optional(),
});
export type RecruitmentStage = z.infer<typeof recruitmentStageSchema>;

export const candidateHistoryEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.string(),
  type: z.enum(["created", "stage-change", "note"]),
  stageId: z.string().optional(),
  detail: z.string(),
});
export type CandidateHistoryEntry = z.infer<typeof candidateHistoryEntrySchema>;

export const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  source: z.string(),
  campaign: z.string(),
  appliedDate: z.string(),
  owner: z.string(),
  stageId: z.string(),
  nextActivity: z
    .object({ label: z.string(), date: z.string(), overdue: z.boolean().optional() })
    .optional(),
  /** Append-only. Advancing a stage appends; it never overwrites. */
  history: z.array(candidateHistoryEntrySchema),
  contract: z.enum(["not-sent", "sent", "signed"]),
  /**
   * FR-R-10 — when a candidate ends, access and retention are restricted.
   *
   * Two separate clocks, and conflating them is the usual mistake: **access**
   * stops the moment the process ends, while **retention** runs on for an agreed
   * period because the company may need to show why someone was not hired. The
   * record therefore carries both, plus the basis, because "we keep it for a
   * while" is not an answer anyone can act on or challenge.
   *
   * `minimised` marks the point where contact details have actually been removed
   * rather than merely scheduled for removal — the distinction an audit asks
   * about.
   */
  closure: z
    .object({
      endedAt: z.string(),
      reason: z.string(),
      accessRevokedAt: z.string(),
      retentionUntil: z.string(),
      retentionMonths: z.number().int(),
      basis: z.string(),
      minimised: z.boolean(),
      /** What survives minimisation, stated plainly. */
      retained: z.array(z.string()),
      /** What is removed at minimisation. */
      removed: z.array(z.string()),
    })
    .nullable(),
  onboarding: z.array(z.object({ id: z.string(), task: z.string(), done: z.boolean() })),
});
export type Candidate = z.infer<typeof candidateSchema>;

/** Payload for creating a candidate — the same schema the dialog validates against. */
export const newCandidateSchema = z.object({
  name: z.string().min(2, "Skriv inn fullt navn"),
  phone: z.string().min(6, "Skriv inn et telefonnummer"),
  email: z.string().email("Ugyldig e-postadresse"),
  source: z.string().min(1, "Velg en kilde"),
  campaign: z.string().min(1, "Velg en kampanje"),
});
export type NewCandidate = z.infer<typeof newCandidateSchema>;

/** Payload for advancing a stage. `fields` keys come from the target stage. */
export const advanceStageSchema = z.object({
  candidateId: z.string(),
  toStageId: z.string(),
  fields: z.record(z.string(), z.string()),
});
export type AdvanceStage = z.infer<typeof advanceStageSchema>;

export const candidateListSchema = z.array(candidateSchema);
export const stageListSchema = z.array(recruitmentStageSchema);
