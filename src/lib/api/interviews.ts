import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPatch, apiPost, API } from "./client";
import { qk } from "./keys";
import {
  interviewListSchema, interviewSchema, leaderListSchema, publicInterviewSchema, slotsResponseSchema,
} from "@/types/interview";

/**
 * BOOK-01 … BOOK-09 against recruitment-service (`/api/recruitment/interviews/`).
 * Scoping is the server's: a leader asking for the list gets their own interviews
 * whatever the query says (BOOK-09, IFK-03).
 */

const IV = `${API.recruitment}/interviews`;
const PUBLIC = `${API.recruitment}/public`;

export function useInterviews(filter: { scope?: "mine"; status?: string; candidate?: string } = {}) {
  return useQuery({
    queryKey: qk.interviews.list(filter),
    queryFn: () => apiGet(`${IV}/`, interviewListSchema, filter),
  });
}
export function useLeaders() {
  return useQuery({
    queryKey: qk.interviews.leaders(),
    queryFn: () => apiGet(`${IV}/leaders/`, leaderListSchema),
    staleTime: 5 * 60_000,
  });
}
/** BOOK-01: a week of slots from `from` (YYYY-MM-DD). Refetched while the calendar is stale. */
export function useSlots(leaderId: string, from: string, days = 7) {
  return useQuery({
    queryKey: qk.interviews.slots(leaderId, from),
    queryFn: () => apiGet(`${IV}/slots/`, slotsResponseSchema, { leader: leaderId, from, days }),
    enabled: Boolean(leaderId),
    refetchInterval: (q) => (q.state.data?.stale ? 5000 : false),
  });
}

function invalidateInterviews(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.interviews.all() });
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  qc.invalidateQueries({ queryKey: qk.tasks.all() });
}

export function useBookInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { candidateId: string; leaderId: string; startsAt: string; location: string; reminderEnabled: boolean }) =>
      apiPost(`${IV}/`, interviewSchema, input),
    onSuccess: () => invalidateInterviews(qc),
  });
}
export function useRebookInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; startsAt: string; location?: string }) =>
      apiPost(`${IV}/${v.id}/rebook/`, interviewSchema, { startsAt: v.startsAt, location: v.location }),
    onSuccess: () => invalidateInterviews(qc),
  });
}
export function useCancelInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) => apiPost(`${IV}/${v.id}/cancel/`, interviewSchema, {}),
    onSuccess: () => invalidateInterviews(qc),
  });
}
export function useSetReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; reminderEnabled: boolean }) =>
      apiPatch(`${IV}/${v.id}/`, interviewSchema, { reminderEnabled: v.reminderEnabled }),
    onSuccess: () => invalidateInterviews(qc),
  });
}
export function useInterviewOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; attended: boolean; assessment: string; rating?: number | null; recommend?: boolean | null }) =>
      apiPost(`${IV}/${v.id}/outcome/`, interviewSchema, {
        attended: v.attended, assessment: v.assessment, rating: v.rating ?? null, recommend: v.recommend ?? null,
      }),
    onSuccess: () => invalidateInterviews(qc),
  });
}

// ── public (no session) — the token is the credential ───────────────────────

const publicResultSchema = publicInterviewSchema.extend({ ok: z.boolean() }).loose();

export function usePublicInterview(token: string) {
  return useQuery({
    queryKey: ["public-interview", token],
    queryFn: () => apiGet(`${PUBLIC}/interview/${token}/`, publicInterviewSchema),
    enabled: Boolean(token),
    retry: false,
  });
}
export function useCancelPublicInterview(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { rebookTo?: string }) =>
      apiPost(`${PUBLIC}/interview/${token}/cancel/`, publicResultSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-interview", token] }),
  });
}
