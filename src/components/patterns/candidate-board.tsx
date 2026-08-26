"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, FileText } from "lucide-react";
import { CONTRACT_LABEL } from "@/lib/recruitment";
import { riseIn } from "@/lib/motion";
import type { Candidate, RecruitmentStage } from "@/types/recruitment";

/**
 * FR-R-05 — candidates grouped by stage.
 *
 * A board, not a Kanban: the columns are **read-only groupings**, and there is
 * deliberately no drag-and-drop. FR-R-02 requires the stage to be set
 * explicitly, and advancing a candidate opens a form that captures the fields
 * that stage requires — an interview date, who screened them, the terms
 * offered. Dragging a card would either discard that or pop a dialog on drop,
 * which is a worse version of clicking the card.
 *
 * It also keeps the interaction reachable: drag-and-drop needs a keyboard
 * equivalent to be usable at all, and the equivalent would be… clicking through
 * to the candidate. So that is the only path.
 *
 * Terminal stages sit at the end and are visually quieter — a hired or closed
 * candidate is a record, not a piece of work in progress.
 */
export function CandidateBoard({
  stages,
  candidates,
}: {
  stages: RecruitmentStage[];
  candidates: Candidate[];
}) {
  const reduced = useReducedMotion();

  const byStage = React.useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const s of stages) map.set(s.id, []);
    for (const c of candidates) map.get(c.stageId)?.push(c);
    return map;
  }, [stages, candidates]);

  return (
    /*
     * `min-w-0` is what actually contains the scroll. A flex child's default
     * `min-width: auto` lets it grow to its content, so `overflow-x-auto` alone
     * stretched the page instead of scrolling inside the board — seven 260px
     * columns pushed the whole layout sideways at desktop width.
     */
    <div className="w-full min-w-0 overflow-x-auto pb-2">
      <ul className="flex min-w-max gap-3">
        {stages.map((stage, si) => {
          const items = byStage.get(stage.id) ?? [];
          const terminal = Boolean(stage.terminal);
          return (
            <li key={stage.id} className="w-[260px] shrink-0">
              <div
                className={`flex h-full flex-col rounded-xl border border-border ${
                  terminal ? "bg-card/40" : "bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
                  <p
                    className={`truncate text-[13px] ${terminal ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    {stage.label}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">
                    Ingen her nå
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 p-2">
                    {items.map((c, i) => (
                      <motion.li key={c.id} {...riseIn(si + i, reduced)}>
                        <Link
                          href={`/rekruttering/kandidater/${c.id}`}
                          className="block rounded-lg border border-border px-3 py-2.5 transition-colors duration-[120ms] hover:border-[var(--ab-accent-9)]/45 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="truncate text-[13px] text-foreground">{c.name}</p>
                          <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                            {c.campaign} · {c.owner.split(" ")[0]}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {/* FR-R-07 — contract state travels with the card. */}
                            <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
                              <FileText className="size-2.5" aria-hidden />
                              {CONTRACT_LABEL[c.contract]}
                            </span>
                            {/* FR-R-06 — an overdue next activity is the whole
                                reason to look at a board rather than a list. */}
                            {c.nextActivity?.overdue && (
                              <span className="inline-flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-danger">
                                <AlertTriangle className="size-2.5" aria-hidden />
                                Forsinket
                              </span>
                            )}
                            {/* FR-R-08 — onboarding progress, once it exists. */}
                            {c.onboarding.length > 0 && (
                              <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
                                Onboarding {c.onboarding.filter((t) => t.done).length}/
                                {c.onboarding.length}
                              </span>
                            )}
                          </div>
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
