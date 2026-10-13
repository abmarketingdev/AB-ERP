import { RECRUITMENT_STAGES } from "./mock-data";

export function stageById(id: string) {
  return RECRUITMENT_STAGES.find((s) => s.id === id);
}

export function stageIndex(id: string) {
  return RECRUITMENT_STAGES.findIndex((s) => s.id === id);
}

/**
 * Colour carries meaning, never meaning on its own — every badge also shows the
 * stage label. Live stages are neutral or accent, the three terminal
 * "did not happen" stages are quiet, and only the two that end well are green.
 */
export const STAGE_BADGE: Record<string, string> = {
  ny: "bg-muted text-muted-foreground",
  kontaktet: "bg-muted text-muted-foreground",
  kvalifisert: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  "intervju-booket": "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  intervjuet: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  "til-godkjenning": "bg-warning/10 text-warning-on-tint",
  godkjent: "bg-success/10 text-success",
  onboarding: "bg-success/10 text-success",
  ansatt: "bg-success/10 text-success",
  avvist: "bg-muted text-muted-foreground line-through",
  "no-show": "bg-danger/10 text-danger",
  trukket: "bg-muted text-muted-foreground line-through",
};

/** The stages a candidate cannot come back from. Used to offer "close" everywhere. */
export const TERMINAL_STAGE_IDS = ["avvist", "no-show", "trukket"];

/**
 * GODK-03 — no candidate reaches onboarding without Ole's approval.
 *
 * Stated once, here, so the board, the detail page and the mock API all enforce
 * the same rule. Returning a reason rather than a boolean is what lets the UI
 * explain the refusal instead of just disabling a control with no explanation.
 */
export function stageMoveRefusal(fromId: string, toId: string): string | null {
  const gated = ["onboarding", "ansatt"];
  const approved = ["godkjent", "onboarding", "ansatt"];
  if (gated.includes(toId) && !approved.includes(fromId)) {
    return "Kandidaten må godkjennes av Ole før onboarding kan starte.";
  }
  return null;
}

export const CONTRACT_LABEL = {
  "not-sent": "Ikke sendt",
  sent: "Sendt",
  signed: "Signert",
} as const;

export const CONTRACT_BADGE = {
  "not-sent": "bg-muted text-muted-foreground",
  sent: "bg-warning/10 text-warning-on-tint",
  signed: "bg-success/10 text-success",
} as const;
