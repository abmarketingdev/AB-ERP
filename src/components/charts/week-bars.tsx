"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { WeekDay } from "@/types/promoter";
import { formatNumber } from "@/lib/format";
import { DUR } from "@/lib/motion";

/**
 * The week at a glance (FR-P-06): doors and yes per day, today marked.
 *
 * Bars grow from a zero baseline on mount — a truncated baseline would
 * exaggerate, and these figures affect people's reviews. Days with no data show
 * the track only, so "not worked yet" never reads as "worked and got zero".
 */
export function WeekBars({ days }: { days: WeekDay[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(...days.map((d) => d.doors), 1);

  return (
    <div className="flex items-end gap-1.5 sm:gap-3">
      {days.map((d, i) => {
        const pct = (d.doors / max) * 100;
        const worked = d.doors > 0;
        return (
          <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span
              className={`font-mono text-[11px] tabular-nums ${
                d.isToday ? "text-[var(--ab-accent-11)]" : worked ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {worked ? formatNumber(d.doors) : "—"}
            </span>

            {/* No track behind the bars. A container rectangle is pure chrome —
                the bar and its zero baseline carry the whole reading, and empty
                boxes on unworked days read as "broken" rather than "not yet". */}
            <div className="relative flex h-28 w-full items-end justify-center">
              {worked && (
                <motion.div
                  className={`w-full rounded-t-[3px] ${
                    d.isToday ? "bg-[var(--ab-accent-9)]" : "bg-[var(--ab-accent-9)]/28"
                  }`}
                  initial={reduced ? false : { height: 0 }}
                  animate={{ height: `${Math.max(pct, 6)}%` }}
                  transition={{
                    duration: DUR.slow,
                    delay: reduced ? 0 : 0.04 * i,
                    ease: [0.05, 0.7, 0.1, 1],
                  }}
                />
              )}
              {/* Zero baseline — bars are visibly measured from it, never truncated. */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <span
                className={`text-[11px] ${d.isToday ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {d.day.slice(0, 3)}
              </span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {worked ? `${d.yes} ja` : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
