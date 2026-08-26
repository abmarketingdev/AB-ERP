"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatNumber } from "@/lib/format";
import { DUR, EASE_ENTER } from "@/lib/motion";

/**
 * Stephen Few's bullet graph, including the projection he describes under
 * "Optional Features" — a lighter continuation of the bar showing where the
 * current rate lands you at period end, with the target marker beyond it.
 *
 * Few designed this to replace dashboard gauges, and the parts are his:
 * a quantitative scale, a featured measure at roughly a third of the container
 * thickness, comparative measures drawn as perpendicular ticks, and qualitative
 * range bands behind it all.
 *
 * The rule that matters most here is his colour rule: **the bands are
 * intensities of one hue, not distinct hues**, so the chart survives colour
 * blindness and a greyscale printout. Which also means the featured measure
 * keeps one colour whatever the state — being behind pace is not an error, and
 * a bar that turns red on day 12 of 31 says otherwise.
 *
 * **Deviation from doc 04, on purpose.** The doc lists `ProgressArc` as one of
 * its six chart types and puts it on the leader forside for "will we hit the
 * month?". This component stands in for it everywhere, and `ProgressArc` is not
 * built at all. An arc shows one number against one target; the question on
 * that screen needs three more — where a steady pace should have us today,
 * where today's rate lands us at month end, and the target itself. Few designed
 * the bullet graph to carry exactly those, and it stacks: eight of them compare
 * down a column, where eight arcs cannot be compared at all.
 */
export function BulletBar({
  current,
  target,
  expected,
  projected,
  unit,
  label,
}: {
  current: number;
  target: number;
  expected: number;
  projected: number;
  unit: string;
  label: string;
}) {
  const reduced = useReducedMotion();

  // The scale must contain every mark, including a projection that overshoots.
  const scaleMax = Math.max(target, projected, current) * 1.04;
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / scaleMax) * 100))}%`;

  // Projection only reads as information when it is ahead of where you already
  // are; behind that it is just the bar again.
  const showProjection = projected > current;

  const summary =
    `${label}: ${formatNumber(current)} av ${formatNumber(target)} ${unit}. ` +
    `Forventet nå ${formatNumber(expected)}. ` +
    `Ved dagens takt ender perioden på omtrent ${formatNumber(projected)}.`;

  return (
    <figure className="m-0">
      <div className="relative h-[30px] w-full" role="img" aria-label={summary}>
        {/* Qualitative ranges — one hue, two intensities, stronger where you
            should already have been. Kept deliberately faint: this palette is
            near-achromatic by design, so the featured measure cannot separate
            from the bands by hue and has to do it by lightness and texture. */}
        <div className="absolute inset-0 overflow-hidden rounded-md bg-secondary/25">
          <div className="absolute inset-y-0 left-0 bg-secondary/60" style={{ width: pos(expected) }} />
        </div>

        {/* The projection is hatched, not merely faded. A solid bar at low
            opacity reads as a measurement taken in poor light; a hatched one
            reads as an estimate, which is what it is. */}
        {showProjection && (
          <motion.div
            className="absolute top-1/2 left-0 h-[10px] -translate-y-1/2 rounded-[3px]"
            style={{
              backgroundColor: "color-mix(in oklab, var(--ab-accent-9) 16%, transparent)",
              backgroundImage:
                "repeating-linear-gradient(135deg, color-mix(in oklab, var(--ab-accent-9) 60%, transparent) 0 2px, transparent 2px 5px)",
            }}
            initial={reduced ? false : { width: 0 }}
            animate={{ width: pos(projected) }}
            transition={{ duration: DUR.slow, ease: EASE_ENTER }}
          />
        )}
        <motion.div
          className="absolute top-1/2 left-0 h-[10px] -translate-y-1/2 rounded-[3px] bg-[var(--ab-accent-9)]"
          initial={reduced ? false : { width: 0 }}
          animate={{ width: pos(current) }}
          transition={{ duration: DUR.slow, ease: EASE_ENTER }}
        />

        {/* Comparative measures. Expected is the pace tick; target closes the scale. */}
        <div
          className="absolute top-1/2 h-[20px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/75"
          style={{ left: pos(expected) }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-[26px] w-[2.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
          style={{ left: pos(target) }}
          aria-hidden
        />
      </div>

      {/* The scale label sits under its own tick, not at the container edge —
          the axis runs slightly past the target so the marker is not clipped,
          and a label parked at the end would name the wrong position. */}
      <div className="relative mt-2 h-3.5 font-mono text-[10px] tabular-nums text-muted-foreground">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pos(target) }}>
          {formatNumber(target)}
        </span>
      </div>

      <figcaption className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground">
        <Key swatch={<span className="h-[9px] w-3.5 rounded-[2px] bg-[var(--ab-accent-9)]" />}>
          Faktisk <Val>{formatNumber(current)}</Val>
        </Key>
        {showProjection && (
          <Key
            swatch={
              <span
                className="h-[9px] w-3.5 rounded-[2px]"
                style={{
                  backgroundColor: "color-mix(in oklab, var(--ab-accent-9) 16%, transparent)",
                  backgroundImage:
                    "repeating-linear-gradient(135deg, color-mix(in oklab, var(--ab-accent-9) 60%, transparent) 0 2px, transparent 2px 5px)",
                }}
              />
            }
          >
            Anslag ved dagens takt <Val>{formatNumber(projected)}</Val>
          </Key>
        )}
        <Key swatch={<span className="h-3.5 w-[2px] rounded-full bg-foreground/75" />}>
          Forventet nå <Val>{formatNumber(expected)}</Val>
        </Key>
        <Key swatch={<span className="h-3.5 w-[2.5px] rounded-full bg-foreground" />}>
          Mål <Val>{formatNumber(target)}</Val>
        </Key>
      </figcaption>
    </figure>
  );
}

function Key({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex h-3.5 w-3.5 items-center justify-center" aria-hidden>
        {swatch}
      </span>
      {children}
    </span>
  );
}

function Val({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums text-foreground">{children}</span>;
}
