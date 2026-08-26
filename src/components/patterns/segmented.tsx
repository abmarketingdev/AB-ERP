"use client";

import * as React from "react";
import { motion } from "motion/react";

/**
 * Compact period switch. The moving indicator is a shared layoutId, so switching
 * reads as one control changing state rather than two things blinking.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  layoutId: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary/50 p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative min-h-11 rounded-[6px] px-2.5 py-1 text-[12px] transition-colors sm:min-h-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[6px] bg-[var(--ab-accent-9)]/15 ring-1 ring-[var(--ab-accent-9)]/30"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
