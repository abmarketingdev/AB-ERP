"use client";

import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { GoalJourney } from "@/components/patterns/goal-journey";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { usePromoterGoal, useGoalPace } from "@/lib/api/promoter";
import { useSession } from "@/lib/permissions";

/**
 * FR-P-07 — own goal, period, current value and expected progression.
 *
 * One chart only: actual against expected pace. Actual is solid and stops at
 * today; expected is the muted dashed reference running the full period. That
 * pairing is used identically on every screen in the product, so a reader never
 * has to re-learn which line is which.
 */
export default function PromoterMal() {
  const now = new Date();
  const who = useSession()?.name ?? "Deg";
  const goal = usePromoterGoal();
  const pace = useGoalPace();

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Mål"
        description="Ditt mål for perioden"
        period={goal.data?.period}
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      <QueryBoundary query={goal} skeleton={<Skeleton className="h-40 rounded-xl" />}>
        {(g) => <GoalJourney goal={g} subject={who} />}
      </QueryBoundary>

      <QueryBoundary
        query={pace}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        isEmpty={(d) => d.length < 3}
        emptyTitle="For få dager til å vise en kurve"
        emptyDescription="Kurven vises når perioden har minst tre registrerte dager."
      >
        {(points) => (
          <ChartFrame
            question="Ligger jeg foran eller bak forventet takt?"
            period={goal.data?.period ?? "Perioden"}
            source="Dashboard.xlsx"
            lastUpdated={now}
            state="ready"
          >
            <TrendLineChart
              // actual is null for days not yet reached — the line ends rather
              // than diving to zero, which would read as a collapse.
              data={points.map((p) => ({
                label: p.label,
                value: p.actual ?? Number.NaN,
                secondaryValue: p.expected,
              }))}
              secondarySeriesLabel="Forventet takt"
            />
          </ChartFrame>
        )}
      </QueryBoundary>

    </div>
  );
}
