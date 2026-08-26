"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSession } from "./permissions";

/**
 * The scope a leader is currently looking at.
 *
 * Two rules, and they are different rules:
 *
 *  - **Entitlement** lives on the session and is enforced by the API from the
 *    bearer token. Nothing here can widen it. Asking for a team outside it
 *    returns 403, not a filtered list.
 *  - **Selection** lives in the URL, so a narrowed view is shareable and the
 *    back button works. A chief who sends a colleague a link to Team Sør should
 *    have them land on Team Sør.
 *
 * A team lead has exactly one team, so the switcher does not render for them —
 * the control exists only where there is a choice to make.
 */

export interface ScopeState {
  /** Teams currently selected. Always a subset of the session's entitlement. */
  teamIds: string[];
  /** Every team the user may see. */
  allowed: string[];
  /** Null when looking at everything, otherwise the single selected team. */
  teamId: string | null;
  canSwitch: boolean;
  label: string;
  setTeam: (teamId: string | null) => void;
}

export const TEAM_NAMES: Record<string, string> = {
  t1: "Team Vest",
  t2: "Team Nord",
  t3: "Team Sør",
  t4: "Team Øst",
};

export function useScope(): ScopeState {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const allowed = React.useMemo(() => session?.scope.teamIds ?? [], [session]);
  const asked = params.get("team");

  // A URL asking for something outside the entitlement is ignored rather than
  // sent to the API — the 403 would be correct but the user gains nothing from
  // seeing it, and it is almost always a stale link rather than an attack.
  const teamId = asked && allowed.includes(asked) ? asked : null;
  const teamIds = teamId ? [teamId] : allowed;

  const setTeam = React.useCallback(
    (next: string | null) => {
      const q = new URLSearchParams(params.toString());
      if (next) q.set("team", next);
      else q.delete("team");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return {
    teamIds,
    allowed,
    teamId,
    canSwitch: allowed.length > 1,
    label: teamId ? (TEAM_NAMES[teamId] ?? teamId) : (session?.scope.label ?? ""),
    setTeam,
  };
}

/** The parameter every scoped query sends. Undefined means "my whole entitlement". */
export function scopeParam(teamIds: string[]): string | undefined {
  return teamIds.length ? teamIds.join(",") : undefined;
}
