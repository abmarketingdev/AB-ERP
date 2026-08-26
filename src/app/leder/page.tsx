"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { KpiTile } from "@/components/patterns/kpi-tile";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { GoalCard } from "@/components/patterns/goal-card";
import { SparkLine } from "@/components/charts/spark-line";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWeek } from "@/lib/format";
import { useSession } from "@/lib/permissions";
import {
  useLeaderKpis,
  useLeaderGoal,
  useFollowUps,
  useDeviationTrend,
} from "@/lib/api/leader";

/**
 * FR-L-01 — doors, yes, active donors, plan, deviation, quality and trend for
 * the leader's scope.
 *
 * A team lead sees their own team; a sales chief would see every team beneath
 * them. Scope is a parameter, not a separate build — nothing on this screen is
 * hardcoded to one team, so widening it is a query change, not a rewrite.
 *
 * Everything links deeper. No dead ends.
 */
export default function LederForside() {
  const now = new Date();
  const scope = useSession()?.name ? "Team Vest" : "Teamet";
  const kpis = useLeaderKpis();
  const goal = useLeaderGoal();
  const followUps = useFollowUps();
  const deviations = useDeviationTrend();

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Forside"
        description={`Teamstatus for ${scope}`}
        period={formatWeek(now)}
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      {/* ── Tall for scopet (FR-L-01) ──────────────────────────────────────── */}
      <section aria-labelledby="kpi-h">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="kpi-h" className="text-[15px] font-medium text-foreground">
            Teamets tall
          </h2>
          <Link
            href="/leder/teamresultater"
            className="flex items-center gap-1 text-[12px] text-[var(--ab-accent-11)] hover:underline min-h-11 sm:min-h-6"
          >
            Se detaljer <ArrowRight className="size-3" />
          </Link>
        </div>
        <QueryBoundary
          query={kpis}
          skeleton={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[188px] rounded-xl" />
              ))}
            </div>
          }
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen tall for denne perioden"
        >
          {(list) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((k, i) => (
                <motion.div
                  key={k.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.24, ease: [0.2, 0, 0, 1] }}
                >
                  <KpiTile kpi={k} />
                </motion.div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </section>

      {/* ── Plan (FR-L-01 "plan") ──────────────────────────────────────────── */}
      <section aria-labelledby="plan-h">
        <h2 id="plan-h" className="mb-3 text-[15px] font-medium text-foreground">
          Mot plan denne måneden
        </h2>
        <QueryBoundary query={goal} skeleton={<Skeleton className="h-36 rounded-xl" />}>
          {(g) => <GoalCard goal={g} subject={scope} />}
        </QueryBoundary>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ── Høyest prioriterte oppfølginger (FR-L-03) ────────────────────── */}
        <QueryBoundary
          query={followUps}
          skeleton={<Skeleton className="h-56 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen oppfølgingsbehov denne uken"
          emptyDescription="Ingen i teamet ligger under terskel akkurat nå."
        >
          {(rows) => (
            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  Trenger oppfølging
                </span>
                <Link
                  href="/leder/oppfolging"
                  className="flex items-center gap-1 text-[12px] text-[var(--ab-accent-11)] hover:underline min-h-11 sm:min-h-6"
                >
                  Se alle ({rows.length}) <ArrowRight className="size-3" />
                </Link>
              </div>
              <ul className="flex-1 px-5 pb-4">
                {/* The three highest-priority rows. The screen suggests; the leader decides. */}
                {rows.slice(0, 3).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{r.name}</p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{r.rule}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      {r.spark && <SparkLine points={r.spark} width={54} height={20} className="text-muted-foreground" />}
                      <Badge
                        variant={r.priority === "high" ? "destructive" : "outline"}
                        className="shrink-0"
                      >
                        {r.priority === "high" ? "Høy" : r.priority === "medium" ? "Middels" : "Lav"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground">
                {scope} · ingenting skjer automatisk — alle valg gjøres av leder
              </p>
            </div>
          )}
        </QueryBoundary>

        {/* ── Avviksbelastning over tid (FR-L-01 "deviation") ──────────────── */}
        <QueryBoundary
          query={deviations}
          skeleton={<Skeleton className="h-56 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen avvik registrert"
        >
          {(points) => {
            const max = Math.max(...points.map((p) => p.value), 1);
            const total = points.reduce((a, p) => a + p.value, 0);
            return (
              <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                <div className="px-5 pb-1 pt-4">
                  <p className="text-[13px] font-medium text-foreground">Er oppfølgingsmengden økende?</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                    {total} avvik siste 14 dager
                  </p>
                </div>
                <div className="flex flex-1 items-end gap-[3px] px-5 pb-3 pt-4">
                  {points.map((p, i) => (
                    <div key={p.label} className="flex flex-1 flex-col items-center gap-1.5">
                      <motion.div
                        className={`w-full rounded-t-[2px] ${
                          p.value === 0 ? "bg-transparent" : "bg-[var(--ab-accent-9)]/30"
                        }`}
                        style={{ minHeight: p.value ? 3 : 0 }}
                        initial={{ height: 0 }}
                        animate={{ height: `${(p.value / max) * 72}px` }}
                        transition={{ duration: 0.4, delay: i * 0.02, ease: [0.05, 0.7, 0.1, 1] }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground">
                  <span>{points[0]?.label}</span>
                  <span>{points[points.length - 1]?.label}</span>
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </div>
  );
}
