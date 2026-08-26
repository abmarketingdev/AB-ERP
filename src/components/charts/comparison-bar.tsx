"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";
import { CHART_MOTION, MATCH_BY_LABEL } from "./chart-motion";
import { SparseFigures, isSparse } from "./sparse-figures";

/**
 * Doc 04's `ComparisonBar` — vertical bars over time, optionally grouped against
 * plan, optionally with a labelled threshold.
 *
 * Distinct from the horizontal categorical chart in `distribution-bar.tsx`,
 * which is doc 04's `DistributionBar`. The two had collapsed into one name; a
 * "which months missed?" question and a "who specifically?" question want
 * different charts, and calling both ComparisonBar hid that.
 *
 * Rules it owns so callers cannot get them wrong:
 * - **Zero-based axis.** Bars encode quantity by area; truncating the baseline
 *   doubles an apparent difference. Non-negotiable, and not configurable.
 * - **Threshold lines carry their value.** Doc 04: "An unlabelled line is noise."
 * - **Animation settings come from `chart-motion.ts`.** The re-animate-on-every-
 *   render problem is not solved by disabling animation; it is caused by an
 *   unstable `data` identity, because Recharts keys its animation off reference
 *   equality. Memoise the rows and the mount plays once, exactly as doc 02 asks,
 *   while data changes still morph — which is the part that carries meaning.
 */
export interface ComparisonRow {
  label: string;
  value: number;
  /** The plan/target for the same period. Rendered as the muted companion bar. */
  plan?: number;
  /** Marks a bar as the current period, or otherwise worth the eye. */
  highlight?: boolean;
}

export interface ComparisonBarProps {
  data: ComparisonRow[];
  reference?: { value: number; label: string };
  planLabel?: string;
  seriesLabel?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}

export function ComparisonBar({
  data,
  reference,
  planLabel,
  seriesLabel,
  valueFormatter = formatNumber,
  height = 220,
}: ComparisonBarProps) {
  const hasPlan = data.some((d) => typeof d.plan === "number");
  const mixedAgainstReference =
    !!reference &&
    data.some((d) => d.value < reference.value) &&
    data.some((d) => d.value >= reference.value);

  if (isSparse(data.length)) {
    return (
      <SparseFigures
        points={data.map((d) => ({ label: d.label, value: d.value, secondary: d.plan }))}
        valueFormatter={valueFormatter}
      />
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          /* Right margin holds the reference label; without it the text is
             clipped at the plot edge. */
          margin={{ top: 12, right: reference ? 68 : 8, bottom: 0, left: 0 }}
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            width={44}
            tickCount={4}
            allowDecimals={false}
            domain={[0, "auto"]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => valueFormatter(Math.round(v))}
          />
          <Tooltip
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.06 }}
            formatter={((value: number) => valueFormatter(value)) as (value: unknown) => React.ReactNode}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />

          {/* Plan first so actual draws on top of it. */}
          {hasPlan && (
            <Bar
              dataKey="plan"
              name={planLabel ?? "Plan"}
              fill="var(--chart-5)"
              fillOpacity={0.45}
              radius={[3, 3, 0, 0]}
              {...CHART_MOTION}
              animationMatchBy={MATCH_BY_LABEL}
            />
          )}
          <Bar
            dataKey="value"
            name={seriesLabel ?? "Verdi"}
            radius={[3, 3, 0, 0]}
            {...CHART_MOTION}
            animationMatchBy={MATCH_BY_LABEL}
          >
            {data.map((d) => (
              // Dimming every bar when every bar is under the threshold conveys
              // nothing — the reference line already says it. Only de-emphasise
              // when there is a mix to distinguish.
              //
              // Keyed by label, not index: with an index key a re-sort makes
              // Recharts animate one entity's bar into another's position.
              <Cell
                key={d.label}
                fill={d.highlight ? "var(--ab-accent-9)" : "var(--chart-1)"}
                fillOpacity={mixedAgainstReference && d.value < reference!.value ? 0.5 : 1}
              />
            ))}
          </Bar>

          {reference && (
            /*
             * The reference line renders *above* the bars and its label sits in
             * the right margin, clear of them.
             *
             * `insideTopLeft` put amber text straight onto the first bar, which
             * on this palette is near-white: the one label that has to be read
             * was the least readable thing in the chart. The right margin is
             * reserved for it, so the label always lands on the card, never on
             * a column.
             */
            <ReferenceLine
              y={reference.value}
              stroke="var(--warning)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{
                value: reference.label,
                position: "right",
                fontSize: 11,
                fontWeight: 500,
                fill: "var(--warning)",
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      {(seriesLabel || planLabel) && (
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
          {seriesLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[2px] bg-[var(--chart-1)]" aria-hidden />
              {seriesLabel}
            </span>
          )}
          {planLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[2px] bg-[var(--chart-5)]/45" aria-hidden />
              {planLabel}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
