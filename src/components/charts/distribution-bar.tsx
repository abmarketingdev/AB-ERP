"use client";

import * as React from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell, LabelList } from "recharts";
import { formatNumber } from "@/lib/format";
import { SparseFigures, isSparse } from "./sparse-figures";

/**
 * Doc 04's `DistributionBar` — horizontal, categorical, one bar per category.
 *
 * Named for the doc rather than for its shape, because the file next to it
 * (`comparison-bar.tsx`) is the doc's `ComparisonBar`: vertical, over time,
 * grouped against plan. Two files called comparison-something is how a screen
 * ends up with a time series drawn as a category ranking.
 *
 * Horizontal because category labels are words, and words read horizontally.
 * Cleveland & McGill: position along a common scale is the most accurate
 * judgement available, and every bar here shares one baseline.
 */
export type DistributionStatus = "below" | "on-track" | "above";

const STATUS_COLOR: Record<DistributionStatus, string> = {
  below: "var(--danger)",
  "on-track": "var(--warning)",
  above: "var(--success)",
};

interface DistributionRow {
  label: string;
  value: number;
  status?: DistributionStatus;
}

interface DistributionBarProps {
  data: DistributionRow[];
  valueFormatter?: (v: number) => string;
  height?: number;
  /** Hard cap — beyond this, this is a table, not a chart. Extra rows are
   * summarized rather than crammed in (per the "20-line spaghetti" anti-pattern). */
  maxRows?: number;
  /**
   * Longest-first is right for categories, where the reader's question is
   * "which is biggest" and position carries nothing. It is wrong for time
   * buckets: weeks re-ordered by size hide whether the period was rising or
   * falling, which is information the reader gets free from chronology.
   */
  order?: "by-value" | "as-given";
}

export function DistributionBar({
  data,
  valueFormatter = formatNumber,
  height,
  maxRows = 10,
  order = "by-value",
}: DistributionBarProps) {
  // Memoised: an inline sort is a new array identity every render, and Recharts
  // keys its animation off reference equality — so the chart re-animated on
  // every parent state change.
  const visible = React.useMemo(
    () =>
      (order === "by-value" ? [...data].sort((a, b) => b.value - a.value) : data).slice(0, maxRows),
    [data, maxRows, order],
  );
  const hiddenCount = data.length - visible.length;
  const resolvedHeight = height ?? Math.max(160, visible.length * 34);

  if (isSparse(visible.length)) {
    return <SparseFigures points={visible} valueFormatter={valueFormatter} />;
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={resolvedHeight}>
        <BarChart data={visible} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
            {visible.map((row) => (
              // Keyed by label rather than index — this list is sorted, so an
              // index key makes one person's bar animate into another's slot.
              <Cell key={row.label} fill={row.status ? STATUS_COLOR[row.status] : "var(--chart-1)"} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((v: number) => valueFormatter(v)) as any}
              style={{ fontSize: 12, fontWeight: 600, fill: "var(--foreground)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hiddenCount > 0 && <p className="text-xs text-muted-foreground">+{hiddenCount} flere ikke vist — filtrer for å se alle.</p>}
    </div>
  );
}
