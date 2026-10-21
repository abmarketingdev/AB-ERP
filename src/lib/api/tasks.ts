import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { complianceListSchema, leaderTaskListSchema, leaderTaskSchema, type ResponseField } from "@/types/task";

/**
 * OPPG-01 … OPPG-03 — recruitment-service `tasks` (A5). A leader always gets
 * their own list: the server ignores `leader_id` unless the caller holds
 * `tasks.compliance`, so the page never says whose list it wants.
 */
const BASE = `${API.recruitment}/tasks`;

export function useTasks(filter: { leaderId?: string; status?: string } = {}) {
  return useQuery({
    queryKey: qk.tasks.list(filter.leaderId ?? filter.status),
    queryFn: () => apiGet(`${BASE}/`, leaderTaskListSchema, { leader_id: filter.leaderId, status: filter.status }),
  });
}

export function useCompliance(filter: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: [...qk.tasks.compliance(), filter],
    queryFn: () => apiGet(`${BASE}/compliance/`, complianceListSchema, filter),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; response: Record<string, unknown> }) =>
      apiPost(`${BASE}/${v.id}/complete/`, leaderTaskSchema, { response: v.response }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks.all() });
      qc.invalidateQueries({ queryKey: qk.schedule.all() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { title: string; detail?: string; dueAt: string; responseSchema?: ResponseField[] }) =>
      apiPost(`${BASE}/`, leaderTaskSchema, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks.all() }),
  });
}
