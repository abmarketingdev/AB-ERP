import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, API } from "./client";
import { qk } from "./keys";
import {
  behindPlanSchema,
  forecastListSchema,
  shiftListSchema,
  shiftSchema,
  swapRequestListSchema,
  swapRequestSchema,
  type DayKind,
} from "@/types/schedule";

/**
 * BEM-01 … BEM-07 — recruitment-service `staffing` (A5). Scope is the server's:
 * a leader gets the teams they lead, a promoter their own days. The page never
 * sends a name to filter on. Query parameters are snake_case (the gateway's
 * camelCase translation covers JSON bodies only).
 */
const BASE = `${API.recruitment}/staffing`;

export function useShifts(scope: { from?: string; to?: string; teamId?: string; userId?: string; swapTargets?: boolean; mine?: boolean; swapFrom?: string; enabled?: boolean } = {}) {
  const params = {
    from: scope.from, to: scope.to, team_id: scope.teamId, user_id: scope.userId,
    swap_targets: scope.swapTargets ? 1 : undefined,
    // BEM-07: the day being offered; the server then leaves out colleagues who already work it.
    swap_from: scope.swapFrom,
    // «Min vaktplan»: own days even for someone who also manages teams (else the server
    // returns the whole team and the page would show colleagues' days as one's own).
    mine: scope.mine ? 1 : undefined,
  };
  return useQuery({
    queryKey: qk.schedule.shifts(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]))),
    queryFn: () => apiGet(`${BASE}/days/`, shiftListSchema, params),
    enabled: scope.enabled ?? true,
  });
}

export function useSwapRequests() {
  return useQuery({ queryKey: qk.schedule.swaps(), queryFn: () => apiGet(`${BASE}/swaps/`, swapRequestListSchema) });
}

export function useForecast(filter: { teamId?: string; from?: string; to?: string; target?: number } = {}) {
  return useQuery({
    queryKey: [...qk.schedule.forecast(), filter],
    queryFn: () => apiGet(`${BASE}/forecast/`, forecastListSchema,
      { team_id: filter.teamId, from: filter.from, to: filter.to, target: filter.target }),
  });
}

export function useBehindPlan() {
  return useQuery({ queryKey: ["schedule", "all", "behind-plan"], queryFn: () => apiGet(`${BASE}/behind-plan/`, behindPlanSchema) });
}

function invalidateSchedule(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.schedule.all() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}

/** BEM-01 — register (or correct, with a reason) attendance on a planned day. */
export function useRecordAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: "mott" | "ikke-mott"; reason?: string }) =>
      apiPost(`${BASE}/days/${v.id}/attendance/`, shiftSchema, { status: v.status, reason: v.reason ?? "" }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

/** BEM-02 — follow up an absence from the calendar cell itself. */
export function useFollowUpAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; note: string }) => apiPost(`${BASE}/days/${v.id}/follow-up/`, shiftSchema, { note: v.note }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

/** BEM-06 — a leader changes the kind of a day; a promoter may report sick today or later. */
export function useSetDayKind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; kind: DayKind }) => apiPatch(`${BASE}/days/${v.id}/`, shiftSchema, { kind: v.kind }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

export function useRequestSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fromShiftId: string; toShiftId: string; reason: string }) =>
      apiPost(`${BASE}/swaps/`, swapRequestSchema, v),
    onSuccess: () => invalidateSchedule(qc),
  });
}

/** BEM-07 — the colleague's answer (first step). */
export function useRespondSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; accept: boolean; comment?: string }) =>
      apiPost(`${BASE}/swaps/${v.id}/respond/`, swapRequestSchema, { accept: v.accept, comment: v.comment ?? "" }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

/** BEM-07 — the leader's decision; the only step that changes either day. */
export function useDecideSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; approve: boolean; comment?: string }) =>
      apiPost(`${BASE}/swaps/${v.id}/decide/`, swapRequestSchema, { approve: v.approve, comment: v.comment ?? "" }),
    onSuccess: () => invalidateSchedule(qc),
  });
}

export function useWithdrawSwap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string }) => apiPost(`${BASE}/swaps/${v.id}/withdraw/`, swapRequestSchema),
    onSuccess: () => invalidateSchedule(qc),
  });
}
