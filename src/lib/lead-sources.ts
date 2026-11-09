import { z } from "zod";

/**
 * R1 (client 09.11): «Ved registrering av lead skal man kunne velge mellom: standard er
 * Stand; Tiktok, Facebook, Instagram, Linkedin, Nettside linken, Gjennom en venn». The
 * server sends this list (`sources`); this copy is the fallback for an older server and
 * the demo build. Leads that arrive by themselves (ads, the website, job boards) keep the
 * channel their integration gives them.
 */
export const leadSourceSchema = z.object({ key: z.string(), name: z.string() });
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const MANUAL_SOURCES: LeadSource[] = [
  { key: "stand", name: "Stand" },
  { key: "tiktok", name: "TikTok" },
  { key: "facebook", name: "Facebook" },
  { key: "instagram", name: "Instagram" },
  { key: "linkedin", name: "LinkedIn" },
  { key: "nettside", name: "Nettside" },
  { key: "venn", name: "Gjennom en venn" },
];
