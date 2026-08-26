"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { ComparisonBar } from "@/components/charts/comparison-bar";
import { KpiTile } from "@/components/patterns/kpi-tile";
import { FilterBar, FilterSummary, type FilterDef } from "@/components/patterns/filter-bar";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { SparkLine } from "@/components/charts/spark-line";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { formatNumber, formatPercent } from "@/lib/format";
import { Segmented } from "@/components/patterns/segmented";
import { TeamDistribution, MemberDetail } from "@/components/charts/team-distribution";
import { useLeaderKpis, useTeamMembers, useTeamTrend, useThresholds, useTeamHistory } from "@/lib/api/leader";
import type { TeamMember } from "@/types/leader";

/**
 * The analytical screen (FR-L-01, FR-L-02).
 *
 * Filters live in the URL so a view is shareable — a leader pastes a link and
 * the recipient sees exactly the same slice. One filter row scopes everything
 * below it, so the tiles, the chart and the table can never disagree.
 *
 * The per-person table matters more than any chart here: it is the thing that
 * answers "who specifically", which is the question a leader actually arrived with.
 */

type SortKey = "name" | "doors" | "yes" | "yesRate" | "activeDonors";

const PERIODS = [
  { value: "uke-34", label: "Uke 34" },
  { value: "august-2026", label: "August 2026" },
  { value: "q3-2026", label: "3. kvartal 2026" },
];

export default function LederTeamresultater() {
  const now = new Date();
  const params = useSearchParams();
  const kpis = useLeaderKpis();
  const members = useTeamMembers();
  const trend = useTeamTrend();

  const [sort, setSort] = React.useState<SortKey>("doors");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  /*
   * Two readings of the same slice: distribution answers "who is below and by how
   * much", the table answers "what exactly". Neither replaces the other.
   *
   * The choice lives in the URL alongside the filters. If a leader shares a link
   * because the distribution makes their point, the recipient opening a table has
   * been shown something different from what was sent — which defeats the share.
   */
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = React.useState<string | null>(null);
  const thresholds = useThresholds();
  const doorsThreshold = thresholds.data?.find((t) => t.key === "doors_per_day");

  const view = params.get("view") === "tabell" ? "tabell" : "fordeling";
  function setView(next: "fordeling" | "tabell") {
    const q = new URLSearchParams(params.toString());
    if (next === "fordeling") q.delete("view");
    else q.set("view", next);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const periodKey = params.get("period") ?? "uke-34";
  const campaign = params.get("campaign") ?? "alle";
  const person = params.get("person") ?? "alle";
  const periodLabel = PERIODS.find((p) => p.value === periodKey)?.label ?? "Uke 34";

  function toggleSort(key: SortKey) {
    if (key === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "name" ? "asc" : "desc");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Teamresultater"
        description="Resultater per person i ditt team"
        period={periodLabel}
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      <QueryBoundary
        query={members}
        skeleton={<Skeleton className="h-96 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen personer i dette teamet"
        className="flex flex-col gap-7"
      >
        {(all) => {
          const campaigns = Array.from(new Set(all.map((m) => m.campaign))).sort();
          const filters: FilterDef[] = [
            { key: "period", label: "Periode", allValue: "uke-34", allLabel: "Uke 34", options: PERIODS.filter((p) => p.value !== "uke-34"), width: "w-44" },
            { key: "campaign", label: "Kampanje", allValue: "alle", allLabel: "Alle kampanjer", options: campaigns.map((c) => ({ value: c, label: c })), width: "w-52" },
            { key: "person", label: "Person", allValue: "alle", allLabel: "Alle personer", options: all.map((m) => ({ value: m.id, label: m.name })), width: "w-56" },
          ];

          const rows = all
            .filter((m) => campaign === "alle" || m.campaign === campaign)
            .filter((m) => person === "alle" || m.id === person);

          const sorted = [...rows].sort((a, b) => {
            const av = a[sort];
            const bv = b[sort];
            const cmp = typeof av === "string" ? av.localeCompare(bv as string, "nb") : (av as number) - (bv as number);
            return dir === "asc" ? cmp : -cmp;
          });

          const flagged = rows.filter((m) => m.belowThreshold).length;
          // Shared scale across rows, so row sparklines are comparable to each other.
          const sparkMax = Math.max(...rows.flatMap((m) => m.spark), 1);

          return (
            <>
              <div className="flex flex-col gap-2">
                <FilterBar filters={filters} />
                <FilterSummary
                  parts={[
                    periodLabel,
                    campaign === "alle" ? "alle kampanjer" : campaign,
                    person === "alle"
                      ? `${rows.length} personer`
                      : (all.find((m) => m.id === person)?.name ?? ""),
                  ]}
                />
              </div>

              <QueryBoundary
                query={kpis}
                skeleton={<Skeleton className="h-[188px] rounded-xl" />}
                isEmpty={(d) => d.length === 0}
                emptyTitle="Ingen tall for denne perioden"
              >
                {(list) => (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {list.slice(0, 4).map((k) => (
                      <KpiTile key={k.key} kpi={k} />
                    ))}
                  </div>
                )}
              </QueryBoundary>

              <QueryBoundary
                query={trend}
                skeleton={<Skeleton className="h-64 rounded-xl" />}
                isEmpty={(d) => d.length < 3}
                emptyTitle="For få perioder til å vise en kurve"
              >
                {(points) => (
                  <ChartFrame
                    question="Ligger teamet an mot planen, uke for uke?"
                    period={periodLabel}
                    source="Dashboard.xlsx"
                    lastUpdated={now}
                    state="ready"
                    summary="Aktive givere per uke mot ukesandelen av månedsmålet."
                    table={{
                      caption: "Aktive givere per uke mot plan",
                      columns: ["Uke", "Aktive givere", "Plan"],
                      rows: points.map((p) => [p.label, p.actual, p.plan ?? "—"]),
                    }}
                  >
                    <TrendLineChart
                      data={points.map((p) => ({
                        label: p.label,
                        value: p.actual,
                        secondaryValue: p.plan,
                      }))}
                      /* Names the unit. Without it the tooltip says "Verdi" and
                         nothing on screen tells the reader whether the line is
                         doors, donors or kroner. */
                      seriesName="Aktive givere"
                      secondarySeriesLabel="Plan"
                    />
                  </ChartFrame>
                )}
              </QueryBoundary>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h2 className="text-[15px] font-medium text-foreground">Per person</h2>
                    {flagged > 0 && (
                      <span className="flex items-center gap-1.5 text-[12px] text-warning">
                        <AlertTriangle className="size-3.5" />
                        {flagged} under terskel
                      </span>
                    )}
                  </div>
                  <Segmented
                    layoutId="team-view"
                    ariaLabel="Velg visning"
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "fordeling", label: "Fordeling" },
                      { value: "tabell", label: "Tabell" },
                    ]}
                  />
                </div>

                {selected && (
                  <div className="mb-3 flex flex-col gap-2">
                    <MemberDetail
                      member={rows.find((m) => m.id === selected)!}
                      threshold={doorsThreshold}
                    />
                    {/* Doc 04: the per-person table should "click through to the
                        person". The inline panel answers "how much"; the detail
                        page answers "is this their normal", which needs charts. */}
                    <Link
                      href={`/leder/person/${selected}`}
                      className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-[13px] text-foreground transition-colors duration-[120ms] hover:border-[var(--ab-accent-9)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
                    >
                      Se {rows.find((m) => m.id === selected)?.name.split(" ")[0]} sin utvikling mot eget normalnivå
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                )}

                {view === "fordeling" ? (
                  <TeamDistribution
                    members={rows}
                    threshold={doorsThreshold}
                    selectedId={selected}
                    onSelect={(id) => setSelected(selected === id ? null : id)}
                  />
                ) : (

                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-[13px]">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40">
                          <Th onClick={() => toggleSort("name")} active={sort === "name"} dir={dir}>Navn</Th>
                          <Th>Kampanje</Th>
                          <Th onClick={() => toggleSort("doors")} active={sort === "doors"} dir={dir} num>Dører</Th>
                          <Th onClick={() => toggleSort("yes")} active={sort === "yes"} dir={dir} num>Ja</Th>
                          <Th onClick={() => toggleSort("yesRate")} active={sort === "yesRate"} dir={dir} num>Ja-%</Th>
                          <Th onClick={() => toggleSort("activeDonors")} active={sort === "activeDonors"} dir={dir} num>Aktive givere</Th>
                          <Th>Trend, 12 dager · felles skala</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((m) => (
                          <Row
                            key={m.id}
                            member={m}
                            sparkMax={sparkMax}
                            selected={selected === m.id}
                            onSelect={() => setSelected(selected === m.id ? null : m.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-border px-4 py-2.5 font-mono text-[10.5px] text-muted-foreground">
                    Team Vest · {periodLabel} · kun godkjente salg · sparklinjer deler skala så rader
                    kan sammenlignes
                  </p>
                </div>
                )}
              </section>

              {/* Doc 04's three Teamresultater charts. Each is titled with the
                  decision it supports, not with what it plots. */}
              <TeamCharts periodLabel={periodLabel} now={now} />
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

/**
 * Doc 04 names three charts here and a decision for each:
 * "Which months missed?", "Are we recoverable?", "Which weeks broke pattern?"
 *
 * They sit below the per-person table on purpose. Doc 04 is explicit that "the
 * per-person table matters more than any chart on this screen" — the leader's
 * first question is who, and the charts answer the follow-up.
 */
function TeamCharts({ periodLabel, now }: { periodLabel: string; now: Date }) {
  const history = useTeamHistory();

  return (
    <QueryBoundary
      query={history}
      skeleton={<Skeleton className="h-72 rounded-xl" />}
      className="flex flex-col gap-4"
    >
      {(h) => {
        // The pattern the weekly chart is measured against: the period's own
        // mean, not a target — "broke pattern" is a question about this team's
        // normal, and a plan would answer a different one.
        const weeklyMean = Math.round(
          h.recruitedPerWeek.reduce((n, w) => n + w.value, 0) /
            Math.max(1, h.recruitedPerWeek.length),
        );
        return (
        <>
          <ChartFrame
            question="Hvilke måneder bommet på planen?"
            period="Mars–august 2026"
            source="Dashboard.xlsx"
            lastUpdated={now}
            state="ready"
            summary={`Faktisk mot plan per måned. ${h.months.filter((m) => m.actual < m.plan).length} av ${h.months.length} måneder ligger under plan.`}
            table={{
              caption: "Faktisk mot plan per måned",
              columns: ["Måned", "Faktisk", "Plan"],
              rows: h.months.map((m) => [m.label, m.actual, m.plan]),
            }}
          >
            <ComparisonBar
              data={h.months.map((m) => ({ label: m.label, value: m.actual, plan: m.plan }))}
              seriesLabel="Faktisk"
              planLabel="Plan"
              height={200}
            />
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              August er ikke ferdig, så den siste søylen dekker en kortere periode enn de andre.
            </p>
          </ChartFrame>

          <ChartFrame
            question="Er avviket mulig å hente inn?"
            period="Mars–august 2026"
            source="Dashboard.xlsx"
            lastUpdated={now}
            state="ready"
            summary="Akkumulert faktisk mot akkumulert plan. Avstanden mellom linjene er etterslepet."
            table={{
              caption: "Akkumulert faktisk mot plan",
              columns: ["Måned", "Akkumulert faktisk", "Akkumulert plan"],
              rows: h.accumulated.map((m) => [m.label, m.actual, m.plan]),
            }}
          >
            <TrendLineChart
              data={h.accumulated.map((m) => ({
                label: m.label,
                value: m.actual,
                secondaryValue: m.plan,
              }))}
              seriesName="Akkumulert faktisk"
              secondarySeriesLabel="Akkumulert plan"
              height={210}
            />
          </ChartFrame>

          <ChartFrame
            question="Hvilke uker brøt mønsteret?"
            period={periodLabel}
            source="Dashboard.xlsx"
            lastUpdated={now}
            state="ready"
            summary={`Rekrutterte givere per uke mot snittet på ${weeklyMean} i perioden. ${
              h.recruitedPerWeek.filter((w) => w.value < weeklyMean).length
            } av ${h.recruitedPerWeek.length} uker ligger under snittet.`}
            table={{
              caption: `Rekrutterte givere per uke (snitt ${weeklyMean})`,
              columns: ["Uke", "Rekrutterte", "Mot snitt"],
              rows: h.recruitedPerWeek.map((w) => [
                w.label,
                w.value,
                `${w.value - weeklyMean > 0 ? "+" : ""}${w.value - weeklyMean}`,
              ]),
            }}
          >
            {/*
              Doc 04 asks this chart to answer "which weeks broke pattern",
              and bare bars cannot: without something to break *from*, the
              reader is comparing twelve similar heights by eye. The period
              mean, drawn and labelled, is the pattern — and doc 04's own rule
              is that a threshold gets a labelled reference line or it is noise.
            */}
            <ComparisonBar
              data={h.recruitedPerWeek}
              seriesLabel="Rekrutterte givere"
              reference={{ value: weeklyMean, label: `Snitt ${weeklyMean}` }}
              height={190}
            />
          </ChartFrame>
        </>
        );
      }}
    </QueryBoundary>
  );
}

function Row({
  member,
  sparkMax,
  selected,
  onSelect,
}: {
  member: TeamMember;
  sparkMax: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      aria-selected={selected}
      className={`cursor-pointer border-b border-border transition-colors last:border-0 ${
        selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
      }`}
    >
      <td className="px-4 py-2.5">
        <span className="flex items-center gap-2">
          {/* Below-threshold is marked by a dot and a tooltip-free label, never colour alone. */}
          {member.belowThreshold && (
            <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
          )}
          <span className="text-foreground">{member.name}</span>
          {member.belowThreshold && <span className="sr-only">under terskel</span>}
        </span>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">{member.campaign}</td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
        {formatNumber(member.doors)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
        {formatNumber(member.yes)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
        {formatPercent(member.yesRate / 100, 1)}
      </td>
      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">
        {formatNumber(member.activeDonors)}
      </td>
      <td className="px-4 py-2">
        {/* Pair every sparkline with a number — the line shows shape, the column shows value. */}
        <SparkLine
          points={[...member.spark, sparkMax].slice(0, member.spark.length)}
          width={104}
          height={26}
          className="text-muted-foreground"
          ariaLabel={`${member.name}, utvikling over ${member.spark.length} dager`}
        />
      </td>
    </tr>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  num,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  num?: boolean;
}) {
  const base = `px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${
    num ? "text-right" : "text-left"
  }`;
  if (!onClick) return <th className={`${base} text-muted-foreground`}>{children}</th>;
  return (
    <th className={base} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          active ? "text-foreground" : "text-muted-foreground"
        } ${num ? "flex-row-reverse" : ""}`}
      >
        {children}
        {/* Unsorted headers stay quiet — a permanent arrow on every column is noise. */}
        {active && <ArrowUpDown className="size-3" />}
      </button>
    </th>
  );
}
