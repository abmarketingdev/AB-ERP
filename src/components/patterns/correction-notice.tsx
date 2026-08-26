"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Info, X } from "lucide-react";
import type { CorrectionNotice as Notice } from "@/types/promoter";

const DISMISSED_KEY = "ab-erp-dismissed-corrections";

/**
 * Dismissals live in localStorage, which React cannot read during a server
 * render. useSyncExternalStore is the tool for exactly this: it takes a separate
 * server snapshot, so the markup matches on hydration without a setState-in-effect
 * round trip.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab dismissing a notice should update this one too.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Must return a referentially stable value, so the raw string is the snapshot. */
function getSnapshot() {
  return window.localStorage.getItem(DISMISSED_KEY) ?? "[]";
}

function getServerSnapshot() {
  return "[]";
}

function dismissNotice(id: string) {
  let current: string[] = [];
  try {
    current = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    current = [];
  }
  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, id]));
  // The storage event does not fire in the tab that wrote it.
  listeners.forEach((l) => l());
}

/**
 * A figure changed after the fact, and the person looking at it deserves to know.
 *
 * Inline and persistent — not a toast, not a notifications tab. It never
 * auto-dismisses, and dismissal is per correction rather than global, so a later
 * correction still surfaces.
 */
export function CorrectionNotice({ notices }: { notices: Notice[] }) {
  const raw = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismissed = React.useMemo<string[]>(() => {
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }, [raw]);

  const visible = notices.filter((n) => !dismissed.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {visible.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="flex items-start gap-3 rounded-lg border-l-2 border-l-[var(--ab-accent-9)] bg-[var(--ab-accent-3)]/40 px-4 py-3"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-[var(--ab-accent-11)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{n.summary}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                Korrigert {n.at}
                {typeof n.delta === "number" && n.delta !== 0
                  ? ` · ${n.delta > 0 ? "+" : ""}${n.delta}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismissNotice(n.id)}
              aria-label="Skjul denne korrigeringen"
              className="flex min-h-11 min-w-11 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6 sm:min-w-6"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
