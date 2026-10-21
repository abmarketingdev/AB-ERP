import { IS_MOCK } from "./data-source";

/**
 * Which ERP modules have a backend. The ERP also carries older screens (leader and promoter
 * front pages, goals, courses, results, customer portal) that predate the recruitment SRS and
 * call services that do not exist yet. In api mode those are hidden from the menu and their
 * routes send the user home — no 404s after login (master 2026-10-22). Mock mode shows
 * everything, as before. Flip `backend` to true when a module gets its service.
 */
type Module = { id: string; label: string; routes: string[]; backend: boolean };

export const MODULES: Module[] = [
  // Recruitment SRS — recruitment-service / hr-service.
  { id: "rekruttering", label: "Rekruttering", routes: ["/rekruttering"], backend: true },
  { id: "godkjenning", label: "Godkjenning", routes: ["/godkjenning"], backend: true },
  { id: "onboarding", label: "Onboarding", routes: ["/onboarding"], backend: true },
  { id: "ansatte", label: "Ansatte", routes: ["/ansatte"], backend: true },
  { id: "dashboard", label: "Rekrutteringsdashboard", routes: ["/dashboard"], backend: true },
  { id: "leder-rekruttering", label: "Leder: intervjuer, oppmøte, oppgaver",
    routes: ["/leder/intervjuer", "/leder/oppmote", "/leder/oppgaver"], backend: true },
  { id: "promoter-rekruttering", label: "Promotør: stand og vaktplan",
    routes: ["/promoter/stand", "/promoter/vaktplan"], backend: true },
  { id: "admin", label: "Administrasjon",
    routes: ["/admin/tilganger", "/admin/integrasjoner", "/admin/revisjonslogg", "/admin/personvern",
      "/admin/oppgaver", "/admin/import"], backend: true },

  // Older ERP screens without a service (outside the recruitment SRS).
  { id: "leder-forside", label: "Leder: forside og teamresultater",
    routes: ["=/leder", "/leder/team", "/leder/teamresultater", "/leder/person", "/leder/mal",
      "/leder/tiltak", "/leder/oppfolging", "/leder/kurs"], backend: false },
  { id: "promoter-forside", label: "Promotør: forside, mål og resultater",
    routes: ["=/promoter", "/promoter/mal", "/promoter/resultater", "/promoter/ukeplan",
      "/promoter/nyheter", "/promoter/kurs"], backend: false },
  { id: "kunde", label: "Kundeportal", routes: ["/kunde", "/admin/kunder", "/admin/forhandsvis"], backend: false },
  { id: "admin-oversikt", label: "Administrasjon: kunder, kampanjer, avdelinger (FR-A-01)", routes: ["=/admin"], backend: false },
  { id: "kpi", label: "KPI-ordbok og korrigeringer", routes: ["/admin/kpi-ordbok", "/admin/korrigeringer"], backend: false },
];

function matches(route: string, path: string) {
  if (route.startsWith("=")) return path === route.slice(1) || path === `${route.slice(1)}/`;
  return path === route || path.startsWith(`${route}/`);
}

/** The module a path belongs to (most specific route wins). */
export function moduleFor(path: string): Module | undefined {
  let best: Module | undefined;
  let len = -1;
  for (const m of MODULES) for (const r of m.routes) {
    const l = r.replace(/^=/, "").length;
    if (matches(r, path) && l > len) { best = m; len = l; }
  }
  return best;
}

/** False only for a known module without a backend, in api mode. Unknown paths pass. */
export function isAvailable(path: string): boolean {
  if (IS_MOCK) return true;
  return moduleFor(path)?.backend ?? true;
}
