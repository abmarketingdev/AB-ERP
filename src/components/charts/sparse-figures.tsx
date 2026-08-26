import * as React from "react";
import { formatNumber } from "@/lib/format";

/**
 * Doc 04: "A chart with fewer than three points renders as a figure, not a
 * chart."
 *
 * The rule is about honesty, not tidiness. Two points joined by a line invite
 * the eye to read a trend, and two points is not a trend — it is two numbers
 * and a straight line between them that carries no information the numbers
 * don't already give. Axes, gridlines and a plot area around them dress up that
 * emptiness as analysis.
 *
 * Lifted out of `comparison-bar.tsx`, where it lived alone, so the trend line
 * and the distribution bar obey the same rule. One rule implemented in one
 * chart is a coincidence; the reader should not have to know which chart type
 * they happened to land on.
 */
export function SparseFigures({
  points,
  valueFormatter = formatNumber,
  secondaryLabel = "Plan",
}: {
  points: { label: string; value: number; secondary?: number }[];
  valueFormatter?: (v: number) => string;
  secondaryLabel?: string;
}) {
  return (
    <ul className="flex flex-wrap gap-6 py-2">
      {points.map((d) => (
        <li key={d.label}>
          <p className="text-[12px] text-muted-foreground">{d.label}</p>
          <p className="mt-1 font-mono text-[26px] leading-none tabular-nums text-foreground">
            {valueFormatter(d.value)}
          </p>
          {typeof d.secondary === "number" && (
            <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
              {secondaryLabel} {valueFormatter(d.secondary)}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Fewer than three points is the threshold the doc sets. Zero is a different
 *  situation entirely — that is the empty state, and the frame owns it. */
export const isSparse = (n: number) => n > 0 && n < 3;
