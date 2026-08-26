"use client";

import { BulletBar } from "@/components/charts/bullet-bar";
import { formatNumber } from "@/lib/format";
import { goalMath, GOAL_STATE_LABEL } from "@/lib/goal";
import type { GoalCard as GoalCardData } from "@/types/promoter";

/**
 * FR-P-07 / FR-L-13 — the compact goal read, for dashboards and side columns.
 *
 * Same bullet graph and same vocabulary as the full card on Mål, so a reader
 * never re-learns which mark is which between screens.
 *
 * Two things this used to do and no longer does: it filled the bar with
 * `bg-danger` when behind plan, and chipped it "Bak plan" in red. Being some
 * units under expected partway through a period is not an error state, and
 * painting it as one is a judgement the data does not support. Per Few, the
 * featured measure keeps one colour; the pace tick and the sentence carry the
 * comparison.
 */
export function GoalCard({ goal, subject }: { goal: GoalCardData; subject?: string }) {
  const m = goalMath(goal);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 px-5 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">{goal.label}</p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-[34px] leading-none tabular-nums text-foreground">
                {formatNumber(goal.current)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                av {formatNumber(goal.target)} {goal.unit}
              </span>
            </p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
            {GOAL_STATE_LABEL[m.state]}
          </span>
        </div>

        <BulletBar
          label={goal.label}
          current={goal.current}
          target={goal.target}
          expected={m.expected}
          projected={m.projected}
          unit={goal.unit}
        />

        <p className="text-[12.5px] text-muted-foreground">
          {m.complete ? (
            <>Målet for {goal.period.toLowerCase()} er nådd.</>
          ) : (
            <>
              <span className="font-mono tabular-nums text-foreground">
                {formatNumber(m.remaining)}
              </span>{" "}
              {goal.unit} igjen på{" "}
              <span className="font-mono tabular-nums text-foreground">{goal.daysRemaining}</span>{" "}
              arbeidsdager — {formatNumber(m.perDay)} per dag.
            </>
          )}
        </p>
      </div>

      <p className="mt-4 border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground">
        {subject ? `${subject} · ` : ""}
        {goal.period} · satt av {goal.setBy}
      </p>
    </div>
  );
}
