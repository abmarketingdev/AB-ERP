import type { GoalCard } from "@/types/promoter";

/**
 * One place where a goal turns into numbers, so no two surfaces can disagree.
 *
 * Two decisions worth stating:
 *
 * 1. **behind / on-track / ahead is derived, never read from the payload.** The
 *    stored `status` is advisory. A flag that can drift out of step with the
 *    figures beside it is a bug waiting to be shipped, and on a screen someone's
 *    pay conversation refers to, it is the wrong kind of bug.
 *
 * 2. **Absence is removed from the denominator, not the numerator.** Sick leave
 *    and holiday shrink the days you were expected to work; they do not count as
 *    days you produced nothing. Expected pace is therefore computed over
 *    `daysTotal - absenceDays`, and the screen says so in plain text.
 */

export interface GoalMath {
  /** Working days already elapsed, absence removed. */
  elapsed: number;
  /** Working days in the period, absence removed. */
  effectiveTotal: number;
  /** Where a steady pace puts you today. */
  expected: number;
  /** current − expected. Negative means behind. */
  diff: number;
  /** Units still to go. */
  remaining: number;
  /** What the remaining distance means per remaining working day. */
  perDay: number;
  /**
   * Where today's pace lands you at period end — Stephen Few's "optional
   * feature" for the bullet graph, and the only element on the screen that
   * answers "what does it take from here" rather than "how am I doing".
   */
  projected: number;
  pct: number;
  complete: boolean;
  state: "behind" | "on-track" | "ahead";
}

/** Inside ±5 % of target counts as on pace — a single unit is noise, not a trend. */
const TOLERANCE = 0.05;

export function goalMath(goal: GoalCard): GoalMath {
  const effectiveTotal = Math.max(1, goal.daysTotal - goal.absenceDays);
  const elapsed = Math.max(0, Math.min(effectiveTotal, goal.daysTotal - goal.daysRemaining - goal.absenceDays));

  const expected = Math.round((goal.target * elapsed) / effectiveTotal);
  const diff = goal.current - expected;
  const remaining = Math.max(0, goal.target - goal.current);
  const perDay = goal.daysRemaining > 0 ? Math.ceil(remaining / goal.daysRemaining) : remaining;

  const rate = elapsed > 0 ? goal.current / elapsed : 0;
  const projected = Math.round(goal.current + rate * goal.daysRemaining);

  const band = goal.target * TOLERANCE;
  const state = diff > band ? "ahead" : diff < -band ? "behind" : "on-track";

  return {
    elapsed,
    effectiveTotal,
    expected,
    diff,
    remaining,
    perDay,
    projected,
    pct: goal.target > 0 ? Math.min(1, goal.current / goal.target) : 0,
    complete: goal.current >= goal.target,
    state,
  };
}

export const GOAL_STATE_LABEL: Record<GoalMath["state"], string> = {
  behind: "Under forventet takt",
  "on-track": "På forventet takt",
  ahead: "Over forventet takt",
};

/**
 * FR-L-13 — the band a leader may move a target within.
 *
 * Computed from `baseline`, never from the current target. Measuring the
 * allowance from wherever the last edit landed would let the same 15 % be
 * applied repeatedly until the limit binds nothing at all.
 *
 * One function, used by both the form and the mock API's validation, so the
 * control the leader sees and the control the endpoint enforces are the same
 * control. A UI that permits what the server rejects is worse than no UI hint.
 */
export function permittedBand(
  baseline: number,
  limit: { maxChangePct: number; minTarget: number; maxTarget: number },
): { min: number; max: number } {
  const delta = Math.round((baseline * limit.maxChangePct) / 100);
  return {
    min: Math.max(limit.minTarget, baseline - delta),
    max: Math.min(limit.maxTarget, baseline + delta),
  };
}

export function withinBand(
  target: number,
  baseline: number,
  limit: { maxChangePct: number; minTarget: number; maxTarget: number },
): boolean {
  const band = permittedBand(baseline, limit);
  return Number.isFinite(target) && target >= band.min && target <= band.max;
}
