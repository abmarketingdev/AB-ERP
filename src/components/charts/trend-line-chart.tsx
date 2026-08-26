"use client";

import * as React from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { formatNumber } from "@/lib/format";
import { SparseFigures, isSparse } from "./sparse-figures";

/** Semantic-only palette — never assign color by series index. */
/**
 * Padding as functions, not strings.
 *
 * Recharts' string arithmetic accepts only `dataMin - N` and `dataMax + N` with
 * a literal number — `"dataMin - dataMin * 0.08"` matches neither regex and is
 * discarded without warning, leaving the raw data bounds. Hoisted to module
 * scope because an inline array of arrow functions is a new identity every
 * render, which defeats Recharts' domain memoisation.
 */
const PADDED_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => min - Math.abs(min) * 0.08,
  (max) => max + Math.abs(max) * 0.04,
];

const SERIES_COLOR = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-5)",
} as const;

interface TrendPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  /**
   * The person's own normal range, as [low, high]. Doc 04 calls this the
   * important one: the follow-up engine flags deviation from a *personal*
   * baseline, not a team average, so without the band a leader reads a
   * naturally low-volume promoter as underperforming.
   */
  band?: [number, number];
}

interface TrendLineChartProps {
  data: TrendPoint[];
  /** A goal/threshold line — the "tension" reference Tufte-style charts need. */
  reference?: { value: number; label: string };
  secondarySeriesLabel?: string;
  /** Names the band in the footnote so it is not a mystery grey stripe. */
  bandLabel?: string;
  /** Names the primary series in the tooltip. "value" is not a word. */
  seriesName?: string;
  valueFormatter?: (v: number) => string;
  height?: number;
}

/**
 * Direct label on the final point instead of a legend entry — the reader should
 * not have to cross-reference a key to learn what the line ended at.
 */
function renderLastPointLabel(lastIndex: number, lastValue: number, valueFormatter: (v: number) => string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LastPointLabel = (props: any) => {
    const { x, y, index } = props;
    if (index !== lastIndex || x == null || y == null) return <React.Fragment key={index} />;
    return (
      <text key={index} x={x + 6} y={y + 4} fontSize={11} fontWeight={500} fill={SERIES_COLOR.primary}>
        {valueFormatter(lastValue)}
      </text>
    );
  };
  LastPointLabel.displayName = "LastPointLabel";
  return LastPointLabel;
}

/** Max two series — beyond that, this isn't a trend chart anymore, it's a
 * table pretending to be a chart. Split it instead of adding a third line. */
export function TrendLineChart({ data, reference, secondarySeriesLabel, bandLabel, seriesName = "Verdi", valueFormatter = formatNumber, height = 220 }: TrendLineChartProps) {
  const hasBand = data.some((d) => Array.isArray(d.band));
  /*
   * Doc 04: "Legend toggles series where more than one exists."
   *
   * Only the comparison series toggles — the primary one is the reason the
   * chart is on the page, and a legend that can hide the answer is a trap. The
   * useful case is the opposite: plan and actual tracking each other so closely
   * that neither line is readable, and the reader wants to see actual alone.
   */
  const [showSecondary, setShowSecondary] = React.useState(true);
  /*
   * With domain "auto" the band's lower edge lands exactly on the axis floor and
   * stops reading as a band at all — it looks like a shaded chart. Pad the
   * domain so there is visible room under and over it.
   */
  const bandDomain = React.useMemo(() => {
    if (!hasBand) return undefined;
    const lows = data.map((d) => d.band?.[0]).filter((v): v is number => typeof v === "number");
    const highs = data.map((d) => d.band?.[1]).filter((v): v is number => typeof v === "number");
    const values = data.map((d) => d.value).filter(Number.isFinite);
    const lo = Math.min(...lows, ...values);
    const hi = Math.max(...highs, ...values);
    const pad = Math.max(3, Math.round((hi - lo) * 0.25));
    return [Math.max(0, lo - pad), hi + pad] as [number, number];
  }, [data, hasBand]);
  /*
   * Label the last point that actually has a value, not the last row. A series
   * that stops early — actual-to-date against a full-period plan — carries
   * non-finite values for days not yet reached, and labelling those prints
   * "NaN" at the right edge of the chart.
   */
  const lastIndex = (() => {
    for (let i = data.length - 1; i >= 0; i--) {
      if (Number.isFinite(data[i]?.value)) return i;
    }
    return -1;
  })();
  const last = lastIndex >= 0 ? data[lastIndex] : undefined;

  /*
   * Two points joined by a line invite the eye to read a trend that isn't
   * there. Doc 04's rule applies most sharply to this chart type, because it is
   * the one whose whole visual grammar means "direction over time".
   */
  if (isSparse(data.length)) {
    return (
      <SparseFigures
        points={data.map((d) => ({ label: d.label, value: d.value, secondary: d.secondaryValue }))}
        valueFormatter={valueFormatter}
        secondaryLabel={secondarySeriesLabel ?? "Plan"}
      />
    );
  }

  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} /* Right margin holds the direct end-label. 32px clipped a four-digit
         figure with a nb-NO thousands space ("1 330"); never clip a label. */
      margin={{ top: 8, right: 54, bottom: 0, left: 0 }}>
        {/* Solid, horizontal only. Dashing is reserved for the plan series and
            threshold lines — on the grid it reads as "projection" and adds noise. */}
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        {/*
          * A visible y-axis, not a hidden one. With it hidden the domain defaults
          * to [0, max] and a series that varies between 2 300 and 2 900 collapses
          * into the top tenth of the plot, which reads as "nothing is happening".
          * Four ticks and a padded domain make the variation legible — and because
          * the axis is labelled, the truncated baseline is honest rather than
          * misleading. (Bars still start at zero, always.)
          */}
        <YAxis
          width={46}
          tickCount={4}
          domain={bandDomain ?? PADDED_DOMAIN}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => valueFormatter(Math.round(v))}
        />
        {/* The band sits behind everything — it is context, not a series. */}
        {hasBand && (
          <Area
            dataKey="band"
            stroke="none"
            fill="var(--muted-foreground)"
            fillOpacity={0.14}
            activeDot={false}
            tooltipType="none"
          />
        )}
        <Tooltip
          formatter={((value: number) => valueFormatter(value)) as (value: unknown) => React.ReactNode}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        {reference && (
          <ReferenceLine
            y={reference.value}
            stroke="var(--warning)"
            strokeDasharray="4 4"
            label={{ value: reference.label, position: "insideTopRight", fontSize: 11, fill: "var(--warning)" }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          name={seriesName}
          stroke={SERIES_COLOR.primary}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4 }}
          label={last ? renderLastPointLabel(lastIndex, last.value, valueFormatter) : undefined}
        />
        {secondarySeriesLabel && showSecondary && (
          <Line type="monotone" dataKey="secondaryValue" name={secondarySeriesLabel} stroke={SERIES_COLOR.secondary} strokeWidth={2} strokeDasharray="4 3" dot={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    {/* Series keys in text. An unlabelled grey stripe is a mystery, and doc 04
        requires series to be distinguishable without relying on colour. */}
    {(bandLabel || secondarySeriesLabel) && (
      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        {bandLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[2px] bg-[var(--muted-foreground)]/25" aria-hidden />
            {bandLabel}
          </span>
        )}
        {secondarySeriesLabel && (
          <button
            type="button"
            onClick={() => setShowSecondary((v) => !v)}
            aria-pressed={showSecondary}
            /* The label says what clicking does, so the state is never carried
               by opacity alone (WCAG 1.4.1). */
            title={showSecondary ? `Skjul ${secondarySeriesLabel.toLowerCase()}` : `Vis ${secondarySeriesLabel.toLowerCase()}`}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded text-left transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6 ${
              showSecondary ? "" : "text-muted-foreground line-through"
            }`}
          >
            <span
              className={`h-px w-3.5 border-t-2 border-dashed ${
                showSecondary ? "border-[var(--chart-5)]" : "border-muted-foreground/40"
              }`}
              aria-hidden
            />
            {secondarySeriesLabel}
          </button>
        )}
      </p>
    )}
    </div>
  );
}
