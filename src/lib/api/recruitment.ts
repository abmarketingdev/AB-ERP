import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import {
  candidateListSchema,
  candidateReasonsSchema,
  candidateSchema,
  stageListSchema,
  type NewCandidate,
} from "@/types/recruitment";

export function useStages() {
  return useQuery({
    queryKey: qk.recruitment.stages(),
    queryFn: () => apiGet(`${API.recruitment}/candidates/stages`, stageListSchema),
    staleTime: Infinity, // stage set does not change during a session
  });
}

export function useCandidates() {
  return useQuery({
    queryKey: qk.recruitment.candidates(),
    queryFn: () => apiGet(`${API.recruitment}/candidates/`, candidateListSchema),
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: qk.recruitment.candidate(id),
    queryFn: () => apiGet(`${API.recruitment}/candidates/${id}`, candidateSchema),
    enabled: Boolean(id),
  });
}

/** New candidate. The row exists in the list before the network settles. */
export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCandidate) =>
      apiPost(`${API.recruitment}/candidates/`, candidateSchema, input),
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

/**
 * KAND-02 — move a candidate. A refusal comes back as ApiError 409 with
 * `{message, code, requires}` (parse with `moveRefusalSchema`): the board shows the
 * message and, when `requires` is set, opens that form instead of snapping back silently.
 * `reasonCode` is a code from `useCandidateReasons()` (KAND-07), never free text.
 */
export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      candidateId: string;
      toStageId: string;
      fields: Record<string, string>;
      reasonCode?: string;
      sendRejection?: boolean;
    }) =>
      apiPost(`${API.recruitment}/candidates/${vars.candidateId}/advance`, candidateSchema, {
        toStageId: vars.toStageId,
        fields: vars.fields,
        reasonCode: vars.reasonCode,
        sendRejection: vars.sendRejection,
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

/**
 * GODK-02 — the approval decision.
 *
 * Deliberately one mutation with a `decision` rather than approve() and
 * reject(): they are the same transition with a different outcome, and the
 * comment is required on a rejection by the screen, not by two code paths that
 * can drift.
 */
export function useCandidateDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; decision: "godkjent" | "avvist"; comment: string }) =>
      apiPost(`${API.hr}/recruitment/candidates/${vars.id}/decision`, candidateSchema, {
        decision: vars.decision,
        comment: vars.comment,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(qk.recruitment.candidate(updated.id), updated);
      qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
      qc.invalidateQueries({ queryKey: qk.quality.audit() });
    },
  });
}

/** KAND-07 reasons (codes + labels) and KAND-01 tags, from the server. */
export function useCandidateReasons() {
  return useQuery({
    queryKey: [...qk.recruitment.stages(), "reasons"] as const,
    queryFn: () => apiGet(`${API.recruitment}/candidates/reasons`, candidateReasonsSchema),
    staleTime: Infinity,
  });
}

const previewSchema = z.object({ channel: z.string().nullable(), subject: z.string(), body: z.string() });

/** KAND-07 — exactly the message an automatic rejection would send, before sending it. */
export function useRejectionPreview(id: string, reason: string | null) {
  return useQuery({
    queryKey: [...qk.recruitment.candidate(id), "rejection-preview", reason] as const,
    queryFn: () => apiGet(`${API.recruitment}/candidates/${id}/rejection-preview?reason=${encodeURIComponent(reason ?? "")}`,
                          previewSchema),
    enabled: Boolean(id && reason),
  });
}

function writeCandidate(qc: ReturnType<typeof useQueryClient>, updated: { id: string }) {
  qc.setQueryData(qk.recruitment.candidate(updated.id), updated);
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}

/** KAND-01 — add/remove tags, e.g. «Interesse for senere» with a follow-up date. */
export function useSetCandidateTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; add?: string[]; remove?: string[]; followUpOn?: string | null }) =>
      apiPost(`${API.recruitment}/candidates/${vars.id}/tags`, candidateSchema,
              { add: vars.add ?? [], remove: vars.remove ?? [], followUpOn: vars.followUpOn }),
    onSuccess: (updated) => writeCandidate(qc, updated),
  });
}

/** LEAD-09 — hand the candidate to a colleague. */
export function useAssignCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; assignTo: string }) =>
      apiPost(`${API.recruitment}/candidates/${vars.id}/assign`, candidateSchema, { assignTo: vars.assignTo }),
    onSuccess: (updated) => writeCandidate(qc, updated),
  });
}

/** KAND-09 — people a private note can be shared with (users who can read candidates). */
export function useNoteAudience(enabled: boolean) {
  return useQuery({
    queryKey: [...qk.recruitment.stages(), "note-audience"] as const,
    queryFn: () => apiGet(`${API.recruitment}/candidates/note-audience`,
                          z.array(z.object({ id: z.string(), name: z.string() }))),
    enabled,
    staleTime: 5 * 60_000,
  });
}
