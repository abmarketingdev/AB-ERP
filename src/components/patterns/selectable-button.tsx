"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A button that is ON or OFF — a time slot, a filter chip, a channel to publish to
 * (08-DESIGN-REVIEW round 1: «a clear selected state»). Selected is shown three ways at
 * once so it never depends on colour alone (WCAG 1.4.1): an accent border, a ✓, and
 * aria-pressed for assistive tech. Same look in light and dark.
 *
 *     <SelectableButton selected={slot === s} onClick={() => setSlot(s)}>kl. 10:00</SelectableButton>
 *
 * For "pick exactly one" groups, wrap them in role="radiogroup" and pass role="radio" —
 * aria-checked is then set instead of aria-pressed.
 */
export function SelectableButton({
  selected,
  className,
  children,
  role,
  ...props
}: React.ComponentProps<"button"> & { selected: boolean }) {
  const state = role === "radio" ? { "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button
      type="button"
      role={role}
      {...state}
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors sm:min-h-9",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-45",
        selected
          ? "border-[var(--ab-accent-9)] bg-[var(--ab-accent-9)]/10 font-medium text-foreground ring-1 ring-inset ring-[var(--ab-accent-9)] dark:border-foreground dark:bg-foreground/10 dark:ring-foreground"
          : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-muted",
        className,
      )}
    >
      {selected && <Check className="size-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}
