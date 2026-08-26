"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AreaSpark } from "@/components/charts/area-spark";
import { formatNumber, formatPercent, formatCurrency, formatDateTime } from "@/lib/format";
import type { KpiValue } from "@/types/kpi";

/**
 * The most-used component in the product — promoter, leader and customer all
 * render it, so it exists once.
 *
 * Reading order is fixed and never varies between tiles:
 *   label → value → delta → trend → provenance
 *
 * The value appears at its value. It never counts up: these are performance and
 * financial figures, and animating them is both a design and an honesty problem.
 */
export function KpiTile({ kpi, className }: { kpi: KpiValue; className?: string }) {
  const formatted =
    kpi.unit === "percent"
      ? formatPercent(kpi.value / 100, 1)
      : kpi.unit === "currency"
        ? formatCurrency(kpi.value)
        : formatNumber(kpi.value);

  const tone = deltaTone(kpi.delta?.direction);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-[var(--ab-accent-9)]/35 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-3 px-5 pt-4">
        {/* Label — tapping it explains where the number came from (FR-P-02). */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 w-fit items-center gap-1.5 rounded text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
            >
              {kpi.label}
              {/* Faintly visible at rest, not hover-only: on a phone there is no hover,
                  and an affordance nobody can see is an affordance nobody uses. */}
              <Info className="size-3 opacity-40 transition-opacity group-hover:opacity-80" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 text-sm">
            <p className="font-medium text-foreground">{kpi.label}</p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <Row label="Gjelder" value={kpi.subject} />
              <Row label="Definisjon" value={`Versjon ${kpi.definitionVersion}`} />
              <Row label="Datakilde" value={sourceLabel(kpi.source)} />
              <Row label="Periode" value={kpi.period.label} />
              <Row label="Beregnet" value={formatDateTime(kpi.computedAt)} />
              <Row
                label="Grunnlag"
                value={kpi.approvedOnly ? "Kun godkjente salg" : "Alle registrerte salg"}
              />
            </dl>
          </PopoverContent>
        </Popover>

        <p className="font-mono text-[34px] font-normal leading-none tracking-tight tabular-nums text-foreground">
          {formatted}
        </p>

        {kpi.delta && (
          <span className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-secondary/60 py-1 pl-2 pr-2.5 text-[11px]">
            {/* Colour never carries the meaning alone — the dot and arrow do too. */}
            <span className={`size-1.5 rounded-full ${tone.dot}`} aria-hidden />
            <tone.Icon className={`size-3 ${tone.text}`} aria-hidden />
            <span className={`font-mono tabular-nums ${tone.text}`}>
              {kpi.delta.value > 0 ? "+" : ""}
              {formatNumber(kpi.delta.value)}
            </span>
            <span className="text-muted-foreground">{kpi.delta.comparisonLabel}</span>
          </span>
        )}
      </div>

      {/* Sparkline bleeds to the card edge — no padding, no axis, endpoint only. */}
      {kpi.spark && kpi.spark.length > 1 && (
        <div className="-mb-px mt-3 w-full">
          <AreaSpark
            id={kpi.key}
            points={kpi.spark}
            width={320}
            height={52}
            className="h-[52px] w-full"
            ariaLabel={`${kpi.label}, utvikling over ${kpi.spark.length} perioder`}
          />
        </div>
      )}

      {/*
        FR-P-02 — who it applies to, the period, the source, and when.
        FR-P-05 / FR-Q-06 — and, in the same breath, that the figure counts
        approved sales only. A promoter who signed twelve and sees ten needs
        that sentence next to the ten, not in a help page: without it the
        obvious reading is that the system lost two.
      */}
      <div className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] leading-[1.5] text-muted-foreground">
        {/* Truncation always carries the full text (doc 02): a provenance line
            that ends in "Kvalitetskontr…" is provenance nobody can check. */}
        <p className="truncate" title={`${kpi.subject} · ${kpi.period.label} · ${sourceLabel(kpi.source)}`}>
          {kpi.subject} · {kpi.period.label} · {sourceLabel(kpi.source)}
        </p>
        <p>
          {kpi.approvedOnly ? "Kun godkjente salg · " : ""}
          oppdatert {formatDateTime(kpi.computedAt)}
        </p>
      </div>
    </div>
  );
}

function deltaTone(direction?: "up" | "down" | "flat") {
  if (direction === "up") return { Icon: ArrowUp, text: "text-success", dot: "bg-success" };
  if (direction === "down") return { Icon: ArrowDown, text: "text-danger", dot: "bg-danger" };
  return { Icon: Minus, text: "text-muted-foreground", dot: "bg-muted-foreground" };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function sourceLabel(source: KpiValue["source"]): string {
  const map: Record<KpiValue["source"], string> = {
    maps: "AB Maps",
    hr: "HR",
    qc: "Kvalitetskontroll",
    learning: "Læringsplattform",
    analytics: "Analyse",
    dashboard_xlsx: "Dashboard.xlsx",
  };
  return map[source];
}
