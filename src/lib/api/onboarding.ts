import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { API, apiGet, apiPost, apiUpload } from "./client";
import { qk } from "./keys";
import { useStepUp } from "@/lib/step-up";
import { employeeListSchema, newHireListSchema, newHireSchema } from "@/types/onboarding";
import { templateMappingListSchema, templateMappingSchema } from "@/types/approval";

/**
 * ONB-01 … ONB-09 — recruitment-service `onboarding_bridge` (`/api/recruitment/onboarding/`).
 *
 * HR owns the case, the contracts and the account; these endpoints show the
 * candidate's side and ask HR to act. Sending a contract is automatic (ONB-02) and
 * signing happens in Scrive, so there is no «send» or «sign» here — only a reminder.
 * Equipment is handed out in HR's own register (ONB-07) and read back.
 */
const BASE = `${API.recruitment}/onboarding`;

function invalidate(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.onboarding.all() });
  qc.invalidateQueries({ queryKey: ["employees"] });
  qc.invalidateQueries({ queryKey: ["recruitment"] });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}

export function useNewHires() {
  return useQuery({ queryKey: qk.onboarding.list(), queryFn: () => apiGet(`${BASE}/`, newHireListSchema) });
}

export function useNewHire(id: string) {
  return useQuery({
    queryKey: qk.onboarding.hire(id),
    queryFn: () => apiGet(`${BASE}/${id}/`, newHireSchema),
    enabled: Boolean(id),
  });
}

function action<V>(path: (v: V & { id: string }) => string, body: (v: V & { id: string }) => unknown) {
  return function useIt() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (v: V & { id: string }) => apiPost(`${BASE}/${v.id}/${path(v)}`, newHireSchema, body(v)),
      onSuccess: () => invalidate(qc),
    });
  };
}

/** ONB-05 — only «personalia» is confirmed by hand; the server refuses the rest. */
export const useCheckOnboarding = action<{ key: string; done: boolean }>(() => "check/", (v) => ({ key: v.key, done: v.done }));
/** ONB-03 — a real Scrive reminder, through HR. */
export const useRemindContract = action<{ contractId?: string }>(() => "contract/",
  (v) => ({ action: "remind", contractId: v.contractId }));
/** «Opprett brukerkonto» — once every contract is signed. */
export const useProvisionAccount = action<object>(() => "provision/", () => ({}));
/** ONB-09 — finish: HR welcome mail, access template, Tripletex + Slack. */
export const useCompleteOnboarding = action<{ accessTemplate?: string }>(() => "complete/",
  (v) => ({ accessTemplate: v.accessTemplate }));
export const useCancelOnboarding = action<{ reason: string }>(() => "cancel/", (v) => ({ reason: v.reason }));
export const useRetryHandover = action<object>(() => "retry-handover/", () => ({}));

/** ONB-06 — the photo itself (camera on a phone), multipart. */
export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; file: File }) => {
      const form = new FormData();
      form.append("photo", v.file);
      return apiUpload(`${BASE}/${v.id}/photo/`, newHireSchema, form);
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Same-origin path the <img> loads (auth goes with the session cookie-less bearer via a blob). */
export const photoPath = (id: string) => `${BASE}/${id}/photo/`;

export function useEmployees() {
  return useQuery({ queryKey: qk.employees.list(), queryFn: () => apiGet(`${API.recruitment}/employees/`, employeeListSchema) });
}

// ── ONB-04 kontraktmaler ────────────────────────────────────────────────────

export function useTemplateMappings() {
  return useQuery({ queryKey: ["onboarding", "templates"], queryFn: () => apiGet(`${BASE}/templates/`, templateMappingListSchema) });
}
// onboarding.templates is a step-up key (IFK-04): both template actions ask for the code.
export function useProposeTemplate() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (v: { kind: string; campaignSlug: string; level: string; templateId: string; note: string }) =>
      stepUp.run(() => apiPost(`${BASE}/templates/`, templateMappingSchema, v)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", "templates"] }),
  });
}
export function useTemplateAction() {
  const qc = useQueryClient();
  const stepUp = useStepUp();
  return useMutation({
    mutationFn: (v: { id: string; action: "acknowledge" | "activate" }) =>
      stepUp.run(() => apiPost(`${BASE}/templates/${v.id}/${v.action}/`, templateMappingSchema, {})),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding", "templates"] }),
  });
}

const recipientSchema = z.object({ id: z.number(), kind: z.string(), userId: z.string(), name: z.string().optional(), active: z.boolean() });
export function useRecipients() {
  return useQuery({ queryKey: ["onboarding", "recipients"], queryFn: () => apiGet(`${BASE}/recipients/`, z.array(recipientSchema)) });
}
