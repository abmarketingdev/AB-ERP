import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import {
  candidateListSchema,
  candidateSchema,
  stageListSchema,
  type NewCandidate,
} from "@/types/recruitment";

export function useStages() {
  return useQuery({
    queryKey: qk.recruitment.stages(),
    queryFn: () => apiGet(`${API.hr}/recruitment/stages`, stageListSchema),
    staleTime: Infinity, // stage set does not change during a session
  });
}

export function useCandidates() {
  return useQuery({
    queryKey: qk.recruitment.candidates(),
    queryFn: () => apiGet(`${API.hr}/recruitment/candidates`, candidateListSchema),
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: qk.recruitment.candidate(id),
    queryFn: () => apiGet(`${API.hr}/recruitment/candidates/${id}`, candidateSchema),
    enabled: Boolean(id),
  });
}

/** New candidate. The row exists in the list before the network settles. */
export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCandidate) =>
      apiPost(`${API.hr}/recruitment/candidates`, candidateSchema, input),
    onSuccess: (created) => {
      qc.setQueryData(qk.recruitment.candidates(), (old: unknown) =>
        Array.isArray(old) ? [created, ...old] : old,
      );
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
    },
  });
}

/** Advancing a stage appends to history — it never overwrites (FR-R-03). */
/**
 * FR-R-10 — end the process. Access stops now; retention runs on for an agreed
 * period so the reason for the decision can still be shown.
 */
export function useCloseCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      apiPost(`${API.hr}/recruitment/candidates/${vars.id}/close`, candidateSchema, {
        reason: vars.reason,
      }),
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: qk.recruitment.candidate(vars.id) });
      qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** FR-R-10 — carry out the deletion the retention rule promised. */
export function useMinimiseCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) =>
      apiPost(`${API.hr}/recruitment/candidates/${vars.id}/minimise`, candidateSchema, {}),
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: qk.recruitment.candidate(vars.id) });
      qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { candidateId: string; toStageId: string; fields: Record<string, string> }) =>
      apiPost(`${API.hr}/recruitment/candidates/${vars.candidateId}/advance`, candidateSchema, {
        toStageId: vars.toStageId,
        fields: vars.fields,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(qk.recruitment.candidate(updated.id), updated);
      qc.setQueryData(qk.recruitment.candidates(), (old: unknown) =>
        Array.isArray(old)
          ? old.map((c) => ((c as { id: string }).id === updated.id ? updated : c))
          : old,
      );
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}
