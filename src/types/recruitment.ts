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
  /**
   * KAND-02 — the server's own locks, so the board refuses the same drops the API
   * would. `manualTargets`: where a recruiter may drag from this stage. `requires`:
   * the form a drop onto this stage opens instead (booking → A3, approval → A4).
   * `locked`: only Ole's approval flow reaches it (GODK-03).
   */
  manualTargets: z.array(z.string()).optional(),
  requires: z.string().nullable().optional(),
  locked: z.boolean().optional(),
});
export type RecruitmentStage = z.infer<typeof recruitmentStageSchema>;

export const candidateHistoryEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.string(),
  /** `event`: a log row that is not a move (rebooked, channel corrected); `assignment`: owner changed. */
  type: z.enum(["created", "stage-change", "note", "event", "assignment"]),
  stageId: z.string().optional(),
  detail: z.string(),
});
export type CandidateHistoryEntry = z.infer<typeof candidateHistoryEntrySchema>;


/** KAND-06 — vedlegg på kandidaten. */
export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["cv", "soknad", "attest", "bilde", "annet"]),
  sizeKb: z.number(),
  uploadedAt: z.string(),
  uploadedBy: z.string(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/**
 * KAND-06 / KAND-09 — notater, og private notater.
 *
 * One type, one flag, rather than two parallel lists: a private note is an
 * ordinary note with an audience. Keeping them in separate arrays would mean
 * every screen that renders notes has to remember to render the other kind too,
 * and the one that forgets is the one that leaks.
 *
 * `visibleTo` holds **permission keys**, not user ids. The SRS says "kun
 * synlige for utvalgte brukere (f.eks. HR og ledelse)" — that is a role
 * question, and pinning it to named people means every new HR hire needs the
 * old notes re-shared.
 */
export const candidateNoteSchema = z.object({
  id: z.string(),
  at: z.string(),
  author: z.string(),
  body: z.string(),
  /** Empty = visible to anyone who can see the candidate. */
  visibleTo: z.array(z.string()),
  /** KAND-09 / §8.1 l.737 — named people who may also read it (master 21.10). */
  visibleToUsers: z.array(z.string()).optional(),
  authorId: z.string().optional(),
  private: z.boolean().optional(),
});
export type CandidateNote = z.infer<typeof candidateNoteSchema>;

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
  /** KAND-06 — free notes, and KAND-09's private ones, in one list. */
  notes: z.array(candidateNoteSchema),
  /** KAND-06 — vedlegg. */
  attachments: z.array(attachmentSchema),
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
  /** KAND-01 — «Interesse for senere» and friends: tags, never a column. */
  tags: z.array(z.string()).optional(),
  followUpOn: z.string().nullable().optional(),
  channelKey: z.string().optional(),
  /** «Rekrutterer» = owner; «Rekruttert av» = the promotor who brought them in (master Q4). */
  recruiterId: z.string().nullable().optional(),
  recruitedBy: z.string().nullable().optional(),
  recruitedById: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  importedFrom: z.string().nullable().optional(),
  /** When the candidate entered its current status (the board's «dager i steget»). */
  stageSince: z.string().optional(),
  age: z.number().nullable().optional(),
  region: z.string().optional(),
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

/** KAND-07 reasons and KAND-01 tags — codes from the server, labels for people. */
export const candidateReasonsSchema = z.object({
  rejection: z.array(z.object({ code: z.string(), label: z.string() })),
  withdraw: z.array(z.object({ code: z.string(), label: z.string() })),
  tags: z.array(z.object({ slug: z.string(), label: z.string() })),
});
export type CandidateReasons = z.infer<typeof candidateReasonsSchema>;

/** A refused move (409): what to say, and which form to open instead. */
export const moveRefusalSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  requires: z.string().nullable().optional(),
});
export type MoveRefusal = z.infer<typeof moveRefusalSchema>;

/** KAND-06 / KAND-09 — add a note, optionally restricted to an audience. */
export const newNoteSchema = z.object({
  body: z.string().min(2, "Skriv et notat"),
  visibleTo: z.array(z.string()),
});
export type NewNote = z.infer<typeof newNoteSchema>;
