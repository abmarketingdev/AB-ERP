"use client";

import * as React from "react";
import { Shell } from "./shell";
import { NoAccess } from "./permission-gate";
import { MascotLoadingScreen } from "./mascot-loading";
import { useSessionGuard } from "@/lib/use-session-guard";

/**
 * A portal is gated by what a session may do, not by who it is. `/leder` admits
 * anyone holding `leader.view` — today a team lead and a sales chief, at
 * different scopes.
 */
const PERMISSION: Record<string, string> = {
  promoter: "promoter.view",
  leader: "leader.view",
  recruitment: "recruitment.view",
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
  const { session, denied } = useSessionGuard(PERMISSION[role]);

  if (session === undefined) {
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
