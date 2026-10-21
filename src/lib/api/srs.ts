import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { newHireListSchema, newHireSchema, employeeListSchema, employeeSchema } from "@/types/onboarding";
import { shiftListSchema, swapRequestListSchema, swapRequestSchema, shiftSchema, forecastListSchema } from "@/types/schedule";
import { leaderTaskListSchema, leaderTaskSchema, complianceListSchema } from "@/types/task";
import { dashboardSchema } from "@/types/recruitment-dashboard";
import { candidateSchema } from "@/types/recruitment";

/**
 * One file for the modules the SRS adds, rather than seven near-identical ones.
 *
 * The house rule is a file per domain, and these are seven domains — but they
 * are also one feature that ships together, every hook is three lines, and
 * splitting them would mean seven files importing the same four helpers. If any
 * of them grows its own logic, it moves out.
 */

const okSchema = z.object({ ok: z.boolean() }).loose();

// ── Annonser (ANN) og Intervju (BOOK) — A3 ─────────────────────────────────
// Moved to their own files (they talk to recruitment-service and have grown
// their own logic); re-exported so existing imports keep working.
export * from "./ads";
export * from "./interviews";

// ── Onboarding (ONB) ────────────────────────────────────────────────────────

export function useNewHires() {
  return useQuery({ queryKey: qk.onboarding.list(), queryFn: () => apiGet(`${API.hr}/onboarding`, newHireListSchema) });
}
export function useNewHire(id: string) {
  return useQuery({
    queryKey: qk.onboarding.hire(id),
    queryFn: () => apiGet(`${API.hr}/onboarding/${id}`, newHireSchema),
    enabled: Boolean(id),
  });
}
function invalidateOnboarding(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.onboarding.all() });
  qc.invalidateQueries({ queryKey: ["employees"] });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}
function onboardingMutation<V>(path: (v: V & { id: string }) => string, body: (v: V & { id: string }) => unknown) {
  return function useIt() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (v: V & { id: string }) => apiPost(`${API.hr}/onboarding/${v.id}${path(v)}`, newHireSchema, body(v)),
      onSuccess: () => invalidateOnboarding(qc),
    });
  };
}
export const useCheckOnboarding = onboardingMutation<{ key: string; done: boolean }>(
  () => "/check", (v) => ({ key: v.key, done: v.done }),
);
export const useContractAction = onboardingMutation<{ action: "send" | "remind" | "sign" }>(
  () => "/contract", (v) => ({ action: v.action }),
);
/* The photo upload takes no payload of its own — the id in the path is all it
   needs — so its variables type is just the empty object the helper adds the
   id to. `Record<string, never>` would make `{ id }` itself unassignable. */
export const useUploadPhoto = onboardingMutation<object>(() => "/photo", () => ({}));
export const useHandOutEquipment = onboardingMutation<{ kind: string; model: string; serial: string }>(
  () => "/equipment", (v) => ({ kind: v.kind, model: v.model, serial: v.serial }),
);
export const useEquipmentContract = onboardingMutation<{ action: "send" | "sign" }>(
  () => "/equipment-contract", (v) => ({ action: v.action }),
);
export const useFirstDayNoShow = onboardingMutation<{ note: string }>(
  () => "/no-show", (v) => ({ note: v.note }),
);

// ── Ansatte ─────────────────────────────────────────────────────────────────

export function useEmployees() {
  return useQuery({ queryKey: qk.employees.list(), queryFn: () => apiGet(`${API.hr}/employees`, employeeListSchema) });
}
export function useEmployee(id: string) {
  return useQuery({
    queryKey: qk.employees.employee(id),
    queryFn: () => apiGet(`${API.hr}/employees/${id}`, employeeSchema),
    enabled: Boolean(id),
  });
}

// ── Vaktplan og oppmøte (BEM) ───────────────────────────────────────────────

export function useShifts(scope: { employee?: string; team?: string } = {}) {
  const params = new URLSearchParams();
  if (scope.employee) params.set("employee", scope.employee);
  if (scope.team) params.set("team", scope.team);
  const qs = params.toString();
  return useQuery({
    queryKey: qk.schedule.shifts(Object.fromEntries(params)),
    queryFn: () => apiGet(`${API.hr}/shifts${qs ? `?${qs}` : ""}`, shiftListSchema),
  });
}
export function useSwapRequests() {
  return useQuery({ queryKey: qk.schedule.swaps(), queryFn: () => apiGet(`${API.hr}/shifts/swaps`, swapRequestListSchema) });
}
export function useForecast() {
  return useQuery({ queryKey: qk.schedule.forecast(), queryFn: () => apiGet(`${API.hr}/shifts/forecast`, forecastListSchema) });
}
function invalidateSchedule(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.schedule.all() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}
export function useRequestSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fromShiftId: string; toShiftId: string; reason: string }) =>
      apiPost(`${API.hr}/shifts/swaps`, swapRequestSchema, v),
    onSuccess: () => invalidateSchedule(qc),
  });
}
export function useDecideSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean; by?: string }) =>
      apiPost(`${API.hr}/shifts/swaps/${v.id}/decide`, swapRequestSchema, { approve: v.approve, by: v.by }),
    onSuccess: () => invalidateSchedule(qc),
  });
}
export function useFollowUpAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; note: string; by?: string }) =>
      apiPost(`${API.hr}/shifts/${v.id}/follow-up`, shiftSchema, { note: v.note, by: v.by }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

// ── Lederoppgaver (OPPG) ────────────────────────────────────────────────────

export function useTasks(leader?: string) {
  return useQuery({
    queryKey: qk.tasks.list(leader),
    queryFn: () => apiGet(`${API.hr}/tasks${leader ? `?leader=${encodeURIComponent(leader)}` : ""}`, leaderTaskListSchema),
  });
}
export function useCompliance() {
  return useQuery({ queryKey: qk.tasks.compliance(), queryFn: () => apiGet(`${API.hr}/tasks/compliance`, complianceListSchema) });
}
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; response: string }) =>
      apiPost(`${API.hr}/tasks/${v.id}/complete`, leaderTaskSchema, { response: v.response }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.tasks.all() }); qc.invalidateQueries({ queryKey: qk.quality.audit() }); },
  });
}
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { title: string; detail?: string; dueDate: string; leader?: string }) =>
      apiPost(`${API.hr}/tasks`, leaderTaskSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks.all() }),
  });
}

// ── Dashboard (DASH) ────────────────────────────────────────────────────────

export function useRecruitmentDashboard(filter: { campaign?: string; team?: string; days?: number } = {}) {
  const params = new URLSearchParams();
  if (filter.campaign) params.set("campaign", filter.campaign);
  if (filter.team) params.set("team", filter.team);
  if (filter.days) params.set("days", String(filter.days));
  const qs = params.toString();
  return useQuery({
    queryKey: qk.recruitmentDashboard(Object.fromEntries(params)),
    queryFn: () => apiGet(`${API.hr}/dashboard/recruitment${qs ? `?${qs}` : ""}`, dashboardSchema),
    placeholderData: (prev) => prev,
  });
}

// ── Notater, vedlegg (KAND-06/09) ───────────────────────────────────────────

function invalidateCandidate(qc: QueryClient, id: string) {
  qc.invalidateQueries({ queryKey: qk.recruitment.candidate(id) });
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: string; visibleTo: string[]; author?: string }) =>
      apiPost(`${API.hr}/recruitment/candidates/${v.id}/notes`, candidateSchema,
              { body: v.body, visibleTo: v.visibleTo, author: v.author }),
    onSuccess: (_d, v) => invalidateCandidate(qc, v.id),
  });
}

export function useAddAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name: string; kind: string }) =>
      apiPost(`${API.hr}/recruitment/candidates/${v.id}/attachments`, candidateSchema,
              { name: v.name, kind: v.kind }),
    onSuccess: (_d, v) => invalidateCandidate(qc, v.id),
  });
}

// ── GODK-04 stedfortreder ───────────────────────────────────────────────────

const deputySchema = z.object({
  deputy: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  setAt: z.string().nullable(),
});

export function useDeputy() {
  return useQuery({ queryKey: ["approval", "deputy"], queryFn: () => apiGet(`${API.hr}/approval/deputy`, deputySchema) });
}
export function useSetDeputy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { deputy: string | null; from?: string; to?: string }) =>
      apiPost(`${API.hr}/approval/deputy`, deputySchema, v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approval", "deputy"] }); qc.invalidateQueries({ queryKey: qk.quality.audit() }); },
  });
}

// ── LEAD-11 målgruppeeksport ────────────────────────────────────────────────

const audienceSchema = z.object({
  platform: z.string(),
  exported: z.number(),
  considered: z.number(),
  excludedNoConsent: z.number(),
  sample: z.array(z.object({ hashedEmail: z.string() })),
});

export function useAudienceExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { platform: "Meta" | "TikTok"; basis: "hired" | "qualified" }) =>
      apiPost(`${API.hr}/leads/audience-export`, audienceSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.quality.audit() }),
  });
}

// ── BEM-05 / OPPG-03 Slack-varsling ─────────────────────────────────────────

const notificationSchema = z.object({
  absence: z.array(z.object({ channel: z.string(), to: z.string(), kind: z.string(), body: z.string() })),
  leaderSummary: z.array(z.object({ channel: z.string(), to: z.string(), kind: z.string(), body: z.string() })),
});

export function useNotificationPreview() {
  return useQuery({
    queryKey: ["notifications", "preview"],
    queryFn: () => apiGet(`${API.hr}/notifications/preview`, notificationSchema),
  });
}

// ── DASH-01 rapport på e-post ───────────────────────────────────────────────

const subscriptionSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["ukentlig", "manedlig"]),
  recipients: z.array(z.string()),
});

export function useReportSubscription() {
  return useQuery({ queryKey: ["dashboard", "subscription"], queryFn: () => apiGet(`${API.hr}/dashboard/subscription`, subscriptionSchema) });
}
export function useSetReportSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { enabled: boolean; frequency: "ukentlig" | "manedlig"; recipients: string[] }) =>
      apiPost(`${API.hr}/dashboard/subscription`, subscriptionSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", "subscription"] }),
  });
}
