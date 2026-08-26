import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, API } from "./client";
import { qk } from "./keys";
import { kpiListSchema } from "@/types/kpi";
import {
  weekPlanSchema,
  goalCardSchema,
  courseListSchema,
  newsListSchema,
  correctionNoticeListSchema,
  dailyResultListSchema,
  paceSeriesSchema,
  newsItemSchema,
} from "@/types/promoter";

export type KpiGranularity = "day" | "week" | "month";

/** FR-P-04 — day / week / month. The granularity is part of the query key so
 *  each period caches separately and switching back is instant. */
export function usePromoterKpis(granularity: KpiGranularity = "week") {
  return useQuery({
    queryKey: qk.promoter.kpis(granularity),
    queryFn: () =>
      apiGet(`${API.dashboard}/employee/me/stats`, kpiListSchema, { granularity }),
    placeholderData: (prev) => prev,
  });
}

export function useWeekPlan() {
  return useQuery({
    queryKey: qk.promoter.weekPlan(),
    queryFn: () => apiGet(`${API.maps}/promoter/weekplan`, weekPlanSchema),
  });
}

export function usePromoterGoal() {
  return useQuery({
    queryKey: qk.promoter.goal(),
    queryFn: () => apiGet(`${API.dashboard}/promoter/goal`, goalCardSchema),
  });
}

export function usePromoterCourses() {
  return useQuery({
    queryKey: qk.promoter.courses(),
    queryFn: () => apiGet(`${API.learning}/promoter/courses`, courseListSchema),
  });
}

export function usePromoterNews() {
  return useQuery({
    queryKey: qk.promoter.news(),
    queryFn: () => apiGet(`${API.maps}/promoter/news`, newsListSchema),
  });
}

/** Shown inline and persistently wherever a figure was corrected after the fact. */
export function useCorrectionNotices() {
  return useQuery({
    queryKey: qk.quality.notices(),
    queryFn: () => apiGet(`${API.qc}/corrections/notices`, correctionNoticeListSchema),
  });
}

/** FR-P-03 — own results per day. The endpoint resolves "me"; there is no id to pass. */
export function useDailyResults(granularity: KpiGranularity = "week") {
  return useQuery({
    queryKey: ["promoter", "me", "daily", granularity],
    queryFn: () =>
      apiGet(`${API.dashboard}/employee/me/daily`, dailyResultListSchema, { granularity }),
    placeholderData: (prev) => prev,
  });
}

/** FR-P-07 — actual against expected pace over the period. */
export function useGoalPace() {
  return useQuery({
    queryKey: ["promoter", "me", "pace"],
    queryFn: () => apiGet(`${API.dashboard}/promoter/pace`, paceSeriesSchema),
  });
}

/** FR-P-10 — marking an item read. Optimistic: the dot clears on click. */
export function useMarkNewsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost(`${API.maps}/promoter/news/${id}/read`, newsItemSchema),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.promoter.news() });
      const previous = qc.getQueryData(qk.promoter.news());
      qc.setQueryData(qk.promoter.news(), (old: unknown) =>
        Array.isArray(old)
          ? old.map((n) => ((n as { id: string }).id === id ? { ...(n as object), read: true } : n))
          : old,
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.promoter.news(), ctx.previous);
    },
  });
}
