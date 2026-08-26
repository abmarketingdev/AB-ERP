"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { DUR, EASE_ENTER } from "@/lib/motion";

/**
 * Inline area sparkline for KPI cards: gradient wash, 2px line, emphasised
 * endpoint. No axes, no gridlines, no tooltip — the number above it is the value,
 * this only carries shape.
 *
 * The draw animation runs ONCE on mount. That distinction matters: an infinite
 * stroke animation measured ~83ms/frame on the login background, but a one-shot
 * draw on a 40px-tall element is free and it is what makes the card feel alive
 * instead of printed.
 */
export function AreaSpark({
  points,
  width = 132,
  height = 44,
  tone = "var(--ab-accent-10)",
  id,
  ariaLabel,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  tone?: string;
  id: string;
  ariaLabel?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (!points || points.length < 2) return null;

  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);

  const pts = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${height} L${pts[0][0].toFixed(1)} ${height} Z`;
  const [lastX, lastY] = pts[pts.length - 1];

  const gradientId = `spark-grad-${id}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel ?? `Trend over ${points.length} perioder`}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.28} />
          <stop offset="100%" stopColor={tone} stopOpacity={0} />
        </linearGradient>
      </defs>

      <motion.path
        d={area}
        fill={`url(#${gradientId})`}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DUR.base, delay: 0.18, ease: EASE_ENTER }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={tone}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: DUR.slow, ease: EASE_ENTER }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={2.75}
        fill={tone}
        initial={reduced ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.5, ease: [0.05, 0.7, 0.1, 1] }}
        style={{ transformOrigin: `${lastX}px ${lastY}px` }}
      />
    </svg>
  );
}
