import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { API, apiGet } from "./client";

/**
 * R4a (client 09.11: the lead's creator gets the credit) — `GET dashboard/rekruttert-av/`.
 * Per person who registered leads, in one month: leads registered, sent to approval,
 * approved and started. The server scopes it: dashboard.all sees everyone, others only
 * their own row. No bonus amount (Hassan 09.11: bonus is out for now).
 */
const row = z.object({
  userId: z.string(), name: z.string(),
  leads: z.number(), sent: z.number(), approved: z.number(), started: z.number(),
});
export const recruitedBySchema = z.object({
  month: z.string(),
  rows: z.array(row),
  totals: z.object({ leads: z.number(), sent: z.number(), approved: z.number(), started: z.number() }),
  scope: z.enum(["all", "own"]),
});
export type RecruitedBy = z.infer<typeof recruitedBySchema>;
export type RecruitedByRow = z.infer<typeof row>;

const PATH = `${API.recruitment}/dashboard/rekruttert-av/`;

export function useRecruitedBy(month: string) {
  return useQuery({
    queryKey: ["recruitment", "recruited-by", month] as const,
    queryFn: () => apiGet(PATH, recruitedBySchema, { month }),
  });
}
