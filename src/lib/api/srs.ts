import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { adListSchema, adSchema, adTemplateListSchema } from "@/types/ad";
import { interviewListSchema, interviewSchema, slotListSchema, publicInterviewSchema } from "@/types/interview";
import { newHireListSchema, newHireSchema, employeeListSchema, employeeSchema } from "@/types/onboarding";
import { shiftListSchema, swapRequestListSchema, swapRequestSchema, shiftSchema, forecastListSchema } from "@/types/schedule";
import { leaderTaskListSchema, leaderTaskSchema, complianceListSchema } from "@/types/task";
import { dashboardSchema } from "@/types/recruitment-dashboard";

/**
 * One file for the modules the SRS adds, rather than seven near-identical ones.
 *
 * The house rule is a file per domain, and these are seven domains — but they
 * are also one feature that ships together, every hook is three lines, and
 * splitting them would mean seven files importing the same four helpers. If any
 * of them grows its own logic, it moves out.
 */

const okSchema = z.object({ ok: z.boolean() }).loose();

// ── Annonser (ANN) ──────────────────────────────────────────────────────────

export function useAds() {
  return useQuery({ queryKey: qk.ads.list(), queryFn: () => apiGet(`${API.hr}/ads`, adListSchema) });
}
export function useAd(id: string) {
  return useQuery({
    queryKey: qk.ads.ad(id),
    queryFn: () => apiGet(`${API.hr}/ads/${id}`, adSchema),
    enabled: Boolean(id),
  });
}
export function useAdTemplates() {
  return useQuery({
    queryKey: qk.ads.templates(),
    queryFn: () => apiGet(`${API.hr}/ads/templates`, adTemplateListSchema),
    staleTime: Infinity,
  });
}
export function useAdMeta() {
  return useQuery({
    queryKey: qk.ads.meta(),
    queryFn: () => apiGet(`${API.hr}/ads/meta`, z.object({ jobTypes: z.array(z.string()), locations: z.array(z.string()) })),
    staleTime: Infinity,
  });
}
function invalidateAds(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["ads"] });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}
export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost(`${API.hr}/ads`, adSchema, input),
    onSuccess: () => invalidateAds(qc),
  });
}
export function usePublishAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; platforms: string[] }) =>
      apiPost(`${API.hr}/ads/${v.id}/publish`, adSchema, { platforms: v.platforms }),
    onSuccess: () => invalidateAds(qc),
  });
}
export function useUnpublishAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) => apiPost(`${API.hr}/ads/${v.id}/unpublish`, adSchema, {}),
    onSuccess: () => invalidateAds(qc),
  });
}

// ── Intervju (BOOK) ─────────────────────────────────────────────────────────

export function useInterviews(leader?: string) {
  return useQuery({
    queryKey: qk.interviews.list(leader),
    queryFn: () => apiGet(`${API.hr}/interviews${leader ? `?leader=${encodeURIComponent(leader)}` : ""}`, interviewListSchema),
  });
}
export function useLeaders() {
  return useQuery({
    queryKey: qk.interviews.leaders(),
    queryFn: () => apiGet(`${API.hr}/interviews/leaders`, z.array(z.string())),
    staleTime: Infinity,
  });
}
export function useSlots(leader: string) {
  return useQuery({
    queryKey: qk.interviews.slots(leader),
    queryFn: () => apiGet(`${API.hr}/interviews/slots?leader=${encodeURIComponent(leader)}`, slotListSchema),
    enabled: Boolean(leader),
  });
}
function invalidateInterviews(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.interviews.all() });
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  qc.invalidateQueries({ queryKey: qk.tasks.all() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}
export function useBookInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost(`${API.hr}/interviews`, interviewSchema, input),
    onSuccess: () => invalidateInterviews(qc),
  });
}
export function useInterviewOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; attended: boolean; assessment: string }) =>
      apiPost(`${API.hr}/interviews/${v.id}/outcome`, interviewSchema, { attended: v.attended, assessment: v.assessment }),
    onSuccess: () => invalidateInterviews(qc),
  });
}

/** The public cancel/rebook page. No session — the token is the credential. */
export function usePublicInterview(token: string) {
  return useQuery({
    queryKey: ["public-interview", token],
    queryFn: () => apiGet(`/api/public/interview/${token}`, publicInterviewSchema),
    enabled: Boolean(token),
    retry: false,
  });
}
export function useCancelPublicInterview(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { rebookTo?: string }) =>
      apiPost(`/api/public/interview/${token}/cancel`, okSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-interview", token] }),
  });
}
export function useApply() {
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => apiPost(`/api/public/apply`, okSchema, input),
  });
}

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
