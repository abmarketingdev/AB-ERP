import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { API, apiGet, apiPatch, apiPost, apiSend } from "./client";
import { qk } from "./keys";
import {
  approvalFormOptionsSchema, approvalRequestListSchema, approvalRequestSchema, approversSchema, deputySchema,
  type ApprovalSubmit,
} from "@/types/approval";
import { z } from "zod";
import { useStepUp } from "@/lib/step-up";

/**
 * GODK-01 … GODK-05 — recruitment-service `approvals` (`/api/recruitment/approval/`).
 * The server owns the gate: a decision needs `approval.approve` and 2FA proof (IFK-04),
 * and the candidate's status moves only through these endpoints (GODK-03).
 */
const BASE = `${API.recruitment}/approval`;

export const approvalKeys = {
  all: ["approval"] as const,
  queue: (status?: string) => ["approval", "requests", status ?? "all"] as const,
  options: (candidateId?: string, campaignId?: string) => ["approval", "options", candidateId ?? "", campaignId ?? ""] as const,
  deputy: () => ["approval", "deputy"] as const,
  approvers: () => ["approval", "approvers"] as const,
};

function invalidate(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: approvalKeys.all });
  qc.invalidateQueries({ queryKey: ["recruitment"] });
  qc.invalidateQueries({ queryKey: qk.onboarding.all() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
  // «Mine intervjuer» shows the candidate's status (Send til godkjenning → Sendt).
  qc.invalidateQueries({ queryKey: qk.interviews.all() });
}

export function useApprovalQueue(status?: "pending" | "approved" | "rejected" | "returned") {
  return useQuery({
    queryKey: approvalKeys.queue(status),
    queryFn: () => apiGet(`${BASE}/requests/`, approvalRequestListSchema, status ? { status } : undefined),
  });
}

export function useApprovalFormOptions(candidateId?: string, campaignId?: string) {
  return useQuery({
    queryKey: approvalKeys.options(candidateId, campaignId),
    queryFn: () => apiGet(`${BASE}/form-options/`, approvalFormOptionsSchema,
                          { candidateId: candidateId ?? undefined, campaignId: campaignId || undefined }),
  });
}

export function useSubmitApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ApprovalSubmit) => apiPost(`${BASE}/requests/`, approvalRequestSchema, v),
    onSuccess: () => invalidate(qc),
  });
}

export type DecisionKind = "godkjent" | "avvist" | "sendt-tilbake";

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; decision: DecisionKind; comment: string }) =>
      apiPost(`${BASE}/requests/${v.id}/decision/`, approvalRequestSchema, { decision: v.decision, comment: v.comment }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeputy() {
  return useQuery({ queryKey: approvalKeys.deputy(), queryFn: () => apiGet(`${BASE}/deputy/`, deputySchema) });
}

export function useApprovers() {
  return useQuery({ queryKey: approvalKeys.approvers(), queryFn: () => apiGet(`${BASE}/approvers/`, approversSchema) });
}

export function useSetDeputy() {
  const qc = useQueryClient();
  // approval.approve is a step-up key (IFK-04): ask for the code instead of only failing.
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (v: { deputyUserId: string | null; validFrom?: string; validUntil?: string }) =>
      stepUp.run(() => v.deputyUserId
        ? apiPost(`${BASE}/deputy/`, deputySchema, { deputyUserId: v.deputyUserId, validFrom: v.validFrom, validUntil: v.validUntil })
        : apiSend("DELETE", `${BASE}/deputy/`, deputySchema)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.deputy() });
      qc.invalidateQueries({ queryKey: approvalKeys.approvers() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

const settingsSchema = z.object({
  remindAfterDays: z.number(), escalateDaysBeforeStart: z.number(), leaderTaskDueHours: z.number(),
  contractRemindEveryDays: z.number(), contractRemindMax: z.number(), unsignedAlertHour: z.number(),
}).loose();

export function useApprovalSettings() {
  return useQuery({ queryKey: ["approval", "settings"], queryFn: () => apiGet(`${BASE}/settings/`, settingsSchema) });
}
export function useUpdateApprovalSettings() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (v: Partial<z.infer<typeof settingsSchema>>) => stepUp.run(() => apiPatch(`${BASE}/settings/`, settingsSchema, v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval", "settings"] }),
  });
}
