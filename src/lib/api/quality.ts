import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, API } from "./client";
import { qk } from "./keys";
import { IS_MOCK } from "@/lib/data-source";
import { useStepUp } from "@/lib/step-up";
import {
  fetchAuditLog,
  fetchPermissionCatalogue,
  fetchUserAccess,
  patchPermission,
  patchUserActive,
  fetchTemplates,
  patchTemplate,
  patchModule,
} from "./recruitment-admin";
import {
  auditLogSchema,
  importRunListSchema,
  kpiDefinitionListSchema,
  pendingCorrectionListSchema,
  rejectedRowListSchema,
  userAccessListSchema,
  userAccessSchema,
  permissionListSchema,
  orgOverviewSchema,
  customerAccountListSchema,
  customerAccountSchema,
  importCandidateListSchema,
  importPreviewSchema,
  importRunSchema,
  decidedCorrectionListSchema,
  decidedCorrectionSchema,
  integrationListSchema,
  inboxFileListSchema,
  inboxFileSchema,
  definitionImpactListSchema,
} from "@/types/quality";
import type { CustomerAgreement } from "@/types/quality";
import { campaignReportSchema } from "@/types/customer";

export function useKpiDefinitions() {
  return useQuery({
    queryKey: qk.quality.definitions(),
    queryFn: () => apiGet(`${API.qc}/kpi-definitions`, kpiDefinitionListSchema),
  });
}

export function usePendingCorrections() {
  return useQuery({
    queryKey: qk.quality.corrections(),
    queryFn: () => apiGet(`${API.qc}/corrections`, pendingCorrectionListSchema),
  });
}

export function useAuditLog() {
  return useQuery({
    queryKey: qk.quality.audit(),
    // api mode: recruitment-service's audit log (IFK-05); mock: the demo QC log.
    queryFn: () => (IS_MOCK ? apiGet(`${API.qc}/audit`, auditLogSchema) : fetchAuditLog()),
  });
}

export function useImportRuns() {
  return useQuery({
    queryKey: qk.quality.importRuns(),
    queryFn: () => apiGet(`${API.qc}/import/runs`, importRunListSchema),
  });
}

export function useRejectedRows() {
  return useQuery({
    queryKey: qk.quality.rejectedRows(),
    queryFn: () => apiGet(`${API.qc}/import/rejected`, rejectedRowListSchema),
  });
}

export function useUserAccess() {
  return useQuery({
    queryKey: qk.quality.access(),
    queryFn: () => (IS_MOCK ? apiGet(`${API.auth}/access`, userAccessListSchema) : fetchUserAccess()),
  });
}

export function usePermissionCatalogue() {
  return useQuery({
    queryKey: qk.quality.permissions(),
    queryFn: () => (IS_MOCK ? apiGet(`${API.auth}/permissions`, permissionListSchema) : fetchPermissionCatalogue()),
    staleTime: Infinity,
  });
}

/** FR-A-01 — the cross-organisation overview. */
export function useOrgOverview() {
  return useQuery({
    queryKey: qk.quality.orgOverview(),
    queryFn: () => apiGet("/api/admin/overview", orgOverviewSchema),
  });
}

export function useCustomerAccounts() {
  return useQuery({
    queryKey: qk.quality.customers(),
    queryFn: () => apiGet(`${API.auth}/customers`, customerAccountListSchema),
  });
}

/** FR-A-02 / FR-S-04 — grant, revoke or reset one permission, with a reason. */
export function useSetPermission() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      permission: string;
      action: "grant" | "revoke" | "reset";
      reason: string;
    }) =>
      IS_MOCK
        ? apiPatch(`${API.auth}/access/${vars.id}`, userAccessSchema, {
            permission: vars.permission,
            action: vars.action,
            reason: vars.reason,
          })
        : // access.admin is a step-up key (IFK-04): the server may ask for 2FA first.
          stepUp.run(() => patchPermission(vars)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.access() });
      qc.invalidateQueries({ queryKey: qk.quality.orgOverview() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean; reason: string }) =>
      IS_MOCK
        ? apiPatch(`${API.auth}/access/${vars.id}/active`, userAccessSchema, {
            active: vars.active,
            reason: vars.reason,
          })
        : stepUp.run(() => patchUserActive(vars)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.access() });
      qc.invalidateQueries({ queryKey: qk.quality.orgOverview() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-A-03 — create a customer account. */
export function useCreateCustomerAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      organisation: string;
      orgNumber: string;
      contactName: string;
      email: string;
      campaigns: string[];
    }) => apiPost(`${API.auth}/customers`, customerAccountSchema, vars),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.customers() });
      qc.invalidateQueries({ queryKey: qk.quality.orgOverview() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-A-03 — provisioning the portal login is a separate, deliberate act. */
export function useProvisionCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; provisioned: boolean }) =>
      apiPost(`${API.auth}/customers/${vars.id}/provision`, customerAccountSchema, {
        provisioned: vars.provisioned,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.customers() });
      qc.invalidateQueries({ queryKey: qk.quality.orgOverview() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-K-06 — what a proposed rule change would do to periods already reported. */
export function useDefinitionImpact() {
  return useMutation({
    mutationFn: (vars: { id: string; proposal: string }) =>
      apiPost(`${API.qc}/kpi-definitions/${vars.id}/impact`, definitionImpactListSchema, {
        proposal: vars.proposal,
      }),
  });
}

/** FR-A-10 — integration and scheduled-job health. */
export function useIntegrations() {
  return useQuery({
    queryKey: ["quality", "all", "integrations"],
    queryFn: () => apiGet("/api/admin/integrations", integrationListSchema),
  });
}

/** FR-I-08 — files that arrived without anyone uploading them. */
export function useImportInbox() {
  return useQuery({
    queryKey: ["quality", "all", "import-inbox"],
    queryFn: () => apiGet(`${API.qc}/import/inbox`, inboxFileListSchema),
  });
}

export function useClaimInboxFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) =>
      apiPost(`${API.qc}/import/inbox/${vars.id}/claim`, inboxFileSchema, {}),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["quality", "all", "import-inbox"] });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-I-01 — the files this demo can offer to upload. */
export function useImportCandidates() {
  return useQuery({
    queryKey: ["quality", "all", "import-candidates"],
    queryFn: () => apiGet(`${API.qc}/import/candidates`, importCandidateListSchema),
    staleTime: Infinity,
  });
}

/** FR-I-02 — dry run. Nothing is written until commit. */
export function useImportPreview() {
  return useMutation({
    mutationFn: (vars: { file: string }) =>
      apiPost(`${API.qc}/import/preview`, importPreviewSchema, vars),
  });
}

export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: string }) =>
      apiPost(`${API.qc}/import/commit`, importRunSchema, vars),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.importRuns() });
      qc.invalidateQueries({ queryKey: qk.quality.rejectedRows() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-I-05 — resubmit one rejected row. */
export function useResubmitRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) =>
      apiPost(`${API.qc}/import/rejected/${vars.id}/resubmit`, z.object({ ok: z.boolean() }), {}),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.rejectedRows() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export function useDecidedCorrections() {
  return useQuery({
    queryKey: ["quality", "all", "decided-corrections"],
    queryFn: () => apiGet(`${API.qc}/import/decided-corrections`, decidedCorrectionListSchema),
  });
}

/** FR-I-07 — approve or reject, with a mandatory note recorded against both. */
export function useDecideCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; outcome: "approved" | "rejected"; note: string }) =>
      apiPost(`${API.qc}/corrections/${vars.id}/decide`, decidedCorrectionSchema, {
        outcome: vars.outcome,
        note: vars.note,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.corrections() });
      qc.invalidateQueries({ queryKey: ["quality", "all", "decided-corrections"] });
      qc.invalidateQueries({ queryKey: qk.quality.notices() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export interface ReportFilterInput {
  campaign?: string;
  granularity?: string;
  period?: string;
  location?: string;
  organisation?: string;
}

/**
 * FR-C-03/04 — the report for the selected filter.
 *
 * `placeholderData: keepPreviousData` matters more here than anywhere else in
 * the app: a campaign manager changing the month should see the numbers update
 * in place, not watch the whole report disappear into a skeleton and rebuild.
 * The previous answer stays on screen, dimmed, until the new one lands.
 */
export function useCustomerReport(filter: ReportFilterInput = {}) {
  const params = Object.fromEntries(
    Object.entries(filter).filter(([, v]) => v),
  ) as Record<string, string>;
  return useQuery({
    queryKey: qk.customer.report(params),
    queryFn: () => apiGet(`${API.customer}/report`, campaignReportSchema, params),
    placeholderData: keepPreviousData,
  });
}

/** FR-C-07 — change what a customer's agreement lets them see. */
export function useUpdateAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; agreement: Partial<CustomerAgreement> }) =>
      apiPatch(`${API.auth}/customers/${vars.id}/agreement`, customerAccountSchema, vars.agreement),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.customers() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
      // The portal reads the same record, so a change here must reach it.
      qc.invalidateQueries({ queryKey: ["customer"] });
    },
  });
}

/**
 * The showcase mutation. Approving a correction ripples into the promoter's
 * figures, the customer's report and the audit log — so it invalidates broadly
 * rather than surgically. That breadth is the point, not laziness.
 */
export function useApproveCorrection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost(`${API.qc}/corrections/${id}/approve`, z.object({ ok: z.boolean(), id: z.string() })),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.quality.corrections() });
      const previous = qc.getQueryData(qk.quality.corrections());
      qc.setQueryData(qk.quality.corrections(), (old: unknown) =>
        Array.isArray(old) ? old.filter((c) => (c as { id: string }).id !== id) : old,
      );
      return { previous };
    },
    onError: (_e, _id, context) => {
      if (context?.previous) qc.setQueryData(qk.quality.corrections(), context.previous);
    },
    onSettled: () => {
      for (const key of qk.afterCorrection()) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** SRS §2.2 role templates (api mode only — the demo has fixed roles). */
export function useAccessTemplates() {
  return useQuery({
    queryKey: [...qk.quality.access(), "templates"],
    queryFn: fetchTemplates,
    enabled: !IS_MOCK,
    staleTime: 60_000,
  });
}

export function useSetTemplate() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (vars: { id: string; template: string | null; reason: string }) => stepUp.run(() => patchTemplate(vars)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.access() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export function useSetModule() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (vars: { id: string; grant?: string[]; revoke?: string[]; reset?: string[]; reason: string }) =>
      stepUp.run(() => patchModule(vars)),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.quality.access() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}
