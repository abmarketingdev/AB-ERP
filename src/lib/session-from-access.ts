import { IS_MOCK } from "./data-source";
import { isAvailable } from "./modules";
import type { AccessMe } from "@/types/access";
import type { NavItem, Session } from "./permissions";

/**
 * Builds the shell's Session from the server's access record (api mode).
 *
 * The screens are gated by coarse `*.view` permissions (useSessionGuard,
 * PermissionGate). The server speaks `<modul>.<handling>`. VIEW_GATES says which
 * server keys open each screen gate — one table, so a page never learns the
 * server's vocabulary and a new server key only needs a line here. Each list is
 * ordered least-privileged first (the mock /access/me/ answers with the first).
 *
 * Phase 1 (A1) finalises this table against every lane's access_keys.py; a key the
 * server sends that opens nothing here shows up in `unmappedKeys()` and in the test.
 */
export const VIEW_GATES: Record<string, string[]> = {
  "promoter.view": ["staffing.read_own", "stand.write"],
  "schedule.view": ["staffing.read_own", "staffing.manage"],
  "leader.view": ["staffing.manage", "tasks.own", "interviews_own.read"],
  "saleschief.view": ["staffing.forecast"],
  "tasks.view": ["tasks.own", "tasks.compliance"],
  "interviews.view": ["booking.read", "interviews_own.read"],
  "recruitment.view": ["candidates.read", "candidates_master.read"],
  "leads.view": ["leads.read"],
  "ads.view": ["ads.read"],
  "approval.view": ["approval.read"],
  "onboarding.view": ["onboarding.read"],
  "employees.view": ["employees.read"],
  "privatenotes.view": ["private_notes.read"],
  "recruitdash.view": ["dashboard.read"],
  "import.view": ["recman_import.admin"],
  "kpi.view": ["dashboard.read"],
  "privacy.view": ["privacy.admin"],
  "admin.view": ["access.admin", "integrations.read", "audit.read", "privacy.admin", "tasks.compliance"],
};

/** Every screen, with the gate that shows it, grouped in sections (order: Rekruttering ·
 * Ledere · Min side · Administrasjon — master, design review round 1). Order is the menu order. */
const NAV: (NavItem & { gate: string })[] = [
  { id: "innboks", label: "Samleinnboks", href: "/rekruttering/innboks", icon: "inbox", gate: "leads.view", section: "Rekruttering" },
  { id: "kandidater", label: "Kandidater", href: "/rekruttering/kandidater", icon: "users", gate: "recruitment.view", section: "Rekruttering" },
  { id: "intervjuer", label: "Intervjuer", href: "/rekruttering/intervjuer", icon: "calendar", gate: "interviews.view", section: "Rekruttering" },
  { id: "annonser", label: "Annonser", href: "/rekruttering/annonser", icon: "megaphone", gate: "ads.view", section: "Rekruttering" },
  { id: "godkjenning", label: "Godkjenning", href: "/godkjenning", icon: "shield-check", gate: "approval.view", section: "Rekruttering" },
  { id: "onboarding", label: "Onboarding", href: "/onboarding", icon: "clipboard-list", gate: "onboarding.view", section: "Rekruttering" },
  { id: "ansatte", label: "Ansatte", href: "/ansatte", icon: "users", gate: "employees.view", section: "Rekruttering" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "bar-chart", gate: "recruitdash.view", section: "Rekruttering" },
  { id: "forside-leder", label: "Forside", href: "/leder", icon: "home", gate: "leader.view", section: "Ledere" },
  { id: "mine-intervjuer", label: "Mine intervjuer", href: "/leder/intervjuer", icon: "calendar", gate: "leader.view", section: "Ledere" },
  { id: "oppmote", label: "Oppmøte", href: "/leder/oppmote", icon: "calendar-check", gate: "leader.view", section: "Ledere" },
  { id: "oppgaver", label: "Mine oppgaver", href: "/leder/oppgaver", icon: "clipboard-list", gate: "tasks.view", section: "Ledere" },
  { id: "forside-promoter", label: "Forside", href: "/promoter", icon: "home", gate: "promoter.view", section: "Min side" },
  { id: "stand", label: "Registrer lead", href: "/promoter/stand", icon: "user-plus", gate: "promoter.view", section: "Min side" },
  { id: "vaktplan", label: "Vaktplan", href: "/promoter/vaktplan", icon: "calendar", gate: "promoter.view", section: "Min side" },
  { id: "oversikt", label: "Oversikt", href: "/admin", icon: "layout-grid", gate: "admin.view", section: "Administrasjon" },
  { id: "tilganger", label: "Brukere og tilganger", href: "/admin/tilganger", icon: "lock", gate: "admin.view", section: "Administrasjon" },
  { id: "etterlevelse", label: "Etterlevelse", href: "/admin/oppgaver", icon: "clipboard-list", gate: "admin.view", section: "Administrasjon" },
  { id: "integrasjoner", label: "Integrasjoner", href: "/admin/integrasjoner", icon: "activity", gate: "admin.view", section: "Administrasjon" },
  { id: "revisjonslogg", label: "Revisjonslogg", href: "/admin/revisjonslogg", icon: "history", gate: "admin.view", section: "Administrasjon" },
  { id: "personvern", label: "Personvern", href: "/admin/personvern", icon: "shield-check", gate: "privacy.view", section: "Administrasjon" },
];

export function viewGatesFor(serverKeys: string[]): string[] {
  const held = new Set(serverKeys);
  return Object.entries(VIEW_GATES)
    .filter(([, keys]) => keys.some((k) => held.has(k)))
    .map(([gate]) => gate);
}

/** Server keys that open no screen — a sign VIEW_GATES is behind the server. */
export function unmappedKeys(serverKeys: string[]): string[] {
  const mapped = new Set(Object.values(VIEW_GATES).flat());
  return serverKeys.filter((k) => !mapped.has(k));
}

export function sessionFromAccess(access: AccessMe, name?: string): Session {
  const gates = viewGatesFor(access.permissions);
  const seen = new Set<string>();
  const navigation = NAV.filter((n) => gates.includes(n.gate))
    // Two "Forside" entries (leader + promoter) collapse to the first one held.
    .filter((n) => {
      const key = n.label === "Forside" ? "forside" : n.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    // api mode: screens whose module has no backend yet are not offered (src/lib/modules.ts).
    .filter((n) => isAvailable(n.href))
    .map(({ id, label, href, icon, section }) => ({ id, label, href, icon, section }));
  // Land on the person's main job (master 2026-10-22). Order matters: an approver who can
  // also read candidates lands on approvals; leads.write (not leads.read — «promotør med
  // ekstra tilgang» reads leads too) marks a recruiter. Mock mode keeps the old front pages.
  const held = new Set(access.permissions);
  const home =
    held.has("access.admin") ? (IS_MOCK ? "/admin" : "/admin/tilganger")
      : held.has("approval.approve") ? "/godkjenning"
        : held.has("onboarding.write") ? "/onboarding"
          : held.has("dashboard.all") && gates.includes("recruitdash.view") ? "/dashboard"
            : gates.includes("leader.view") ? (IS_MOCK ? "/leder" : "/leder/intervjuer")
              : held.has("leads.write") ? "/rekruttering/innboks"
                : gates.includes("promoter.view") ? (IS_MOCK ? "/promoter" : "/promoter/vaktplan")
                  : navigation[0]?.href;
  return {
    homeHref: home,
    key: access.template ?? "custom",
    userId: access.userId,
    name: name ?? access.username,
    role: access.templateLabel ?? (access.isSuperuser ? "Administrator" : "Egendefinert tilgang"),
    // Server keys AND the screen gates they open, so useHasPermission works with both.
    permissions: [...access.permissions, ...gates],
    navigation,
    // Data scoping is enforced server-side per endpoint (IFK-03); this label is display only.
    scope: { kind: access.isSuperuser ? "org" : "self", teamIds: [], label: name ?? access.username },
  };
}
