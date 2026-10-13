"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/patterns/empty-state";
import type { MascotPose } from "@/components/patterns/mascot";
import { NoAccess } from "@/components/patterns/permission-gate";
import { formatDateTime } from "@/lib/format";
import { AlertCircle, Info, Table as TableIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Shared wrapper for every chart on the platform. Enforces the practices from
 * the "vibecoding dashboards" review: a chart always states its question,
 * always carries period/source/last-updated, and always renders all five
 * states — no chart is ever dropped onto a page as a bare canvas.
 *
 * It also owns the chart's **mount reveal**. Recharts' built-in animation
 * re-runs on every re-render — a filter change, a container resize, a parent
 * state update — which doc 02 forbids outright ("Never re-animate on filter
 * change"). Every wrapper therefore sets `isAnimationActive={false}` and the
 * single 320ms reveal happens here, once, because this frame stays mounted
 * while filters move.
 */
export type ChartState = "loading" | "empty" | "partial" | "error" | "no-access" | "ready";

/** Rows for the table alternative. Doc 02: required for anything a decision depends on. */
export interface ChartTable {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Why the chart has nothing to show. Carbon is the only design system that
 * publishes this taxonomy and it is right: "no data yet" on a first run, "your
 * filter excluded everything", and "we could not fetch it" want three different
 * sentences and three different next steps. One generic string leads people
 * into a dead end.
 */
export type EmptyCause = "no-data-yet" | "filtered-out" | "not-configured";

const EMPTY_COPY: Record<
  EmptyCause,
  { title: string; description: string; pose: MascotPose }
> = {
  /*
   * The pose carries the same distinction the copy does. All three used to
   * share one image, which quietly undid the point of having three causes:
   * "nothing has happened yet", "you filtered it away" and "nobody has decided
   * this yet" are three different problems with three different next steps.
   */
  "no-data-yet": {
    title: "Ingen data ennå",
    description: "Tallene kommer når perioden har registrerte dager.",
    pose: "cloudwatching", // waiting on the world, nothing to do
  },
  "filtered-out": {
    title: "Ingen data for dette utvalget",
    description: "Prøv en annen periode, kampanje eller person.",
    pose: "research-development", // the reader can search their way out
  },
  "not-configured": {
    title: "Ikke satt opp ennå",
    description: "Definisjonen bak dette tallet er ikke avklart.",
    pose: "light-work", // "tomt skjema" — someone has to fill this in
  },
};

interface ChartFrameProps {
  /** The question this chart answers — not a decorative title. */
  question: string;
  description?: string;
  period: string;
  source: string;
  lastUpdated: Date | string;
  /** Reachable from the chart itself, per FR-Q-02 / FR-C-05. */
  definition?: string;
  state: ChartState;
  partialNote?: string;
  errorMessage?: string;
  emptyCause?: EmptyCause;
  /**
   * Overrides for the taxonomy copy, for the cases where the screen knows
   * something more specific than the category does — "one place is selected"
   * beats "no data for this selection" every time.
   */
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * The same figures as a table. Doc 02: "a visually-hidden table alternative
   * for anything a decision depends on". Rendered behind a disclosure rather
   * than `sr-only`, because a table only a screen reader can reach is useless
   * to a sighted reader who simply wants the numbers — and the accessibility
   * literature is explicit that a hidden table alone is not a sufficient
   * alternative either.
   */
  table?: ChartTable;
  /** One sentence naming what the chart shows and what it says. */
  summary?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

/** One reveal, on mount only. Never re-runs while the frame stays mounted. */
function ChartReveal({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="space-y-2"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function ChartFrame({
  question,
  description,
  period,
  source,
  lastUpdated,
  definition,
  state,
  partialNote,
  errorMessage,
  emptyCause = "filtered-out",
  emptyTitle,
  emptyDescription,
  table,
  summary,
  onRetry,
  children,
}: ChartFrameProps) {
  const tableId = React.useId();
  const [tableOpen, setTableOpen] = React.useState(false);
  const fallback = EMPTY_COPY[emptyCause];
  const empty = {
    title: emptyTitle ?? fallback.title,
    description: emptyDescription ?? fallback.description,
    pose: fallback.pose,
  };

  return (
    <Card aria-busy={state === "loading"}>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium text-foreground">{question}</CardTitle>
          {definition && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Definisjon">
                  <Info className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{definition}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {/* Provenance is quieter than the question by size, not by fading the
            token below its contrast floor: `muted-foreground/80` measured 3.9:1
            against the card, and this is the line that says which period the
            chart is about. */}
        <p className="text-[11px] text-muted-foreground">
          {period} · {source} · Oppdatert {formatDateTime(lastUpdated)}
        </p>
      </CardHeader>
      <CardContent>
        {/* Chart-shaped, not a solid block: the frame, question and footer are
            already rendered above, so only the plot area is unknown. Gridlines
            are drawn but no axis labels — an axis labelled 0–100 over an empty
            plot is a claim about a range nobody has measured yet. */}
        {state === "loading" && (
          <div className="relative h-56 w-full overflow-hidden rounded-md bg-secondary/20" role="presentation">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="absolute inset-x-0 h-px bg-border"
                style={{ top: `${12 + i * 25}%` }}
              />
            ))}
          </div>
        )}
        {state === "no-access" && <NoAccess />}
        {state === "error" && (
          <div className="flex h-56 flex-col items-center justify-center gap-2.5 text-center" role="alert">
            <AlertCircle className="size-6 text-danger" aria-hidden />
            <p className="text-sm text-muted-foreground">
              {errorMessage ?? "Kunne ikke hente tallene."}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="min-h-11 rounded-lg border border-border px-3.5 text-[13px] text-foreground transition-colors hover:border-[var(--ab-accent-9)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6 sm:py-1.5"
              >
                Prøv igjen
              </button>
            )}
          </div>
        )}
        {state === "empty" && (
          <EmptyState title={empty.title} description={empty.description} pose={empty.pose} />
        )}
        {(state === "ready" || state === "partial") && (
          <ChartReveal>
            {state === "partial" && (
              <p className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning-on-tint">
                {partialNote ?? "Deler av perioden mangler fortsatt godkjente data."}
              </p>
            )}
            <div role="img" aria-label={summary ?? question}>
              {children}
            </div>

            {/* The numbers, reachable without reading the picture. */}
            {table && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setTableOpen((v) => !v)}
                  aria-expanded={tableOpen}
                  aria-controls={`${tableId}-table`}
                  /* A disclosure toggle does nothing on paper. The table it
                     reveals still prints if the reader opened it first. */
                  data-print-hide
                  className="inline-flex min-h-11 items-center gap-1.5 rounded text-[12.5px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-6"
                >
                  <TableIcon className="size-3.5" aria-hidden />
                  {tableOpen ? "Skjul tabell" : "Vis tabell"}
                </button>
                <div id={`${tableId}-table`} hidden={!tableOpen} className="mt-2 overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <caption className="sr-only">{table.caption}</caption>
                    <thead>
                      <tr className="border-b border-border">
                        {table.columns.map((c) => (
                          <th key={c} scope="col" className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((r, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          {r.map((cell, j) => (
                            <td
                              key={j}
                              className={`px-2 py-1.5 ${j === 0 ? "text-foreground" : "font-mono tabular-nums text-foreground"}`}
                              {...(j === 0 ? { scope: "row" as const } : {})}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ChartReveal>
        )}
      </CardContent>
    </Card>
  );
}
