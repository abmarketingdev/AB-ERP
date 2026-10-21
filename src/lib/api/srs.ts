import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { adListSchema, adSchema, adTemplateListSchema } from "@/types/ad";
import { interviewListSchema, interviewSchema, slotListSchema, publicInterviewSchema } from "@/types/interview";
import { newHireListSchema, newHireSchema, employeeListSchema, employeeSchema } from "@/types/onboarding";
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

// BEM / OPPG / DASH hooks live in staffing.ts, tasks.ts and recruitment-dashboard.ts (A5).
