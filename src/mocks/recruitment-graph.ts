/**
 * Mock-mode mirror of the server's status graph (recruitment-service
 * candidates/graph.py), so a demo refuses the same drops the API refuses.
 * Only the recruiter's own (manual) edges and the "requires" forms are mirrored;
 * system edges (booking, approval, onboarding) are reachable only through their
 * own flows, here as on the server.
 */
const LIVE = ["ny", "kontaktet", "kvalifisert", "intervju-booket", "intervjuet"];

const MANUAL: Record<string, string[]> = {
  ny: ["kontaktet", "kvalifisert"],
  kontaktet: ["kvalifisert", "ny"],
  avvist: ["kvalifisert"],
  trukket: ["kvalifisert"],
  "no-show": ["kvalifisert"],
};
for (const s of LIVE) MANUAL[s] = [...(MANUAL[s] ?? []), "avvist", "trukket"];

export const REQUIRES: Record<string, string> = {
  "intervju-booket": "booking",
  "til-godkjenning": "approval",
};
export const APPROVAL_GATED = ["til-godkjenning", "godkjent", "onboarding", "ansatt"];
export const REASON_REQUIRED = ["avvist", "trukket"];

export function manualTargets(from: string): string[] {
  return MANUAL[from] ?? [];
}

/** `null` = allowed; otherwise the 409 body the server would send. */
export function refuseMove(from: string, to: string, reasonCode?: string) {
  if (from === to) return { message: "Kandidaten står allerede der.", code: "same_status", requires: null };
  if (!manualTargets(from).includes(to)) {
    if (REQUIRES[to] && (to !== "til-godkjenning" || from === "intervjuet")) {
      return { message: to === "intervju-booket" ? "«Intervju booket» settes ved booking."
                                                  : "Send til godkjenning med godkjenningsskjemaet.",
               code: "system_only", requires: REQUIRES[to] };
    }
    if (APPROVAL_GATED.includes(to)) {
      return { message: "Kandidaten må godkjennes av Ole før onboarding kan starte.", code: "system_only", requires: null };
    }
    return { message: "Den flyttingen er ikke tillatt.", code: "illegal_edge", requires: null };
  }
  const reopening = ["avvist", "trukket", "no-show"].includes(from);
  if ((REASON_REQUIRED.includes(to) || reopening) && !reasonCode) {
    return { message: "Velg en årsak.", code: "reason_required", requires: to === "avvist" ? "rejection_reason" : "reason" };
  }
  return null;
}
