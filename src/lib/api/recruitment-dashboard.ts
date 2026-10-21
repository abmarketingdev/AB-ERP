import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDownload, apiGet, apiPut, API } from "./client";
import { qk } from "./keys";
import { IS_MOCK } from "@/lib/data-source";
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
    include_imported: f.includeImported ? 1 : undefined, include_simulated: f.includeSimulated ? 1 : undefined,
    group_by: f.groupBy,
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
      apiPut(`${BASE}/subscription/`, reportSubscriptionSchema, { filters: {}, ...v }),
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
  const { blob, filename } = await apiDownload(`${BASE}/export.${format}`, dashboardParams(filter));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename ?? `rekruttering.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}
