"use client";

import * as React from "react";
import type { MascotMotion, MascotPose, MascotState } from "@/components/patterns/mascot";

/**
 * What happened → how Pandi shows it. The ONE table every screen uses (A1-mascot-guide.md).
 *
 * Call sites name the event, never a pose, so the product keeps one vocabulary: the same
 * "all done" looks the same in the leader's task list and in the approval queue. The motion
 * comes from mascot.tsx's DEFAULT_MOTION policy — `loop` only while a real wait runs, `once`
 * on a state change, a still otherwise (WCAG 2.2.2) — and is only overridden here where an
 * event needs a different pose than its state's default.
 *
 *     const m = mascotFor("allDone");        <Mascot {...m} size={56} />
 *     <EmptyState mascot={m.state} pose={m.pose} … />
 */
export type MascotEvent =
  | "loading"        // a real wait in progress (fetch, export, sending)
  | "empty"          // nothing here yet, and that is neutral (new list, no results)
  | "allClear"       // nothing here BECAUSE the work is done (empty inbox, no overdue tasks)
  | "allDone"        // a set of work just got finished (checklist complete, last task ticked)
  | "approved"       // a decision someone waited for: candidate approved, access granted
  | "milestone"      // a big, rare moment: contract signed, onboarding complete, goal reached
  | "error"          // something failed; the copy next to it says what to do
  | "stale"          // data is shown but old/partial (replica lag, integration down)
  | "forbidden"      // signed in, not allowed here
  | "greeting";      // first view of the day / login

interface MascotSpec {
  state: MascotState;
  pose?: MascotPose;
  motion?: MascotMotion;
  /** Screen-reader text; required when the mascot IS the indicator (loading). */
  label?: string;
}

const EVENTS: Record<MascotEvent, MascotSpec> = {
  loading: { state: "thinking", label: "Laster…" },
  empty: { state: "sleeping" },
  allClear: { state: "idle", pose: "hammock", motion: "still" },
  allDone: { state: "win-small" },
  approved: { state: "win-small" },                 // clipboard with the APPROVED stamp
  milestone: { state: "win-big" },
  error: { state: "concerned" },
  stale: { state: "idle", pose: "reading", motion: "still" },
  forbidden: { state: "concerned", pose: "standing", motion: "still" },
  greeting: { state: "greeting" },
};

export function mascotFor(event: MascotEvent, label?: string): MascotSpec {
  const spec = EVENTS[event];
  return label ? { ...spec, label } : spec;
}

/**
 * A celebration that plays ONCE when `done` turns true, then holds still — never on first
 * render (opening a page where everything was already done is not an event).
 *
 *     const m = useMascotOnDone(allTasksDone, "allDone");
 */
export function useMascotOnDone(done: boolean, event: MascotEvent = "allDone"): MascotSpec & { key: number } {
  const prev = React.useRef(done);
  const [key, setKey] = React.useState(0);
  React.useEffect(() => {
    if (done && !prev.current) setKey((k) => k + 1);
    prev.current = done;
  }, [done]);
  const spec = mascotFor(done ? event : "empty");
  // Before the transition, a finished state is shown as a still: no replay on mount.
  return { ...spec, motion: key === 0 && done ? "still" : spec.motion, key };
}
