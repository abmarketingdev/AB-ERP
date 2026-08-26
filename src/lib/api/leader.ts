import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, apiPatch, API } from "./client";
import { qk } from "./keys";
import { useScope, scopeParam } from "@/lib/scope";
import { kpiListSchema } from "@/types/kpi";
import { goalCardSchema } from "@/types/promoter";
import {
  followUpListSchema,
  followUpRowSchema,
  measureListSchema,
  measureSchema,
  teamMemberListSchema,
  trendSeriesSchema,
  deviationSeriesSchema,
  thresholdListSchema,
  teamCourseListSchema,
  goalPlanSchema,
  personGoalSchema,
  orgGoalPlanSchema,
  teamGoalSchema,
  teamRollupListSchema,
  personDetailSchema,
  teamHistorySchema,
} from "@/types/leader";

/**
 * Scoped queries.
 *
 * The selected teams are part of the query key as well as the request, so
 * switching scope is a cache miss rather than a stale render of the previous
 * team's numbers under the new team's heading — which is the failure mode that
 * matters most on a screen people make personnel decisions from.
 */
function useScoped<T>(key: readonly unknown[], path: string, schema: z.ZodType<T>) {
  const { teamIds } = useScope();
  return useQuery({
    queryKey: [...key, teamIds.join(",")],
    queryFn: () => apiGet(path, schema, { teams: scopeParam(teamIds) }),
  });
}

export function useLeaderKpis() {
  return useScoped(qk.leader.kpis(), `${API.dashboard}/v2/overview`, kpiListSchema);
}

export function useTeamTrend() {
  return useScoped(qk.leader.trend(), `${API.dashboard}/v2/trends`, trendSeriesSchema);
}

export function useTeamMembers() {
  return useScoped(qk.leader.members(), `${API.dashboard}/v2/employees`, teamMemberListSchema);
}

export function useLeaderGoal() {
  return useScoped(qk.leader.goal(), `${API.dashboard}/leader/goal`, goalCardSchema);
}

/** FR-L-01 across teams — one row per team, for the sales chief's comparison. */
export function useTeamRollups() {
  return useScoped(qk.leader.teams(), `${API.dashboard}/leader/teams`, teamRollupListSchema);
}

/** FR-L-13 at the sales chief's level — the org target distributed across teams. */
export function useOrgGoalPlan() {
  return useScoped(qk.leader.orgGoalPlan(), `${API.dashboard}/leader/org-goal-plan`, orgGoalPlanSchema);
}

export function useAdjustTeamGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; target: number; reason: string }) =>
      apiPatch(`${API.dashboard}/leader/team-goals/${vars.id}`, teamGoalSchema, {
        target: vars.target,
        reason: vars.reason,
      }),
    onSettled: () => {
      // A team target moves the team's KPIs, the lead's distribution and the
      // org roll-up all at once. Invalidate the domain, not one key.
      qc.invalidateQueries({ queryKey: ["leader"] });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-L-01 — is follow-up load rising? */
export function useDeviationTrend() {
  return useScoped(["leader", "team", "deviations"], `${API.dashboard}/deviations`, deviationSeriesSchema);
}

/**
 * FR-L-11 / FR-L-12 — aggregated course status for the team, read-only.
 * There is deliberately no mutation hook beside this one.
 */
export function useTeamCourseStatus() {
  return useScoped(qk.leader.courses(), `${API.learning}/team/status`, teamCourseListSchema);
}

/** FR-L-13 — the team's goal distribution and the limits it may move within. */
export function useGoalPlan() {
  return useScoped(qk.leader.goalPlan(), `${API.dashboard}/leader/goal-plan`, goalPlanSchema);
}

/**
 * FR-L-13 — adjust one person's target.
 *
 * Not optimistic, unlike the follow-up queue. There the write removes a row the
 * leader has already decided about, so showing it gone immediately matches
 * intent. Here the write can be *refused* by the limit, and a target that
 * appears to change and then snaps back is worse than one that takes 300 ms.
 */
export function useAdjustGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; target: number; reason: string }) =>
      apiPatch(`${API.dashboard}/leader/goal-plan/${vars.id}`, personGoalSchema, {
        target: vars.target,
        reason: vars.reason,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.leader.goalPlan() });
      // The promoter's own Mål reads the same target — it must not go stale.
      qc.invalidateQueries({ queryKey: qk.promoter.goal() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** Doc 04 — the three Teamresultater series. */
export function useTeamHistory() {
  return useScoped(["leader", "team", "history"], `${API.dashboard}/leader/history`, teamHistorySchema);
}

/** Doc 04 — one person's pace against their own baseline. */
export function usePersonDetail(id: string) {
  return useQuery({
    queryKey: ["leader", "person", id],
    queryFn: () => apiGet(`${API.dashboard}/leader/person/${id}`, personDetailSchema),
    enabled: Boolean(id),
  });
}

/** FR-L-14 — thresholds and their owners, visible to the leader. */
export function useThresholds() {
  return useQuery({
    queryKey: ["leader", "all", "thresholds"],
    queryFn: () => apiGet(`${API.dashboard}/analytics/thresholds/effective`, thresholdListSchema),
    staleTime: Infinity,
  });
}

export function useFollowUps() {
  return useScoped(qk.leader.followUps(), `${API.hr}/followups`, followUpListSchema);
}

export function useMeasures() {
  return useQuery({
    queryKey: qk.leader.measures(),
    queryFn: () => apiGet(`${API.hr}/measures`, measureListSchema),
  });
}

/**
 * Acting on a follow-up. Optimistic: the row leaves the queue in the same frame
 * as the click, and is put back if the write fails.
 */
export function useFollowUpAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; type: "accepted" | "modified" | "rejected"; note?: string }) =>
      apiPost(`${API.hr}/followups/${vars.id}/action`, followUpRowSchema, {
        type: vars.type,
        note: vars.note,
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.leader.followUps() });
      const previous = qc.getQueryData(qk.leader.followUps());
      qc.setQueryData(qk.leader.followUps(), (old: unknown) =>
        Array.isArray(old) ? old.filter((r) => (r as { id: string }).id !== vars.id) : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(qk.leader.followUps(), context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.leader.followUps() });
      qc.invalidateQueries({ queryKey: qk.leader.measures() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export function useCloseMeasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; outcomeNote: string }) =>
      apiPatch(`${API.hr}/measures/${vars.id}/close`, measureSchema, {
        outcomeNote: vars.outcomeNote,
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.leader.measures() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export const followUpActionSchema = z.object({
  type: z.enum(["accepted", "modified", "rejected"]),
  note: z.string().optional(),
});
