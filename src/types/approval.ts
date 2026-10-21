import { z } from "zod";

/**
 * GODK-01 … GODK-05 — what a leader sends to Ole, and what Ole decides.
 *
 * The mock used to carry the GODK-01 data as one free-text line in the candidate's
 * history. That could not be handed to HR (ONB-01) or validated, and e-post and kontrakt
 * were never collected at all — so the nine fields are typed here and checked by the
 * server (recruitment-service `approvals`).
 */

export const POSITION_LEVEL_LABEL: Record<string, string> = {
  junior: "Junior",
  senior: "Senior",
  teamleader: "Teamleder",
  sales_manager: "Salgsleder",
  teamleder_trainee: "Teamleder trainee",
};

export const CONTRACT_KIND_LABEL: Record<string, string> = {
  ansettelse: "Ansettelseskontrakt",
  prosjekt: "Prosjektavtale",
  bil: "Bilavtale",
  utstyr: "Utstyrsavtale",
};

/** ISO weekday 1–7, so the value means the same thing in HR and in A5's schedule. */
export const WEEKDAY_LABEL: Record<number, string> = {
  1: "Man", 2: "Tir", 3: "Ons", 4: "Tor", 5: "Fre", 6: "Lør", 7: "Søn",
};

export const approvalSubmitSchema = z.object({
  candidateId: z.string(),
  email: z.string().email("Ugyldig e-post"),
  contractKinds: z.array(z.string()).min(1, "Velg kontrakt").refine((k) => k.includes("ansettelse"), {
    message: "Ansettelseskontrakt må være med",
  }),
  startDate: z.string().min(1, "Velg oppstartsdato"),
  teamId: z.string().min(1, "Velg team"),
  campaignId: z.string().min(1, "Velg prosjekt"),
  positionLevel: z.string().min(1, "Velg junior eller senior"),
  workDays: z.array(z.number().int().min(1).max(7)).min(1, "Velg hvilke dager personen skal jobbe"),
  // An empty field must say what is missing, not that 0 is out of range.
  positionPercentage: z.preprocess((v) => (v === "" || v == null ? undefined : v),
    z.coerce.number({ message: "Skriv inn stillingsprosent" }).min(1, "Stillingsprosent må være mellom 1 og 100")
      .max(100, "Stillingsprosent må være mellom 1 og 100")),
  /** An explicit choice: a missing answer is not «nei». */
  isStudent: z.boolean({ message: "Velg om personen er student" }),
  note: z.string().max(2000).optional(),
});
export type ApprovalSubmit = z.infer<typeof approvalSubmitSchema>;

const named = z.object({ id: z.string(), name: z.string() });

export const approvalRequestSchema = z.object({
  id: z.string(),
  round: z.number(),
  status: z.enum(["pending", "approved", "rejected", "returned", "withdrawn"]),
  candidate: z.object({ id: z.string(), name: z.string(), phone: z.string(), status: z.string() }),
  email: z.string(),
  contractKinds: z.array(z.string()),
  startDate: z.string(),
  team: named,
  campaign: named,
  positionLevel: z.string(),
  workDays: z.array(z.number()),
  positionPercentage: z.coerce.number(),
  isStudent: z.boolean(),
  note: z.string(),
  submittedBy: named,
  submittedAt: z.string(),
  decision: z.object({
    decision: z.enum(["approved", "rejected", "returned"]),
    comment: z.string(),
    decidedBy: z.string(),
    decidedAt: z.string(),
    asDeputy: z.boolean(),
  }).nullable(),
  /** GODK-05 — computed by the server from the configured N/X days. */
  waitingDays: z.number(),
  daysToStart: z.number(),
  overdue: z.boolean(),
  remindersSent: z.number(),
  /** BOOK-08 outcome, read-only for Ole. */
  interview: z.object({
    id: z.string(),
    rating: z.number().nullable(),
    recommend: z.boolean().nullable(),
    assessment: z.string().nullable(),
    leader: z.string().nullable(),
  }).nullable(),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export const approvalRequestListSchema = z.array(approvalRequestSchema);

export const approvalFormOptionsSchema = z.object({
  teams: z.array(named),
  campaigns: z.array(named),
  levels: z.array(z.object({ key: z.string(), label: z.string(), leader: z.boolean(), manualAccount: z.boolean() })),
  contractKinds: z.array(z.object({ key: z.string(), label: z.string() })),
  weekdays: z.array(z.object({ key: z.number(), label: z.string() })),
  prefill: z.object({
    email: z.string().nullable().optional(),
    campaignId: z.string().nullable().optional(),
    interview: z.object({ rating: z.number().nullable(), recommend: z.boolean().nullable() }).optional(),
  }),
});
export type ApprovalFormOptions = z.infer<typeof approvalFormOptionsSchema>;

/** GODK-04 — always a window: a deputy without an end date is a second permanent approver. */
export const deputySchema = z.object({
  id: z.string().nullable().optional(),
  deputy: z.string().nullable(),
  deputyUserId: z.string().nullable().optional(),
  principalUserId: z.string().nullable().optional(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  setAt: z.string().nullable(),
  active: z.boolean().optional(),
});
export type Deputy = z.infer<typeof deputySchema>;

export const approversSchema = z.object({
  approvers: z.array(z.object({ userId: z.string(), name: z.string(), deputyUntil: z.string().nullable() })),
  selectable: z.array(z.object({ userId: z.string(), name: z.string() })),
});
export type Approvers = z.infer<typeof approversSchema>;

/** ONB-04 — a Scrive template slot in HR's register. */
export const templateMappingSchema = z.object({
  id: z.string(),
  kind: z.string(),
  campaignSlug: z.string(),
  level: z.string(),
  templateId: z.string(),
  version: z.number(),
  status: z.enum(["draft", "notified", "acknowledged", "active", "retired"]),
  note: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
  notifiedAt: z.string().nullable(),
  notifiedTo: z.array(z.string()),
  acknowledgedAt: z.string().nullable(),
  acknowledgedByName: z.string(),
  activatedAt: z.string().nullable(),
  retiredAt: z.string().nullable(),
});
export type TemplateMapping = z.infer<typeof templateMappingSchema>;
export const templateMappingListSchema = z.array(templateMappingSchema);
