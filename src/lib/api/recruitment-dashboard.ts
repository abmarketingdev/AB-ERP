import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { IS_MOCK } from "@/lib/data-source";
import { authorizedFetch } from "@/lib/auth-tokens";
import {
  dashboardFilterOptionsSchema,
  dashboardSchema,
  kpiDefinitionListSchema,
  reportSubscriptionSchema,
  type DashboardFilter,
  type RecruitmentDashboard,
} from "@/types/recruitment-dashboard";
import { downloadDashboardLocally } from "@/lib/recruitment-dashboard-export";

/**
 * DASH-01 … DASH-08 — recruitment-service `dashboard` (A5). Every figure is the
 * server's; the page renders and filters, it does not compute.
 */
const BASE = `${API.recruitment}/dashboard`;

/** Query parameters are snake_case: the gateway's camelCase translation covers bodies only. */
export function dashboardParams(f: DashboardFilter) {
  return {
    from: f.from, to: f.to, region: f.region, team_id: f.teamId, channel: f.channel,
    include_imported: f.includeImported ? 1 : undefined, group_by: f.groupBy,
  };
}

export function useRecruitmentDashboard(filter: DashboardFilter = {}) {
  const params = dashboardParams(filter);
  return useQuery({
    queryKey: qk.recruitmentDashboard(Object.fromEntries(Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]))),
    queryFn: () => apiGet(`${BASE}/recruitment/`, dashboardSchema, params),
    placeholderData: (prev) => prev,
  });
}

export function useDashboardFilters() {
  return useQuery({ queryKey: ["recruitment-dashboard", "filters"],
    queryFn: () => apiGet(`${BASE}/filters/`, dashboardFilterOptionsSchema), staleTime: 5 * 60_000 });
}

export function useKpiDefinitions() {
  return useQuery({ queryKey: ["recruitment-dashboard", "kpis"],
    queryFn: () => apiGet(`${BASE}/kpi-definitions/`, kpiDefinitionListSchema), staleTime: 60 * 60_000 });
}

export function useReportSubscription() {
  return useQuery({ queryKey: ["recruitment-dashboard", "subscription"],
    queryFn: () => apiGet(`${BASE}/subscription/`, reportSubscriptionSchema) });
}

export function useSetReportSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { enabled: boolean; frequency: "ukentlig" | "manedlig"; filters?: Record<string, unknown> }) =>
      apiPost(`${BASE}/subscription/`, reportSubscriptionSchema, { filters: {}, ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recruitment-dashboard", "subscription"] }),
  });
}

/**
 * DASH-08 — Excel/PDF built server-side from the same figures and scope as the
 * screen, and audited there. In mock mode there is no server, so the file is
 * built in the browser from the object already on screen.
 */
export async function downloadDashboard(format: "xlsx" | "pdf", filter: DashboardFilter, onScreen: RecruitmentDashboard) {
  if (IS_MOCK) return downloadDashboardLocally(format, onScreen);
  const url = new URL(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}${BASE}/export.${format}`, window.location.origin);
  for (const [k, v] of Object.entries(dashboardParams(filter))) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const token = window.localStorage.getItem("ab-erp-token");
  const res = await authorizedFetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let message = res.status === 403 ? "Du har ikke tilgang til eksport." : "Eksporten feilet. Prøv igjen.";
    try { message = ((await res.json()) as { message?: string }).message ?? message; } catch { /* not json */ }
    throw new Error(message);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `rekruttering.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}
