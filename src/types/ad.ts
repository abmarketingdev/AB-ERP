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
 */

export const AD_PLATFORMS = ["Nav", "Indeed", "Finn", "Jobbnorge", "Karrierestart"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

/** ANN-02 — Finn is "Bør", the rest are "Må". Marked so the UI can say so. */
export const PLATFORM_FREE: Record<AdPlatform, boolean> = {
  Nav: true, Indeed: true, Jobbnorge: true, Karrierestart: true, Finn: false,
};

export const adStatusSchema = z.enum(["utkast", "publisert", "avpublisert"]);
export type AdStatus = z.infer<typeof adStatusSchema>;

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  utkast: "Utkast",
  publisert: "Publisert",
  avpublisert: "Avpublisert",
};

export const publicationSchema = z.object({
  platform: z.enum(AD_PLATFORMS),
  /** The id the platform gave us back. Null until the publish call succeeds. */
  externalId: z.string().nullable(),
  /** ANN-04 — one tracking link per channel, so applicants carry their source. */
  trackingUrl: z.string(),
  publishedAt: z.string().nullable(),
  unpublishedAt: z.string().nullable(),
  /** ANN-06 — counted per platform, not per ad. */
  applicants: z.number(),
});
export type Publication = z.infer<typeof publicationSchema>;

export const adSchema = z.object({
  id: z.string(),
  title: z.string(),
  jobType: z.string(),
  location: z.string(),
  campaign: z.string(),
  body: z.string(),
  status: adStatusSchema,
  /** ANN-05 — søknadsfrist; the ad unpublishes itself when it passes. */
  deadline: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  publications: z.array(publicationSchema),
});
export type Ad = z.infer<typeof adSchema>;

export const adListSchema = z.array(adSchema);

/** ANN-03 — maler per stillingstype og sted. */
export const adTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  jobType: z.string(),
  location: z.string(),
  title: z.string(),
  body: z.string(),
});
export type AdTemplate = z.infer<typeof adTemplateSchema>;
export const adTemplateListSchema = z.array(adTemplateSchema);

export const newAdSchema = z.object({
  title: z.string().min(4, "Skriv en tittel"),
  jobType: z.string().min(1, "Velg stillingstype"),
  location: z.string().min(1, "Velg sted"),
  campaign: z.string().min(1, "Velg kampanje"),
  body: z.string().min(20, "Annonseteksten er for kort"),
  deadline: z.string().optional(),
  platforms: z.array(z.enum(AD_PLATFORMS)).min(1, "Velg minst én plattform"),
});
export type NewAd = z.infer<typeof newAdSchema>;

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
