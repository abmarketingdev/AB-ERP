import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { leadListSchema, leadMetaSchema, leadSchema, type Lead } from "@/types/lead";

const countsSchema = z.object({
  total: z.number(),
  byStatus: z.record(z.string(), z.number()),
  byChannel: z.record(z.string(), z.number()),
  duplicates: z.number(),
});

export type LeadQuery = {
  channel?: string;
  status?: string;
  promoter?: string;
  assignedTo?: string;
  from?: string;
  to?: string;
  q?: string;
  duplicates?: boolean;
  page?: number;
};

function toParams(f: LeadQuery): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (f.channel) out.channel = f.channel;
  if (f.status) out.status = f.status;
  if (f.promoter) out.promoter = f.promoter;
  if (f.assignedTo) out.assignedTo = f.assignedTo;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.q) out.q = f.q;
  if (f.duplicates) out.duplicates = "1";
  if (f.page && f.page > 1) out.page = f.page;
  return out;
}

export function useLeads(filter: LeadQuery) {
  const params = toParams(filter);
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  return useQuery({
    queryKey: qk.leads.list(params),
    // Trailing slash on the list: the service mounts the app at /leads/.
    queryFn: () => apiGet(`${API.recruitment}/leads/${qs ? `?${qs}` : ""}`, leadListSchema),
    /*
     * Keeps the previous page on screen while the next one loads, so paging
     * through the inbox does not flash an empty table. The design system calls
     * for a skeleton on first load only.
     */
    placeholderData: (prev) => prev,
  });
}

export function useLeadCounts() {
  return useQuery({
    queryKey: qk.leads.counts(),
    queryFn: () => apiGet(`${API.recruitment}/leads/counts`, countsSchema),
  });
}

/** LEAD-08/09 — channels, campaigns, recruiters and promoters for filters and pickers. */
export function useLeadMeta() {
  return useQuery({
    queryKey: [...qk.leads.all(), "meta"] as const,
    queryFn: () => apiGet(`${API.recruitment}/leads/meta`, leadMetaSchema),
    staleTime: 5 * 60_000,
  });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: qk.leads.lead(id ?? ""),
    queryFn: () => apiGet(`${API.recruitment}/leads/${id}`, leadSchema),
    enabled: Boolean(id),
  });
}

/** Everything a lead mutation can move: the inbox, and the candidate list it feeds. */
function invalidateAfterLeadWrite(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.leads.all() });
  qc.invalidateQueries({ queryKey: qk.recruitment.candidates() });
  qc.invalidateQueries({ queryKey: qk.quality.audit() });
}

export function useSendLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; assignTo?: string }) =>
      apiPost(`${API.recruitment}/leads/send`, z.object({ sent: z.number(), skipped: z.number() }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; assignTo: string }) =>
      apiPost(`${API.recruitment}/leads/assign`, z.object({ assigned: z.number(), skipped: z.number().default(0) }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useMergeLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { keepId: string; mergeIds: string[] }) =>
      apiPost(`${API.recruitment}/leads/merge`, z.object({ kept: z.string(), merged: z.number() }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useDiscardLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; reason?: string }) =>
      apiPost(`${API.recruitment}/leads/discard`, z.object({ discarded: z.number(), skipped: z.number().default(0) }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

/**
 * LEAD-05 — the stand form. The promotor is taken from the token on the server; the
 * client never says who registered the lead. `clientId` makes a retry from the offline
 * queue land once (the server answers 200 with the same lead).
 */
export function useCreateStandLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown> & { clientId: string }) =>
      apiPost(`${API.recruitment}/leads/stand`, leadSchema, input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

/** The stand form's campaigns (a promotor holds stand.write, not leads.read). */
export function useStandMeta() {
  return useQuery({
    queryKey: [...qk.leads.all(), "stand-meta"] as const,
    queryFn: () => apiGet(`${API.recruitment}/leads/stand/meta`,
                          z.object({ campaigns: z.array(z.object({ id: z.string(), name: z.string() })) })),
    staleTime: 10 * 60_000,
  });
}

/** LEAD-07 — undo a merge (admin only; the server answers 403 otherwise). */
export function useUnmergeLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string }) =>
      apiPost(`${API.recruitment}/leads/${input.id}/unmerge`, z.object({ restored: z.number() }), {}),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

/** LEAD-07 — «ikke duplikat»: the mark disappears for both leads. */
export function useDismissDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; otherId: string }) =>
      apiPost(`${API.recruitment}/leads/${input.id}/not-duplicate`, z.object({ dismissed: z.number() }),
              { otherId: input.otherId }),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export type { Lead };
