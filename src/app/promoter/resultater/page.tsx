"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { KpiTile } from "@/components/patterns/kpi-tile";
import { Segmented } from "@/components/patterns/segmented";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  usePromoterKpis,
  useDailyResults,
  useCorrectionNotices,
  type KpiGranularity,
} from "@/lib/api/promoter";
import { CorrectionNotice } from "@/components/patterns/correction-notice";

/**
 * Own KPIs in detail (FR-P-03, FR-P-04, FR-Q-02).
 *
 * FR-P-03 is enforced by the endpoint resolving "me" — there is no promoter id
 * anywhere in this screen's data or URL, so there is nothing to tamper with. The
 * banner states that plainly rather than leaving the promoter to wonder whose
 * numbers these are.
 */
export default function PromoterResultater() {
  const now = new Date();
  const [granularity, setGranularity] = React.useState<KpiGranularity>("week");
  const kpis = usePromoterKpis(granularity);
  const daily = useDailyResults(granularity);
  /*
   * FR-Q-04 — the same notice as the front page, because this is where the
   * corrected number actually is. Somebody who lands here from a link and finds
   * a figure lower than they remember has no other way to learn why, and a
   * lower number without an explanation reads as the system losing their work.
   */
  const notices = useCorrectionNotices();

  const periodLabel = { day: "20. august 2026", week: "Uke 34", month: "August 2026" }[granularity];

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Resultater"
        description="Trend og detaljer for dine tall"
        period={periodLabel}
        source="Dashboard.xlsx"
        lastUpdated={now}
        actions={
          <Segmented
            layoutId="res-period"
            ariaLabel="Velg periode"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: "day", label: "Dag" },
              { value: "week", label: "Uke" },
              { value: "month", label: "Måned" },
            ]}
          />
        }
      />

      {notices.data && notices.data.length > 0 && <CorrectionNotice notices={notices.data} />}

      {/* FR-P-03 stated on screen, not just enforced in the query. */}
      <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
        <Lock className="size-3.5 shrink-0" aria-hidden />
        Du ser kun dine egne resultater. Andre promotørers tall er ikke tilgjengelige her.
      </p>

      <QueryBoundary
        query={kpis}
        skeleton={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[188px] rounded-xl" />
            ))}
          </div>
        }
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen tall for denne perioden"
      >
        {(list) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {list.map((k) => (
              <KpiTile key={`${granularity}-${k.key}`} kpi={k} />
            ))}
          </div>
        )}
      </QueryBoundary>

      <QueryBoundary
        query={daily}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen registrerte dager i perioden"
        className="flex flex-col gap-7"
      >
        {(rows) => (
          <>
            {/*
             * Small multiples, not two series on one axis. Doors run around 60
             * and yes around 4 — on a shared scale the yes line is crushed flat
             * against the baseline and reads as "nothing happened". Two panels
             * with independent scales is the honest answer; a second y-axis
             * would invent a correlation that isn't in the data.
             *
             * Doc 04's sparse rule takes its other form here. "Fewer than three
             * points renders as a figure" normally means the chart swaps itself
             * for the numbers — but on this screen those numbers are already
             * three tiles up, so drawing them again would be repetition, and a
             * chart of one day would answer "how has it developed?" with a
             * single dot. The charts step aside and say why, which is the part
             * that would otherwise read as something failing to load.
             */}
            {rows.length >= 3 ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartFrame
                  question="Hvordan har dører utviklet seg?"
                  period={periodLabel}
                  source="Dashboard.xlsx"
                  lastUpdated={now}
                  state="ready"
                >
                  <TrendLineChart
                    data={rows.map((r) => ({ label: r.label, value: r.doors }))}
                    height={200}
                  />
                </ChartFrame>

                <ChartFrame
                  question="Hvordan har antall ja utviklet seg?"
                  period={periodLabel}
                  source="Dashboard.xlsx"
                  lastUpdated={now}
                  state="ready"
                >
                  <TrendLineChart
                    data={rows.map((r) => ({ label: r.label, value: r.yes }))}
                    height={200}
                  />
                </ChartFrame>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-secondary/25 px-5 py-4 text-[13px] text-muted-foreground">
                {rows.length === 1
                  ? "Én dag gir ingen utvikling å vise. Tallene for dagen står i kortene over — velg Uke eller Måned for å se trenden."
                  : "For få dager til å tegne en trend. Velg Uke eller Måned for å se utviklingen."}
              </p>
            )}

            <section>
              <h2 className="mb-3 text-[15px] font-medium text-foreground">Dag for dag</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13px]">
                    {/* A caption, not a name on the wrapper: a screen reader
                        announces it when entering the table, which is the
                        moment the reader needs to know what they are in. */}
                    <caption className="sr-only">
                      Dine resultater dag for dag, {periodLabel}
                    </caption>
                    <thead>
                      <tr className="border-b border-border bg-secondary/40">
                        <Th>Dato</Th>
                        <Th>Ukedag</Th>
                        <Th align="right">Dører</Th>
                        <Th align="right">Ja</Th>
                        <Th align="right">Ja-prosent</Th>
                        <Th>Grunnlag</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.date}
                          className={`border-b border-border last:border-0 ${
                            r.isToday ? "bg-[var(--ab-accent-9)]/[0.06]" : ""
                          }`}
                        >
                          {/* Dates are qualitative — left-aligned, not right. */}
                          <Td>
                            {r.label}
                            {r.isToday && (
                              <span className="ml-2 font-mono text-[10px] text-[var(--ab-accent-11)]">
                                i dag
                              </span>
                            )}
                          </Td>
                          <Td className="text-muted-foreground">{r.weekday}</Td>
                          <Td align="right" mono>
                            {formatNumber(r.doors)}
                          </Td>
                          <Td align="right" mono>
                            {formatNumber(r.yes)}
                          </Td>
                          <Td align="right" mono>
                            {formatPercent(r.yesRate / 100, 1)}
                          </Td>
                          <Td>
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11.5px] ${
                                r.fullyApproved ? "text-muted-foreground" : "text-warning"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  r.fullyApproved ? "bg-muted-foreground" : "bg-warning"
                                }`}
                                aria-hidden
                              />
                              {r.fullyApproved ? "Godkjent" : "Under kvalitetssjekk"}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-border px-4 py-2.5 font-mono text-[10.5px] text-muted-foreground">
                  Rader merket «under kvalitetssjekk» kan endre seg · kilde Dashboard.xlsx
                </p>
              </div>
            </section>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  className,
}: {
  children: React.ReactNode;
  align?: "right";
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2.5 ${align === "right" ? "text-right" : "text-left"} ${
        mono ? "font-mono tabular-nums" : ""
      } ${className ?? "text-foreground"}`}
    >
      {children}
    </td>
  );
}
