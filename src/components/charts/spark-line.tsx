import * as React from "react";

/**
 * Tufte's word-sized graphic: no axes, no gridlines, no interaction, no dots
 * except the endpoint. Deliberately hand-rolled SVG rather than a Recharts
 * wrapper — a sparkline has none of the chrome a chart library exists to provide,
 * and this renders in a fraction of the cost inside a table row.
 */
export function SparkLine({
  points,
  width = 96,
  height = 28,
  className,
  ariaLabel,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  if (!points || points.length < 2) {
    // Fewer than two points is not a trend. Render nothing rather than a lie.
    return null;
  }

  const pad = 3;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel ?? `Trend, ${points.length} punkter`}
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      {/* Emphasised endpoint — the only mark that earns a dot. */}
      <circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" />
    </svg>
  );
}
