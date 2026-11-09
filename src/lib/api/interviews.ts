import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPatch, apiPost, API } from "./client";
import { qk } from "./keys";
import {
  calendarStatusSchema, calendarWeekSchema, interviewListSchema, interviewSchema, leaderListSchema,
  publicInterviewSchema, slotsResponseSchema,
} from "@/types/interview";

/**
 * BOOK-01 … BOOK-09 against recruitment-service (`/api/recruitment/interviews/`).
 * Scoping is the server's: a leader asking for the list gets their own interviews
 * whatever the query says (BOOK-09, IFK-03).
 */

const IV = `${API.recruitment}/interviews`;
const PUBLIC = `${API.recruitment}/public`;

export function useInterviews(filter: { scope?: "mine"; status?: string; candidate?: string } = {}, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.interviews.list(filter),
    queryFn: () => apiGet(`${IV}/`, interviewListSchema, filter),
    enabled: opts.enabled ?? true,
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

/** A person's calendar week. `leaderId` empty = my own. Polls while the sync is stale. */
export function useCalendarWeek(leaderId: string, from: string, days = 7, enabled = true) {
  return useQuery({
    queryKey: qk.interviews.calendar(leaderId || "me", from, days),
    queryFn: () => apiGet(`${IV}/calendar/`, calendarWeekSchema, { ...(leaderId ? { leader: leaderId } : {}), from, days }),
    enabled,
    refetchInterval: (q) => (q.state.data?.stale ? 5000 : 5 * 60_000),
  });
}
/** «Synk nå»: asks the calendar worker for a fresh read; the week refetches while stale. */
export function useSyncCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { leaderId?: string }) =>
      apiPost(`${IV}/calendar/sync/`, calendarStatusSchema, v.leaderId ? { leader: v.leaderId } : {}),
    onSuccess: () => {
      // give the worker a moment, then pull the week and the slots again
      setTimeout(() => qc.invalidateQueries({ queryKey: qk.interviews.all() }), 4000);
    },
  });
}

function invalidateInterviews(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.interviews.all() });
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  // The candidate page (status, «Sendt til kandidaten») follows every booking change.
  qc.invalidateQueries({ queryKey: ["recruitment", "mine", "candidate"] });
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
    mutationFn: (v: { id: string; startsAt: string; location?: string; leaderId?: string }) =>
      apiPost(`${IV}/${v.id}/rebook/`, interviewSchema, { startsAt: v.startsAt, location: v.location, leaderId: v.leaderId }),
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
/** R6 «Kommer ikke»: the candidate said they will not come — the interview is cancelled as by
 *  the candidate and the candidate leaves the pipeline (status «Kommer ikke»). */
export function useKommerIkke() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) => apiPost(`${IV}/${v.id}/kommer-ikke/`, interviewSchema, {}),
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
