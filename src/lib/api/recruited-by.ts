import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { API, apiGet, apiPatch } from "./client";
import { useStepUp } from "@/lib/step-up";

/**
 * R4a (client 09.11: «Den som har lagd leadet, får bonusen») — `GET dashboard/rekruttert-av/`.
 * Per person who registered leads, in one month: leads registered, sent to approval,
 * approved and started; «Opptjent bonus» = approved × the admin-set amount (null when the
 * amount is 0, i.e. off). The server scopes it: dashboard.all sees everyone, others only
 * their own row. Nothing here pays anything.
 */
const row = z.object({
  userId: z.string(), name: z.string(),
  leads: z.number(), sent: z.number(), approved: z.number(), started: z.number(),
  bonus: z.number().nullable(),
});
export const recruitedBySchema = z.object({
  month: z.string(),
  amountPerApproved: z.number(),
  rows: z.array(row),
  totals: z.object({ leads: z.number(), sent: z.number(), approved: z.number(), started: z.number(), bonus: z.number().nullable() }),
  scope: z.enum(["all", "own"]),
  canSetAmount: z.boolean(),
  updatedAt: z.string().nullable().optional(),
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

/** Admin only (access.admin, with the 2FA step-up the server asks for). */
export function useSetBonusAmount() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (v: { month: string; amount: number }) =>
      stepUp.run(() => apiPatch(PATH, recruitedBySchema, { amountPerApproved: v.amount }, { month: v.month })),
    onSuccess: (data) => {
      qc.setQueryData(["recruitment", "recruited-by", data.month], data);
      qc.invalidateQueries({ queryKey: ["recruitment", "recruited-by"] });
    },
  });
}
