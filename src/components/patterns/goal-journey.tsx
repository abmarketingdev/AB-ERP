"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BulletBar } from "@/components/charts/bullet-bar";
import { Mascot } from "@/components/patterns/mascot";
import { formatNumber } from "@/lib/format";
import { goalMath, GOAL_STATE_LABEL } from "@/lib/goal";
import type { GoalCard as GoalCardData } from "@/types/promoter";

/**
 * FR-P-07 — own goal, period, current value and expected progression.
 *
 * This replaced an earlier "journey" that drew the month as a track with
 * quarter milestones and Røy walking along it. Three things were wrong with it,
 * and they are worth writing down so nobody rebuilds them:
 *
 *  1. **Røy's position was the shortfall.** He was placed at `left: pct%`, so
 *     someone behind pace got a cartoon fox standing visibly behind the marker
 *     that judged them. Rickenberg & Reeves (2000) measured people working
 *     while an on-screen character watched: higher anxiety, lower performance.
 *     He now sits in the corner and holds still; his position encodes nothing.
 *
 *  2. **He celebrated from 25 % onward.** A reward that fires on a schedule for
 *     merely continuing is completion-contingent, which is the exact mechanism
 *     Deci, Koestner & Ryan's 128-experiment meta-analysis found *undermines*
 *     intrinsic motivation. He is neutral now, and reacts once, at target.
 *
 *  3. **The milestones marked nothing.** 25/50/75 with a check and a flag are
 *     achievement dots for arbitrary fractions of a bar. Gone; the bullet
 *     graph's plain scale says the same thing without the applause.
 *
 * What replaces them is Few's projection: where today's rate lands you at
 * period end. That is the only element on the screen that answers "what does it
 * take from here" instead of "how am I doing".
 */
export function GoalJourney({ goal, subject }: { goal: GoalCardData; subject?: string }) {
  const m = goalMath(goal);

  /*
   * One reaction, at the finish, and nothing before it — and the finish gets
   * the top register.
   *
   * `win-big` is reserved for exactly this: a person reaching a target that is
   * their own, measured against themselves, at most once a month. That is the
   * one place Self-Determination Theory says acknowledgement is safe —
   * informational feedback on self-referenced mastery, not a comparison to
   * anyone. Everything smaller in this product settles for `win-small`, which
   * is what keeps this one meaning anything.
   */
  const mascotState = m.complete ? "win-big" : "ready";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-6 px-5 pb-5 pt-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">{goal.label}</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-mono text-[44px] leading-none tracking-tight tabular-nums text-foreground">
                {formatNumber(goal.current)}
              </span>
              <span className="text-[14px] text-muted-foreground">
                av {formatNumber(goal.target)} {goal.unit}
              </span>
            </p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {GOAL_STATE_LABEL[m.state]} ·{" "}
              <span className="font-mono tabular-nums">
                {goal.daysRemaining} arbeidsdager igjen
              </span>
            </p>
          </div>

          {/* Røy has a desk of his own: fixed corner, no reaction to the figure
              beside him. Swartz's remedy for the Clippy problem, applied. */}
          <Mascot state={mascotState} size={56} className="shrink-0" />
        </div>

        <BulletBar
          label={goal.label}
          current={goal.current}
          target={goal.target}
          expected={m.expected}
          projected={m.projected}
          unit={goal.unit}
        />

        {/* What it means, in sentences. No colour carries meaning here — the
            signed number and the words do, so being behind never turns red. */}
        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <p className="text-[13.5px] text-foreground">
            {m.complete ? (
              <>Målet for {goal.period.toLowerCase()} er nådd.</>
            ) : (
              <>
                <span className="font-mono tabular-nums">{formatNumber(m.remaining)}</span> {goal.unit}{" "}
                igjen — <span className="font-mono tabular-nums">{formatNumber(m.perDay)}</span> per
                gjenstående arbeidsdag.
              </>
            )}
          </p>
          <p className="text-[13px] text-muted-foreground">
            Forventet nå{" "}
            <span className="font-mono tabular-nums text-foreground">
              {formatNumber(m.expected)}
            </span>
            . Du ligger{" "}
            <span className="font-mono tabular-nums text-foreground">
              {formatNumber(Math.abs(m.diff))}
            </span>{" "}
            {m.diff < 0 ? "under" : m.diff > 0 ? "over" : "på"} forventet takt.
          </p>
          {m.projected < goal.target && (
            <p className="text-[13px] text-muted-foreground">
              Holder takten seg, ender perioden på omtrent{" "}
              <span className="font-mono tabular-nums text-foreground">
                {formatNumber(m.projected)}
              </span>
              .
            </p>
          )}
        </div>

        {/* Provenance. Someone set this number, for a reason, and there is a way
            to ask about it — §9-2 transparency and goal-commitment in one line. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-border bg-secondary/30 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          <span>
            Målet er satt av <span className="text-foreground">{goal.setBy}</span> for{" "}
            {goal.period}.
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded text-[12.5px] text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
              >
                <Info className="size-3.5" aria-hidden />
                Hva betyr dette?
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 text-[12.5px] leading-relaxed">
              <p className="text-foreground">Slik regnes tallene</p>
              <dl className="mt-2.5 space-y-2 text-muted-foreground">
                <div>
                  <dt className="text-foreground">Forventet takt</dt>
                  <dd>
                    Målet fordelt jevnt over {formatNumber(m.effectiveTotal)} arbeidsdager.{" "}
                    {goal.absenceDays > 0
                      ? `${goal.absenceDays} fraværsdager er trukket fra, så fravær teller ikke som svak innsats.`
                      : "Ingen fraværsdager er registrert i perioden."}
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground">Anslag</dt>
                  <dd>
                    Snittet ditt hittil ganget med dagene som gjenstår. Et anslag, ikke en
                    prognose — én god dag flytter det.
                  </dd>
                </div>
                <div>
                  <dt className="text-foreground">Uenig i målet?</dt>
                  <dd>Ta det opp med {goal.setBy}. Målet kan justeres i perioden.</dd>
                </div>
              </dl>
            </PopoverContent>
          </Popover>
        </div>

        {goal.absenceNote && (
          <p className="-mt-3 text-[12.5px] text-muted-foreground">{goal.absenceNote}</p>
        )}
      </div>

      {/* The design system requires a non-visual equivalent for anything a
          decision depends on, and a pay conversation may depend on this. */}
      <p className="sr-only">
        {goal.label}: {formatNumber(goal.current)} av {formatNumber(goal.target)} {goal.unit},{" "}
        {Math.round(m.pct * 100)} prosent. Forventet nå {formatNumber(m.expected)}.{" "}
        {GOAL_STATE_LABEL[m.state]}. {formatNumber(m.remaining)} {goal.unit} igjen fordelt på{" "}
        {goal.daysRemaining} arbeidsdager, {formatNumber(m.perDay)} per dag. Ved dagens takt ender
        perioden på omtrent {formatNumber(m.projected)}.
      </p>

      <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground sm:px-7">
        {subject ? `${subject} · ` : ""}
        {goal.period} · den tynne streken er forventet framdrift i dag, den tykke er målet
      </p>
    </div>
  );
}
