import type { UserAccess } from "@/types/quality";

/**
 * FR-S-04 — effective permissions are the role default set, plus individually
 * granted items, minus individually revoked items.
 *
 * Computed in one place and used by the screen, the API and the tests, so the
 * rule cannot be implemented twice and drift. The order matters: revocation is
 * applied last, so revoking something that was also granted individually
 * removes it. That is the safer reading of a contradiction — an administrator
 * who has explicitly taken access away should not have it handed back by a
 * grant made earlier.
 */
export function effectivePermissions(u: {
  roleDefaults: string[];
  granted: string[];
  revoked: string[];
}): string[] {
  const set = new Set([...u.roleDefaults, ...u.granted]);
  for (const p of u.revoked) set.delete(p);
  return [...set];
}

export type Provenance = "role" | "granted" | "revoked" | "none";

/** Where a given permission came from, for a user — the thing this screen exists to show. */
export function provenanceOf(u: UserAccess, key: string): Provenance {
  if (u.revoked.includes(key)) return "revoked";
  if (u.granted.includes(key)) return "granted";
  if (u.roleDefaults.includes(key)) return "role";
  return "none";
}

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  role: "Fra rollen",
  granted: "Gitt individuelt",
  revoked: "Fjernet individuelt",
  none: "Ikke tildelt",
};

/**
 * What an administrator can actually do to a permission, given where it came
 * from. Role defaults can be revoked but not "granted" again as an individual
 * item, and an individual grant is withdrawn rather than revoked — the
 * distinction keeps the three lists meaningful instead of letting them blur
 * into one editable set.
 */
export function actionsFor(p: Provenance): { grant: boolean; revoke: boolean; reset: boolean } {
  switch (p) {
    case "role":
      return { grant: false, revoke: true, reset: false };
    case "granted":
      return { grant: false, revoke: false, reset: true };
    case "revoked":
      return { grant: false, revoke: false, reset: true };
    case "none":
      return { grant: true, revoke: false, reset: false };
  }
}
