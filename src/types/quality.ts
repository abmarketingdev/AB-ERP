import { z } from "zod";

export const kpiDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  rule: z.string(),
  version: z.string(),
  effectiveFrom: z.string(),
  owner: z.string(),
  locked: z.boolean(),
  lockedBy: z.string().optional(),
  lockedAt: z.string().optional(),
  /** Which screens consume this definition (FR-K-04). */
  consumers: z.array(z.string()),
  /**
   * FR-K-03 — version history, newest first. Each entry carries the *rule text*
   * as it stood at that version, which is what makes a diff possible: a version
   * list without the wording is a changelog nobody can check.
   */
  history: z.array(
    z.object({
      version: z.string(),
      at: z.string(),
      by: z.string(),
      note: z.string(),
      rule: z.string(),
    }),
  ),
});
export type KpiDefinition = z.infer<typeof kpiDefinitionSchema>;

/**
 * A pending correction states what it will affect BEFORE it commits (FR-I-06).
 * This shape is the impact preview.
 */
export const pendingCorrectionSchema = z.object({
  id: z.string(),
  description: z.string(),
  requestedBy: z.string(),
  requestedAt: z.string(),
  reason: z.string(),
  affectedPeriods: z.array(z.string()),
  affectedKpis: z.array(z.string()),
  affectedPeople: z.array(z.string()),
  affectedCustomerReports: z.array(z.string()),
  before: z.string(),
  after: z.string(),
});
export type PendingCorrection = z.infer<typeof pendingCorrectionSchema>;

/** A correction that has been decided — FR-I-07 keeps the record, not just the effect. */
export const decidedCorrectionSchema = pendingCorrectionSchema.extend({
  outcome: z.enum(["approved", "rejected"]),
  decidedBy: z.string(),
  decidedAt: z.string(),
  decisionNote: z.string(),
});
export type DecidedCorrection = z.infer<typeof decidedCorrectionSchema>;
export const decidedCorrectionListSchema = z.array(decidedCorrectionSchema);

export const auditEntrySchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  area: z.string(),
  affected: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
  /** Human-readable stamp, formatted nb-NO. What the table shows. */
  at: z.string(),
  /**
   * Sortable ISO timestamp. `at` is formatted for people and cannot be ordered
   * — "15. mar" sorts before "19. aug" only by accident. The log's entire value
   * is being in order, so it carries a machine field as well as a readable one.
   */
  ts: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const importRunSchema = z.object({
  id: z.string(),
  file: z.string(),
  period: z.string(),
  accepted: z.number().int(),
  rejected: z.number().int(),
  runBy: z.string(),
  runAt: z.string(),
  status: z.enum(["success", "partial", "failed"]),
});
export type ImportRun = z.infer<typeof importRunSchema>;

/**
 * FR-I-02 — what an upload would do, before it does it.
 *
 * Produced by a dry run: the file is parsed and validated but nothing is
 * written. Committing is a separate call, so the preview can be abandoned.
 */
export const importPreviewSchema = z.object({
  file: z.string(),
  period: z.string(),
  totalRows: z.number().int(),
  accepted: z.number().int(),
  rejected: z.number().int(),
  /** FR-I-03 — this period has already been imported; committing replaces rather than adds. */
  duplicateOf: z.string().nullable(),
  /** The column map, so a renamed header is visible before it silently drops a field. */
  columns: z.array(
    z.object({
      source: z.string(),
      target: z.string().nullable(),
      required: z.boolean(),
    }),
  ),
  errors: z.array(
    z.object({ row: z.number().int(), ref: z.string(), reason: z.string() }),
  ),
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

/**
 * FR-I-08 — automated ingestion. A file that arrived on its own still has to go
 * through the same review and commit as one somebody uploaded; the *only*
 * difference is who put it in the queue. Building it any other way would create
 * a second, unreviewed path into everyone's figures.
 */
export const inboxFileSchema = z.object({
  id: z.string(),
  file: z.string(),
  period: z.string(),
  arrivedAt: z.string(),
  source: z.string(),
  /** Held until a person reviews it. Nothing auto-commits, by design. */
  status: z.enum(["awaiting-review", "committed", "rejected"]),
});
export type InboxFile = z.infer<typeof inboxFileSchema>;
export const inboxFileListSchema = z.array(inboxFileSchema);

/** A file the demo can offer to "upload". */
export const importCandidateSchema = z.object({
  file: z.string(),
  period: z.string(),
  label: z.string(),
});
export const importCandidateListSchema = z.array(importCandidateSchema);
export type ImportCandidate = z.infer<typeof importCandidateSchema>;

export const rejectedRowSchema = z.object({
  id: z.string(),
  row: z.number().int(),
  reason: z.string(),
  person: z.string(),
});
export type RejectedRow = z.infer<typeof rejectedRowSchema>;

/**
 * FR-S-04 — effective permissions are the role default set, **plus** individually
 * granted items, **minus** individually revoked items.
 *
 * The three lists are kept separate in the payload rather than collapsed into one
 * effective set, because provenance is the whole point of this screen: an
 * administrator needs to see which access came with the job and which somebody
 * granted by hand, and only the second kind is theirs to take away. `effective`
 * is derived, never stored — see `effectivePermissions`.
 */
export const userAccessSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  team: z.string().nullable(),
  active: z.boolean(),
  /** Requires a second factor (FR-S-02, FR-A-09). */
  mfa: z.boolean(),
  lastSeen: z.string().nullable(),
  roleDefaults: z.array(z.string()),
  granted: z.array(z.string()),
  revoked: z.array(z.string()),
  /** Why each individual change was made, keyed by permission. FR-A-02. */
  reasons: z.record(z.string(), z.string()),
});
export type UserAccess = z.infer<typeof userAccessSchema>;

/** Every permission the system knows about, with a readable name. */
export const permissionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  area: z.string(),
  /** Marks access that carries personnel or financial consequence. */
  sensitive: z.boolean(),
});
export type Permission = z.infer<typeof permissionSchema>;
export const permissionListSchema = z.array(permissionSchema);

/**
 * FR-C-07 — which fields a customer may see is *configuration per agreement*,
 * not a hardcoded view.
 *
 * The requirement is easy to satisfy badly: render every figure and hide a few
 * with CSS. That fails the moment somebody opens devtools, and it fails the
 * actual commercial point — two customers on different contracts are entitled
 * to different things, and the difference is negotiated, not designed.
 *
 * So the agreement is the input to the report, on the server side of the mock
 * boundary. A figure that is not in `figures` is never computed and never
 * leaves the endpoint, and the portal renders whatever it is given.
 */
export const CUSTOMER_FIGURES = [
  "donorsAcquired",
  "totalPaid",
  "averageMonthlyGift",
  "retention90",
  "campaignCost",
  "costPerDonor",
] as const;
export const customerFigureSchema = z.enum(CUSTOMER_FIGURES);
export type CustomerFigureKey = z.infer<typeof customerFigureSchema>;

export const customerAgreementSchema = z.object({
  /** The figures this contract includes, in the order they are presented. */
  figures: z.array(customerFigureSchema),
  /**
   * FR-C-08 — how much of the work behind the numbers this contract exposes.
   * "aggregate" is counts and averages only; there is deliberately no "named"
   * option, because FR-C-10 forbids the vocabulary that would carry it.
   */
  fieldworkDetail: z.enum(["none", "aggregate"]),
  /** FR-C-04 — the period granularities this contract reports on. */
  granularities: z.array(z.enum(["week", "month", "year"])),
  /** Sub-organisations the contract is split across. Empty = one organisation. */
  organisations: z.array(z.string()),
  /**
   * FR-C-11 — campaign cost stays behind this until the definition is agreed.
   * Per customer, because the definition is agreed per contract.
   */
  costDefinitionAgreed: z.boolean(),
});
export type CustomerAgreement = z.infer<typeof customerAgreementSchema>;

/**
 * FR-A-03 — a customer account and its portal login.
 *
 * `provisioned` is deliberately separate from `active`: creating the account and
 * giving somebody outside the company a way in are two different decisions, and
 * the second one is the one that needs a deliberate act.
 */
export const customerAccountSchema = z.object({
  id: z.string(),
  organisation: z.string(),
  orgNumber: z.string(),
  contactName: z.string(),
  email: z.string(),
  campaigns: z.array(z.string()),
  provisioned: z.boolean(),
  provisionedAt: z.string().nullable(),
  provisionedBy: z.string().nullable(),
  lastLogin: z.string().nullable(),
  createdAt: z.string(),
  agreement: customerAgreementSchema,
  /** FR-C-12 — credentials are provisioned by hand and sent by email. */
  credentialsSentTo: z.string().nullable(),
  credentialsSentAt: z.string().nullable(),
});
export type CustomerAccount = z.infer<typeof customerAccountSchema>;
export const customerAccountListSchema = z.array(customerAccountSchema);

/**
 * FR-K-06 — what a proposed definition change would do to a period that has
 * already been reported.
 *
 * This is the safety check that makes locking a definition a decision rather
 * than a gamble. A rule change applies retroactively, so the question is never
 * "is the new wording better" — it is "how many people's already-published
 * figures move, and did we send any of them to a customer".
 */
export const definitionImpactSchema = z.object({
  period: z.string(),
  /** The figure as published under the current rule. */
  currentValue: z.number(),
  /** The same figure recomputed under the proposal. */
  proposedValue: z.number(),
  unit: z.string(),
  affectedPeople: z.number().int(),
  affectedCustomerReports: z.array(z.string()),
  /** Named individuals whose figure moves, with the size of the move. */
  examples: z.array(z.object({ name: z.string(), from: z.number(), to: z.number() })),
});
export type DefinitionImpact = z.infer<typeof definitionImpactSchema>;
export const definitionImpactListSchema = z.array(definitionImpactSchema);

/**
 * FR-A-10 — integration health: the last successful run of each import and
 * scheduled job.
 *
 * Doc 04 is specific about the register here: "Status rows, green/amber/red.
 * **Plain language, no Redis terminology.**" An administrator is not on call for
 * a queue; they need to know whether last night's figures arrived, and who to
 * ring if they did not. So every row carries an owner and a consequence
 * sentence, and nothing is named after the technology that implements it.
 */
export const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** What breaks if this stops. The reason the row exists. */
  consequence: z.string(),
  kind: z.enum(["import", "job", "feed"]),
  status: z.enum(["ok", "late", "failed"]),
  /** Human schedule, e.g. "Hver natt 03:00". Never a cron expression. */
  schedule: z.string(),
  lastSuccessAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  /** Minutes since the last success — drives late/failed without a clock in the UI. */
  minutesSinceSuccess: z.number().int().nullable(),
  expectedEveryMinutes: z.number().int(),
  owner: z.string(),
  note: z.string().nullable(),
});
export type Integration = z.infer<typeof integrationSchema>;
export const integrationListSchema = z.array(integrationSchema);

/** FR-A-01 — one row per entity type in the cross-organisation overview. */
export const orgEntitySchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().int(),
  detail: z.string(),
  href: z.string().nullable(),
  items: z.array(z.object({ name: z.string(), meta: z.string() })),
});
export type OrgEntity = z.infer<typeof orgEntitySchema>;
export const orgOverviewSchema = z.array(orgEntitySchema);

export const kpiDefinitionListSchema = z.array(kpiDefinitionSchema);
export const pendingCorrectionListSchema = z.array(pendingCorrectionSchema);
export const auditLogSchema = z.array(auditEntrySchema);
export const importRunListSchema = z.array(importRunSchema);
export const rejectedRowListSchema = z.array(rejectedRowSchema);
export const userAccessListSchema = z.array(userAccessSchema);
