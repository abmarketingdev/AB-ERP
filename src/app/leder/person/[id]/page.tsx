"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { ComparisonBar } from "@/components/charts/comparison-bar";
import { StackedBar } from "@/components/charts/stacked-bar";
import { BulletBar } from "@/components/charts/bullet-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonDetail } from "@/lib/api/leader";
import { formatNumber, formatPercent } from "@/lib/format";
import { riseIn } from "@/lib/motion";
import type { PersonDetail } from "@/types/leader";

/**
 * Doc 04 — person detail. The screen the analytics doc singles out.
 *
 * "The baseline band is the important one. The follow-up engine flags deviation
 * from a *personal* baseline, not from a team average. The chart must show
 * that, or the leader will misread a naturally lower-volume promoter as
 * underperforming."
 *
 * So the first chart is doors against that person's own normal range, and the
 * second is doors against the org threshold — two different questions that a
 * single chart would blur:
 *
 *   1. *Is this a change, or is this their normal?*  → band
 *   2. *How many days were under the rule?*          → threshold line
 *
 * A promoter can sit inside their own band every single day and still be under
 * the threshold every single day. That is not a contradiction; it is the most
 * important thing a leader can know before opening a conversation, and one
 * chart cannot say it.
 */
export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const now = new Date();
  const query = usePersonDetail(params.id);

  return (
    <div className="flex flex-1 flex-col gap-7">
      <Link
        href="/leder/teamresultater"
        className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tilbake til teamresultater
      </Link>

      <QueryBoundary
        query={query}
        skeleton={<Skeleton className="h-96 rounded-xl" />}
        className="flex flex-col gap-7"
      >
        {(p) => <Detail person={p} now={now} />}
      </QueryBoundary>
    </div>
  );
}

function Detail({ person: p, now }: { person: PersonDetail; now: Date }) {
  const reduced = useReducedMotion();

  const insideBand = p.series.length - p.daysBelowBaseline;
  const pct = Math.round((insideBand / p.series.length) * 100);

  return (
    <>
      <PageHeader
        title={p.name}
        description={`${p.team} · ${p.campaign}`}
        period="Siste 30 dager"
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      {/*
        The sentence that stops the misreading, before either chart. Numbers
        alone let a reader draw the wrong conclusion and then look for support.
      */}
      <motion.p
        {...riseIn(0, reduced)}
        className="rounded-xl border border-border bg-secondary/30 px-5 py-4 text-[13.5px] text-foreground"
      >
        {p.name.split(" ")[0]} har ligget innenfor sitt eget normalnivå{" "}
        <span className="font-mono tabular-nums">{insideBand}</span> av{" "}
        <span className="font-mono tabular-nums">{p.series.length}</span> dager ({pct} %).
        {p.daysBelowThreshold > 0 && (
          <>
            {" "}
            Samtidig er{" "}
            <span className="font-mono tabular-nums">{p.daysBelowThreshold}</span> dager under
            terskelen på {p.threshold} dører.
          </>
        )}{" "}
        <span className="text-muted-foreground">
          Det er to forskjellige spørsmål: om noe har endret seg, og om nivået er godt nok.
        </span>
      </motion.p>

      <motion.div {...riseIn(1, reduced)} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Dører per dag" value={formatNumber(p.doorsPerDay)} sub={`Normalnivå ${formatNumber(p.baseline)}`} />
        <Stat label="Ja-prosent" value={formatPercent(p.yesRate / 100, 1)} />
        <Stat label="Aktive givere" value={formatNumber(p.donors)} sub={`Mål ${formatNumber(p.target)}`} />
        <Stat
          label="Dager under terskel"
          value={`${p.daysBelowThreshold} av ${p.series.length}`}
          tone={p.daysBelowThreshold > p.series.length / 3 ? "text-warning" : undefined}
        />
      </motion.div>

      <motion.div {...riseIn(2, reduced)}>
        <ChartFrame
          question="Hvor ligger hun mot sitt eget mål?"
          period="August 2026"
          source="Dashboard.xlsx"
          lastUpdated={now}
          state="ready"
        >
        <BulletBar
          label={`${p.name} — aktive givere`}
          current={p.donors}
          target={p.target}
          expected={Math.round((p.target * 20) / 31)}
          projected={Math.round((p.donors / 20) * 31)}
          unit="givere"
        />
        </ChartFrame>
      </motion.div>

      {/* Chart 1 — is this a change, or their normal? */}
      <motion.div {...riseIn(3, reduced)}>
        <ChartFrame
          question="Er dette en endring, eller er det normalen for denne personen?"
          period="Siste 30 dager"
          source="Dashboard.xlsx"
          lastUpdated={now}
          state="ready"
          summary={`Dører per dag for ${p.name} over 30 dager, mot personens eget normalnivå på ${p.series[0]?.band[0]}–${p.series[0]?.band[1]} dører.`}
          table={{
            caption: `Dører per dag, ${p.name}, siste 30 dager`,
            columns: ["Dag", "Dører", "Normalnivå"],
            rows: p.series.map((d) => [d.label, d.doors, `${d.band[0]}–${d.band[1]}`]),
          }}
        >
          <TrendLineChart
            data={p.series.map((d) => ({ label: d.label, value: d.doors, band: d.band }))}
            seriesName="Dører"
            bandLabel={`${p.name.split(" ")[0]} sitt normalnivå (${formatNumber(p.series[0]?.band[0] ?? 0)}–${formatNumber(p.series[0]?.band[1] ?? 0)} dører per dag)`}
            height={240}
          />
        </ChartFrame>
      </motion.div>

      {/* Chart 2 — how many days under the rule? */}
      <motion.div {...riseIn(4, reduced)}>
        <ChartFrame
          question="Hvor mange dager er under terskelen?"
          period="Siste 30 dager"
          source="Terskler — eid av Drift"
          lastUpdated={now}
          state="ready"
          summary={`Dører per dag mot terskelen på ${p.threshold}. ${p.daysBelowThreshold} av ${p.series.length} dager er under.`}
          table={{
            caption: `Dager under terskel, ${p.name}`,
            columns: ["Dag", "Dører", "Under terskel"],
            rows: p.series.map((d) => [d.label, d.doors, d.belowThreshold ? "Ja" : "Nei"]),
          }}
        >
          <ComparisonBar
            data={p.series.map((d) => ({ label: d.label, value: d.doors }))}
            reference={{ value: p.threshold, label: `Terskel ${p.threshold} dører/dag · eid av ${p.thresholdOwner}` }}
            seriesLabel="Dører per dag"
            height={220}
          />
        </ChartFrame>
      </motion.div>

      {/* Chart 3 — composition, the StackedBar case. */}
      <motion.div {...riseIn(5, reduced)}>
        <ChartFrame
          question="Hvordan fordeler salgene seg på kampanjer?"
          period="Uke 31–34"
          source="Dashboard.xlsx"
          lastUpdated={now}
          state="ready"
          summary={`Fordeling av salg på kampanjer for ${p.name}, uke 31 til 34.`}
          table={{
            caption: `Salg per kampanje, ${p.name}`,
            columns: ["Uke", ...(p.mix[0]?.segments.map((sg) => sg.key) ?? [])],
            rows: p.mix.map((m) => [m.label, ...m.segments.map((sg) => sg.value)]),
          }}
        >
          <StackedBar
            data={p.mix}
            keys={p.mix[0]?.segments.map((s) => s.key) ?? []}
            height={200}
          />
        </ChartFrame>
      </motion.div>

      <p className="font-mono text-[10.5px] text-muted-foreground">
        {p.team} · normalnivået er regnet ut fra personens egen historikk, ikke fra teamsnittet ·
        terskelen eies av {p.thresholdOwner}
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-mono text-[22px] leading-none tabular-nums ${tone ?? "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
