"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_MOTION, MATCH_BY_LABEL } from "./chart-motion";
import { formatNumber } from "@/lib/format";

/**
 * Composition over time — the sixth wrapper doc 04 names, and the one that was
 * missing.
 *
 * Two rules it enforces rather than leaves to the caller:
 *
 * **Bars start at zero, always.** A truncated baseline on a bar is a lie, because
 * a bar encodes quantity by area — halve the axis and you double the apparent
 * difference. (Line charts may truncate, and TrendLine does, because a line
 * encodes position rather than area. That asymmetry is Cleveland & McGill's,
 * not a preference.)
 *
 * **Segments separate by lightness, not hue.** The palette here is deliberately
 * near-achromatic, so a legend keyed on colour would be unreadable in greyscale
 * and for a colour-blind reader alike. Segments step down a lightness ramp and
 * the key is text.
 *
 * Five steps is the hard ceiling and it is not a stylistic preference:
 * ColorBrewer rates greys as screen-safe at three classes and only "maybe" at
 * four, and Datawrapper puts it plainly — readers give up somewhere around four
 * to six shades of one colour. A stack tolerates more than a line chart does,
 * because adjacent segments only ever touch their own neighbours, but past five
 * the tail is folded into "Annet" rather than silently recycling the ramp.
 */
export interface StackSegment {
  key: string;
  value: number;
}

export interface StackedBarProps {
  data: { label: string; segments: StackSegment[] }[];
  /** Segment keys in draw order, bottom first. */
  keys: string[];
  height?: number;
  valueFormatter?: (v: number) => string;
  /** Rendered as a text key beneath the chart. */
  showKey?: boolean;
}

/** Lightness ramp, darkest at the bottom of the stack. Five steps is the limit. */
const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const MAX_SEGMENTS = 5;

export function StackedBar({
  data,
  keys: rawKeys,
  height = 220,
  valueFormatter = formatNumber,
  showKey = true,
}: StackedBarProps) {

  /*
   * Past five segments the ramp would wrap and two different categories would
   * share a shade — which is worse than not showing them separately at all.
   * The tail is summed into one honest bucket instead.
   */
  const OTHER = "Annet";
  const keys = React.useMemo(
    () => (rawKeys.length > MAX_SEGMENTS ? [...rawKeys.slice(0, MAX_SEGMENTS - 1), OTHER] : rawKeys),
    [rawKeys],
  );

  // Recharts wants one flat object per row; the caller thinks in segments.
  const rows = React.useMemo(
    () =>
      data.map((d) => {
        const row: Record<string, string | number> = { label: d.label };
        for (const k of keys) {
          row[k] =
            k === OTHER && rawKeys.length > MAX_SEGMENTS
              ? rawKeys
                  .slice(MAX_SEGMENTS - 1)
                  .reduce((n, tail) => n + (d.segments.find((s) => s.key === tail)?.value ?? 0), 0)
              : (d.segments.find((s) => s.key === k)?.value ?? 0);
        }
        return row;
      }),
    [data, keys, rawKeys],
  );

  if (data.length === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          {/* Zero-based, non-negotiable for bars. */}
          <YAxis
            width={40}
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
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={k}
              stackId="a"
              fill={RAMP[i % RAMP.length]}
              // Mount once at doc 02's 320ms; never re-animate on filter change.
              {...CHART_MOTION}
              animationMatchBy={MATCH_BY_LABEL}
              // A hairline of the card colour between segments does the
              // separating that colour cannot in a near-achromatic ramp.
              stroke="var(--card)"
              strokeWidth={2}
              radius={i === keys.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {showKey && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {keys.map((k, i) => (
            <li key={k} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span
                className="h-2.5 w-3.5 rounded-[2px]"
                style={{ background: RAMP[i % RAMP.length] }}
                aria-hidden
              />
              {k}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
