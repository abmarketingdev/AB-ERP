"use client";

import * as React from "react";
import { Shell } from "./shell";
import { NoAccess } from "./permission-gate";
import { MascotLoadingScreen } from "./mascot-loading";
import { useSessionGuard } from "@/lib/use-session-guard";
import { usePathname, useRouter } from "next/navigation";
import { isAvailable } from "@/lib/modules";

/**
 * A portal is gated by what a session may do, not by who it is. `/leder` admits
 * anyone holding `leader.view` — today a team lead and a sales chief, at
 * different scopes.
 */
const PERMISSION: Record<string, string | string[]> = {
  promoter: "promoter.view",
  leader: "leader.view",
  // A section admits anyone allowed ANY page in it; each page then checks its own gate.
  // Gating all of /rekruttering on candidates meant that taking «Kandidater» away also
  // blocked Intervjuer, Samleinnboks and Annonser, which the menu still offered.
  recruitment: ["recruitment.view", "interviews.view", "leads.view", "ads.view"],
  approval: "approval.view",
  onboarding: "onboarding.view",
  employees: "employees.view",
  recruitdash: "recruitdash.view",
  admin: "admin.view",
};

export function RoleShell({
  role,
  children,
}: {
  role: keyof typeof PERMISSION;
  children: React.ReactNode;
}) {
  const need = PERMISSION[role];
  const needs = Array.isArray(need) ? need : [need];
  const { session } = useSessionGuard(needs[0]);
  const denied = !!session && !needs.some((p) => session.permissions.includes(p));
  const pathname = usePathname();
  const router = useRouter();
  // api mode: a screen whose module has no backend yet sends the user home instead of
  // rendering widgets that 404 (src/lib/modules.ts).
  const unavailable = !isAvailable(pathname);
  React.useEffect(() => {
    if (unavailable && session?.homeHref && session.homeHref !== pathname) router.replace(session.homeHref);
  }, [unavailable, session, pathname, router]);

  if (session === undefined || (unavailable && session)) {
    return (
      <MascotLoadingScreen label="Henter din side…" />
    );
  }
  if (session === null) return null;

  /*
   * FR-S-05 — the refusal is rendered, not redirected, and it keeps the user's
   * own shell so the way out is the navigation they already know.
   */
  return (
    <Shell session={session}>
      {denied ? <NoAccess homeHref={session.navigation[0]?.href} /> : children}
    </Shell>
  );
}
