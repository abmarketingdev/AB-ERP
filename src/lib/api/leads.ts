import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { leadListSchema, leadSchema, type Lead } from "@/types/lead";

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
    queryFn: () => apiGet(`${API.hr}/leads${qs ? `?${qs}` : ""}`, leadListSchema),
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
    queryFn: () => apiGet(`${API.hr}/leads/counts`, countsSchema),
  });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: qk.leads.lead(id ?? ""),
    queryFn: () => apiGet(`${API.hr}/leads/${id}`, leadSchema),
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
      apiPost(`${API.hr}/leads/send`, z.object({ sent: z.number(), skipped: z.number() }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useAssignLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; assignTo: string }) =>
      apiPost(`${API.hr}/leads/assign`, z.object({ assigned: z.number() }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useMergeLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { keepId: string; mergeIds: string[] }) =>
      apiPost(`${API.hr}/leads/merge`, z.object({ kept: z.string(), merged: z.number() }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useDiscardLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; reason?: string }) =>
      apiPost(`${API.hr}/leads/discard`, z.object({ discarded: z.number() }), input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export function useCreateStandLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiPost(`${API.hr}/leads/stand`, leadSchema, input),
    onSuccess: () => invalidateAfterLeadWrite(qc),
  });
}

export type { Lead };
