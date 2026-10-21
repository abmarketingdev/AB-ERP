import { z } from "zod";

/**
 * LEAD-01 — the samleinnboks is a *mellomsteg*, not a second candidate list.
 *
 * A lead is somebody who showed interest. It becomes a candidate only when a
 * recruiter sends it on, and that is a deliberate, recorded act (LEAD-08). The
 * two are separate types for that reason: a lead has no stage, no owner history
 * and no contract — giving it those fields would quietly turn the inbox into
 * the pipeline and remove the step the SRS is built around.
 */

/** LEAD-02/03/04/05/12 — every channel the SRS names. */
export const LEAD_CHANNELS = [
  "Meta",
  "TikTok",
  "Finn",
  "Nav",
  "Indeed",
  "Nettside",
  "Stand",
] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const CHANNEL_KIND: Record<LeadChannel, "betalt" | "organisk" | "stand"> = {
  Meta: "betalt",
  TikTok: "betalt",
  Finn: "betalt",
  Nav: "organisk",
  Indeed: "organisk",
  Nettside: "organisk",
  Stand: "stand",
};

export const leadStatusSchema = z.enum(["ny", "sendt", "duplikat", "forkastet"]);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  ny: "Ny",
  // Short on purpose: it is a table badge. «Sendt videre» = sent on to recruitment (LEAD-08).
  sendt: "Sendt videre",
  duplikat: "Duplikat",
  forkastet: "Forkastet",
};

/**
 * LEAD-10 — consent is stored per lead, and the consent to be used in ad
 * audiences is a *separate* answer from the consent to be contacted.
 *
 * Keeping them apart is the whole point: LEAD-11 exports well-performing people
 * to Meta and TikTok as lookalike seed audiences, and somebody who agreed to be
 * called has not thereby agreed to that.
 */
export const leadConsentSchema = z.object({
  contact: z.boolean(),
  adAudience: z.boolean(),
  at: z.string(),
  /** Plain-language record of what they actually agreed to, for IFK-05. */
  text: z.string(),
});
export type LeadConsent = z.infer<typeof leadConsentSchema>;

export const leadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  /**
   * LEAD-06 — the channel's display name. A string, not the enum above: the server
   * also knows Recman-import, manual entry and job boards beyond the first seven
   * (Jobbnorge, Karrierestart — SRS §7.2 l.706), and an unknown channel must not
   * make the whole inbox fail to parse. `channelKey` is the stable id.
   */
  channel: z.string(),
  channelKey: z.string().optional(),
  campaignId: z.string().nullable().optional(),
  /** Server ids behind the display names, for filters and assignment. */
  promoterId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  mergedIntoId: z.string().nullable().optional(),
  campaign: z.string(),
  receivedAt: z.string(),
  /** LEAD-05 — set automatically when the lead comes from a stand. */
  promoter: z.string().nullable(),
  /** LEAD-09 — which recruiter owns it; null until it is distributed. */
  assignedTo: z.string().nullable(),
  status: leadStatusSchema,
  consent: leadConsentSchema,
  /** Which ad this came from, when the channel is an ad platform (ANN-04). */
  adId: z.string().nullable(),
  note: z.string().nullable(),
  /** Set when the lead was sent on — the id of the candidate it became. */
  candidateId: z.string().nullable(),
  /**
   * LEAD-07 — ids of other leads that match on phone or e-mail.
   *
   * Computed server-side rather than in the table, because the match has to
   * hold across pages: with 10 000 leads (IFK-07) the duplicate is almost never
   * on the screen you are looking at.
   */
  duplicateOf: z.array(z.string()),
});
export type Lead = z.infer<typeof leadSchema>;

export const leadListSchema = z.object({
  rows: z.array(leadSchema),
  /** Total matching the filter, not the page — the inbox counts in its header. */
  total: z.number(),
  /** IFK-07 — what the server actually spent, shown in the footer of the demo. */
  tookMs: z.number(),
});
export type LeadList = z.infer<typeof leadListSchema>;

export const leadFilterSchema = z.object({
  channel: z.string().optional(),
  status: z.string().optional(),
  promoter: z.string().optional(),
  assignedTo: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.number().optional(),
});
export type LeadFilter = z.infer<typeof leadFilterSchema>;

/** LEAD-08 — one or many, the same endpoint. The UI never loops over requests. */
/** `/leads/meta` — filter and picker options, so pages never import mock data. */
const optionSchema = z.object({ id: z.string(), name: z.string() });
export const leadMetaSchema = z.object({
  channels: z.array(z.object({ key: z.string(), name: z.string(), kind: z.string() })),
  campaigns: z.array(optionSchema),
  recruiters: z.array(optionSchema),
  promoters: z.array(optionSchema),
});
export type LeadMeta = z.infer<typeof leadMetaSchema>;

export const sendLeadsSchema = z.object({
  ids: z.array(z.string()).min(1),
  assignTo: z.string().optional(),
});
export type SendLeads = z.infer<typeof sendLeadsSchema>;

/**
 * LEAD-07 — merging keeps one lead and folds the others into it.
 *
 * `keepId` is explicit rather than "the oldest wins", because the recruiter
 * looking at two records can see which one has the better phone number, and a
 * rule cannot.
 */
export const mergeLeadsSchema = z.object({
  keepId: z.string(),
  mergeIds: z.array(z.string()).min(1),
});
export type MergeLeads = z.infer<typeof mergeLeadsSchema>;

export const assignLeadsSchema = z.object({
  ids: z.array(z.string()).min(1),
  assignTo: z.string(),
});

/** LEAD-05 — the mobile stand form. Kept minimal; a stand is not an office. */
export const standLeadSchema = z.object({
  name: z.string().min(2, "Skriv inn navn"),
  phone: z.string().min(6, "Skriv inn telefonnummer"),
  email: z.string().email("Ugyldig e-postadresse").or(z.literal("")),
  campaign: z.string().min(1, "Velg kampanje"),
  consentContact: z.literal(true, { message: "Samtykke er påkrevd" }),
  consentAdAudience: z.boolean(),
  note: z.string().optional(),
});
export type StandLead = z.infer<typeof standLeadSchema>;
