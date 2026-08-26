"use client";

import { Info } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { WeekBars } from "@/components/charts/week-bars";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent, formatWeek } from "@/lib/format";
import { useWeekPlan } from "@/lib/api/promoter";
import { useSession } from "@/lib/permissions";

/**
 * FR-P-06 — doors and number of yes per day, current day highlighted.
 *
 * Read-only in v1. Worth stating on screen: this page is results per day, not a
 * shift calendar. The promoter shift calendar discussed for the maps app is a
 * different thing and conflating them would be a real misunderstanding.
 */
export default function PromoterUkeplan() {
  const now = new Date();
  const who = useSession()?.name ?? "Deg";
  const week = useWeekPlan();

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Ukeplan"
        description="Dører og ja per dag"
        period={formatWeek(now)}
        source="AB Maps"
        lastUpdated={now}
      />

      <QueryBoundary
        query={week}
        skeleton={<Skeleton className="h-64 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen ukeplan lagt inn ennå"
        emptyDescription="Dagene fylles ut etter hvert som salg registreres i AB Maps."
        className="flex flex-col gap-7"
      >
        {(days) => {
          const worked = days.filter((d) => d.doors > 0);
          const doors = days.reduce((a, d) => a + d.doors, 0);
          const yes = days.reduce((a, d) => a + d.yes, 0);
          const rate = doors > 0 ? yes / doors : 0;
          const best = worked.reduce<typeof worked[number] | null>(
            (b, d) => (!b || d.doors > b.doors ? d : b),
            null,
          );

          return (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <WeekBars days={days} />
                <p className="mt-4 border-t border-border pt-3 font-mono text-[10.5px] text-muted-foreground">
                  {who} · {formatWeek(now)} · AB Maps · dagens dag i full farge
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Dører denne uken" value={formatNumber(doors)} />
                <Stat label="Ja denne uken" value={formatNumber(yes)} />
                <Stat label="Ja-prosent" value={formatPercent(rate, 1)} />
                <Stat
                  label="Beste dag"
                  value={best ? best.day : "—"}
                  sub={best ? `${formatNumber(best.doors)} dører` : undefined}
                />
              </div>

              <section>
                <h2 className="mb-3 text-[15px] font-medium text-foreground">Dag for dag</h2>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <ul>
                    {days.map((d) => {
                      const dayRate = d.doors > 0 ? d.yes / d.doors : 0;
                      return (
                        <li
                          key={d.day}
                          className={`flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-0 ${
                            d.isToday ? "bg-[var(--ab-accent-9)]/[0.06]" : ""
                          }`}
                        >
                          <div className="flex min-w-0 items-baseline gap-2.5">
                            <span
                              className={`text-[13px] ${
                                d.isToday ? "font-medium text-foreground" : "text-foreground"
                              }`}
                            >
                              {d.day}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {d.date}
                            </span>
                            {d.isToday && (
                              <span className="rounded-full border border-[var(--ab-accent-9)]/30 bg-[var(--ab-accent-9)]/12 px-2 py-0.5 font-mono text-[10px] text-[var(--ab-accent-11)]">
                                i dag
                              </span>
                            )}
                          </div>
                          {d.doors > 0 ? (
                            <div className="flex shrink-0 items-baseline gap-4 font-mono text-[12px] tabular-nums">
                              <span className="text-foreground">{formatNumber(d.doors)} dører</span>
                              <span className="text-muted-foreground">{d.yes} ja</span>
                              <span className="w-12 text-right text-muted-foreground">
                                {formatPercent(dayRate, 1)}
                              </span>
                            </div>
                          ) : (
                            <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
                              ikke registrert
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>

              <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Ukeplanen viser registrerte resultater per dag, ikke vaktplan. Den er skrivebeskyttet
                i denne versjonen — endringer gjøres i AB Maps.
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-[22px] leading-none tabular-nums text-foreground">
        {value}
      </p>
      {sub && <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
