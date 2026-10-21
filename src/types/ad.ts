import { z } from "zod";

/**
 * ANN-01 … ANN-06 — stillingsannonser.
 *
 * The SRS asks for one ad created once and published to several platforms, so
 * the ad and the publication are separate objects. Folding them into one record
 * with a list of platform names would lose the thing ANN-04 and ANN-06 are
 * about: each platform has its own external id, its own tracking link and its
 * own applicant count, and "how many came from Nav" is the question the whole
 * feature exists to answer.
 *
 * The platforms are data from /ads/meta/, not an enum: SRS §7.2 l.706 («hvilke
 * gratis jobbplattformer … Dana undersøker») is still open, and adding a board
 * must not need a frontend release.
 */

export const boardModeSchema = z.enum(["push", "feed", "manual"]);
export type BoardMode = z.infer<typeof boardModeSchema>;

export const boardSchema = z.object({
  key: z.string(),
  name: z.string(),
  /** ANN-01 asks for the free boards; Finn (ANN-02, «Bør») is paid. */
  free: z.boolean(),
  /** push = we call the board's API; feed = the board reads our feed;
   *  manual = posted by hand, the tracking link is pasted into the board. */
  mode: boardModeSchema,
  enabled: z.boolean(),
}).loose();
export type Board = z.infer<typeof boardSchema>;

export const adStatusSchema = z.enum(["utkast", "publisert", "avpublisert"]);
export type AdStatus = z.infer<typeof adStatusSchema>;

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  utkast: "Utkast",
  publisert: "Publisert",
  avpublisert: "Avpublisert",
};

export const publicationStateSchema = z.enum(["venter", "publisert", "feilet", "avpubliserer", "avpublisert"]);
export type PublicationState = z.infer<typeof publicationStateSchema>;

export const PUBLICATION_STATE_LABEL: Record<PublicationState, string> = {
  venter: "Venter",
  publisert: "Publisert",
  feilet: "Feilet",
  avpubliserer: "Avpubliseres",
  avpublisert: "Avpublisert",
};

export const publicationSchema = z.object({
  id: z.string(),
  /** Board key (nav, indeed, finn …). */
  platform: z.string(),
  platformName: z.string(),
  /** The id the platform gave us back. Empty until the board has answered. */
  externalId: z.string(),
  /** ANN-04 — one tracking link per channel, so applicants carry their source. */
  trackingUrl: z.string(),
  state: publicationStateSchema,
  /** Manual board (Finn without a partner agreement): the recruiter pastes the id. */
  manual: z.boolean(),
  publishedAt: z.string().nullable(),
  unpublishedAt: z.string().nullable(),
  /** Why the board refused, when state is «feilet». */
  lastError: z.string(),
  /** ANN-06 — counted per platform, from the inbox, not per ad. */
  applicants: z.number(),
});
export type Publication = z.infer<typeof publicationSchema>;

export const adSchema = z.object({
  id: z.string(),
  /** The short id in /soknad/<publicId>. */
  publicId: z.string(),
  title: z.string(),
  jobType: z.string(),
  location: z.string(),
  campaign: z.string(),
  campaignId: z.string().nullable(),
  body: z.string(),
  status: adStatusSchema,
  /** ANN-05 — søknadsfrist (date); the ad unpublishes itself when that day ends. */
  deadline: z.string().nullable(),
  unpublishedReason: z.enum(["", "manuell", "frist"]),
  createdAt: z.string(),
  createdBy: z.string(),
  publications: z.array(publicationSchema),
  applicantsTotal: z.number(),
  acceptingApplications: z.boolean(),
  /** SRS l.4: words that were allowed but flagged (e.g. «lønn»), per field. */
  wordingWarnings: z.record(z.string(), z.array(z.string())).optional(),
});
export type Ad = z.infer<typeof adSchema>;

export const adListSchema = z.array(adSchema);

export const adMetaSchema = z.object({
  jobTypes: z.array(z.string()),
  locations: z.array(z.string()),
  boards: z.array(boardSchema),
});
export type AdMeta = z.infer<typeof adMetaSchema>;

/** ANN-03 — maler per stillingstype og sted. */
export const adTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  jobType: z.string(),
  location: z.string(),
  title: z.string(),
  body: z.string(),
}).loose();
export type AdTemplate = z.infer<typeof adTemplateSchema>;
export const adTemplateListSchema = z.array(adTemplateSchema);

export const newAdSchema = z.object({
  title: z.string().min(4, "Skriv en tittel"),
  jobType: z.string().min(1, "Velg stillingstype"),
  location: z.string().min(1, "Velg sted"),
  campaign: z.string().min(1, "Velg kampanje"),
  body: z.string().min(20, "Annonseteksten er for kort"),
  deadline: z.string().optional(),
  platforms: z.array(z.string()).min(1, "Velg minst én plattform"),
});
export type NewAd = z.infer<typeof newAdSchema>;

/** SRS l.4 / l.240 — the live check behind the create form. */
export const wordingHitSchema = z.object({ term: z.string(), text: z.string(), start: z.number(), end: z.number() });
export const wordingCheckSchema = z.object({ blocked: z.array(wordingHitSchema), warnings: z.array(wordingHitSchema) });
export type WordingCheck = z.infer<typeof wordingCheckSchema>;

/** What an applicant sees behind a tracking link — nothing internal. */
export const publicAdSchema = z.object({
  id: z.string(),
  title: z.string(),
  jobType: z.string(),
  location: z.string(),
  body: z.string(),
  deadline: z.string().nullable(),
  open: z.boolean(),
});
export type PublicAd = z.infer<typeof publicAdSchema>;

/** The public application form behind a tracking link. */
export const applicationSchema = z.object({
  name: z.string().min(2, "Skriv inn fullt navn"),
  phone: z.string().min(6, "Skriv inn et telefonnummer"),
  email: z.string().email("Ugyldig e-postadresse"),
  message: z.string().optional(),
  consentContact: z.literal(true, { message: "Samtykke er påkrevd for å sende søknaden" }),
  consentAdAudience: z.boolean(),
});
export type Application = z.infer<typeof applicationSchema>;

/**
 * LEAD-10 — the exact consent wording, versioned server-side as
 * ConsentText «soknadsskjema» v1. Change it there (as a new version) first.
 */
export const CONSENT_TEXT = {
  contact: "Jeg samtykker til at AB Marketing lagrer søknaden min og kontakter meg om stillingen.",
  adAudience: "Jeg samtykker til at kontaktinformasjonen min kan brukes i annonsemålgrupper på Meta og TikTok.",
} as const;
