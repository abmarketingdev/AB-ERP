import type { Session } from "./permissions";

/**
 * Navigation is a property of the session, not a constant the shell imports —
 * which is what makes a portal the same code at two scopes.
 *
 * FR-P-12 is visible here by what is absent from the promoter's list: no
 * leaderboard, no coins, no duels, no achievements. The requirement is worded
 * as a v1 exclusion, and the honest way to hold it is to have nowhere for them
 * to appear rather than a feature flag someone flips by accident.
 */
export const MOCK_USERS: Record<string, Session> = {
  promoter: {
    key: "promoter",
    userId: "u-promoter",
    name: "Kari Nordmann",
    role: "Promoter",
    permissions: ["promoter.view", "schedule.view"],
    scope: { kind: "self", teamIds: ["t1"], label: "Kari Nordmann" },
    navigation: [
      { id: "forside", label: "Forside", href: "/promoter", icon: "home" },
      // LEAD-05 — first in the list after the front page because on a stand it
      // is the only thing they open.
      { id: "stand", label: "Registrer lead", href: "/promoter/stand", icon: "user-plus" },
      { id: "resultater", label: "Resultater", href: "/promoter/resultater", icon: "bar-chart" },
      { id: "vaktplan", label: "Vaktplan", href: "/promoter/vaktplan", icon: "calendar" },
      { id: "ukeplan", label: "Ukeplan", href: "/promoter/ukeplan", icon: "calendar" },
      { id: "mal", label: "Mål", href: "/promoter/mal", icon: "target" },
      { id: "kurs", label: "Kurs", href: "/promoter/kurs", icon: "graduation-cap" },
      { id: "nyheter", label: "Nyheter", href: "/promoter/nyheter", icon: "newspaper" },
    ],
  },
  leader: {
    key: "leader",
    userId: "u-leader",
    name: "Ola Nordmann",
    role: "Team lead",
    permissions: ["leader.view", "schedule.view", "tasks.view", "interviews.view"],
    scope: { kind: "team", teamIds: ["t1"], label: "Team Vest" },
    navigation: [
      { id: "forside", label: "Forside", href: "/leder", icon: "home" },
      { id: "oppgaver", label: "Mine oppgaver", href: "/leder/oppgaver", icon: "clipboard-list" },
      { id: "intervjuer", label: "Mine intervjuer", href: "/leder/intervjuer", icon: "calendar" },
      { id: "oppmote", label: "Oppmøte", href: "/leder/oppmote", icon: "calendar-check" },
      { id: "teamresultater", label: "Teamresultater", href: "/leder/teamresultater", icon: "bar-chart" },
      { id: "oppfolging", label: "Oppfølgingsbehov", href: "/leder/oppfolging", icon: "alert-triangle" },
      { id: "tiltak", label: "Tiltak", href: "/leder/tiltak", icon: "clipboard-list" },
      { id: "mal", label: "Mål", href: "/leder/mal", icon: "target" },
      { id: "kurs", label: "Kurs", href: "/leder/kurs", icon: "graduation-cap" },
    ],
  },
  saleschief: {
    key: "saleschief",
    userId: "u-saleschief",
    name: "Marte Solberg",
    role: "Salgssjef",
    permissions: ["leader.view", "saleschief.view", "schedule.view", "tasks.view", "interviews.view", "recruitdash.view"],
    scope: {
      kind: "org",
      teamIds: ["t1", "t2", "t3", "t4"],
      label: "Region Vest — 4 team",
    },
    // Deliberately the same routes as the team lead. Doc 01 calls for one
    // portal with two scopes; a parallel set of /salgssjef pages would be two
    // products that drift apart. The only addition is Team, which exists
    // because comparing teams is a question a team lead cannot ask.
    navigation: [
      { id: "forside", label: "Forside", href: "/leder", icon: "home" },
      { id: "team", label: "Team", href: "/leder/team", icon: "layout-grid" },
      { id: "oppgaver", label: "Mine oppgaver", href: "/leder/oppgaver", icon: "clipboard-list" },
      { id: "intervjuer", label: "Mine intervjuer", href: "/leder/intervjuer", icon: "calendar" },
      { id: "oppmote", label: "Oppmøte", href: "/leder/oppmote", icon: "calendar-check" },
      { id: "dashboard", label: "Rekruttering", href: "/dashboard", icon: "bar-chart" },
      { id: "teamresultater", label: "Resultater", href: "/leder/teamresultater", icon: "bar-chart" },
      { id: "oppfolging", label: "Oppfølgingsbehov", href: "/leder/oppfolging", icon: "alert-triangle" },
      { id: "tiltak", label: "Tiltak", href: "/leder/tiltak", icon: "clipboard-list" },
      { id: "mal", label: "Mål", href: "/leder/mal", icon: "target" },
      { id: "kurs", label: "Kurs", href: "/leder/kurs", icon: "graduation-cap" },
    ],
  },
  recruitment: {
    key: "recruitment",
    userId: "u-recruitment",
    name: "Fredrik Amundsen",
    role: "Rekrutterer",
    permissions: ["recruitment.view", "leads.view", "ads.view", "interviews.view", "recruitdash.view"],
    scope: { kind: "org", teamIds: ["t1", "t2", "t3", "t4"], label: "Alle team" },
    navigation: [
      { id: "forside", label: "Forside", href: "/rekruttering", icon: "home" },
      // LEAD-01 — the samleinnboks sits above the pipeline because it is the
      // step before it, and because it is where the working day starts.
      { id: "innboks", label: "Samleinnboks", href: "/rekruttering/innboks", icon: "inbox" },
      { id: "kandidater", label: "Kandidater", href: "/rekruttering/kandidater", icon: "users" },
      { id: "intervjuer", label: "Intervjuer", href: "/rekruttering/intervjuer", icon: "calendar" },
      { id: "annonser", label: "Annonser", href: "/rekruttering/annonser", icon: "megaphone" },
      { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "bar-chart" },
    ],
  },

  /**
   * GODK — Ole, and whoever stands in for him (GODK-04).
   *
   * Deliberately the narrowest session in the product. The approver's job is
   * one decision, and giving them the recruiter's screens as well would make
   * the queue one tab among several rather than the thing they open the portal
   * for. `recruitment.view` is granted because the decision is meaningless
   * without being able to read the candidate it is about.
   */
  approver: {
    key: "approver",
    userId: "u-approver",
    name: "Ole Marius Sormbråten",
    role: "Godkjenner",
    permissions: ["approval.view", "recruitment.view", "privatenotes.view", "onboarding.view", "employees.view"],
    scope: { kind: "org", teamIds: ["t1", "t2", "t3", "t4"], label: "Alle team" },
    navigation: [
      { id: "godkjenning", label: "Godkjenning", href: "/godkjenning", icon: "shield-check" },
      { id: "onboarding", label: "Onboarding", href: "/onboarding", icon: "clipboard-list" },
      { id: "ansatte", label: "Ansatte", href: "/ansatte", icon: "users" },
      { id: "kandidater", label: "Kandidater", href: "/rekruttering/kandidater", icon: "users" },
    ],
  },

  /**
   * Ledelse — read-only by construction.
   *
   * The SRS gives management "dashboards og prognoser (lesetilgang)". There is
   * no read-only flag anywhere in this model, and adding one would be a second
   * access mechanism competing with the permission list. Instead they simply
   * hold the view permissions and none of the ones that write, which is the
   * same guarantee expressed in the system that already exists.
   */
  management: {
    key: "management",
    userId: "u-management",
    name: "Lars Eide",
    role: "Ledelse",
    permissions: ["leader.view", "saleschief.view", "recruitdash.view", "schedule.view", "privatenotes.view"],
    scope: { kind: "org", teamIds: ["t1", "t2", "t3", "t4"], label: "Hele selskapet" },
    navigation: [
      { id: "forside", label: "Forside", href: "/leder", icon: "home" },
      { id: "team", label: "Team", href: "/leder/team", icon: "layout-grid" },
      { id: "teamresultater", label: "Resultater", href: "/leder/teamresultater", icon: "bar-chart" },
    ],
  },
  admin: {
    key: "admin",
    userId: "u-admin",
    name: "Admin Bruker",
    role: "Administrator",
    // §2.2 — "Admin (Lars og Joseph): mastervisning over alle leads og
    // kandidater". Admin holds every module permission rather than bypassing
    // the check, so the admin session is governed by the same mechanism as
    // everyone else's and /admin/tilganger can show it.
    permissions: ["admin.view", "kpi.view", "import.view", "recruitment.view", "approval.view", "leader.view", "saleschief.view", "promoter.view", "leads.view", "ads.view", "interviews.view", "onboarding.view", "employees.view", "privatenotes.view", "schedule.view", "tasks.view", "recruitdash.view"],
    scope: { kind: "org", teamIds: ["t1", "t2", "t3", "t4"], label: "Alle team" },
    navigation: [
      { id: "innboks", label: "Samleinnboks", href: "/rekruttering/innboks", icon: "inbox" , section: "Rekruttering" },
      { id: "kandidater", label: "Kandidater", href: "/rekruttering/kandidater", icon: "users" , section: "Rekruttering" },
      { id: "godkjenning", label: "Godkjenning", href: "/godkjenning", icon: "shield-check" , section: "Rekruttering" },
      { id: "annonser", label: "Annonser", href: "/rekruttering/annonser", icon: "megaphone" , section: "Rekruttering" },
      { id: "intervjuer", label: "Intervjuer", href: "/rekruttering/intervjuer", icon: "calendar" , section: "Rekruttering" },
      { id: "onboarding", label: "Onboarding", href: "/onboarding", icon: "clipboard-list" , section: "Rekruttering" },
      { id: "ansatte", label: "Ansatte", href: "/ansatte", icon: "users" , section: "Rekruttering" },
      { id: "dashboard", label: "Rekrutteringsdashboard", href: "/dashboard", icon: "bar-chart" , section: "Rekruttering" },
      { id: "oversikt", label: "Oversikt", href: "/admin", icon: "layout-grid" , section: "Administrasjon" },
      { id: "etterlevelse", label: "Etterlevelse", href: "/admin/oppgaver", icon: "clipboard-list" , section: "Administrasjon" },
      { id: "kpi-ordbok", label: "KPI-ordbok", href: "/admin/kpi-ordbok", icon: "book-open" , section: "Administrasjon" },
      { id: "import", label: "Import", href: "/admin/import", icon: "upload" , section: "Administrasjon" },
      { id: "integrasjoner", label: "Integrasjoner", href: "/admin/integrasjoner", icon: "activity" , section: "Administrasjon" },
      { id: "korrigeringer", label: "Korrigeringer", href: "/admin/korrigeringer", icon: "wrench" , section: "Administrasjon" },
      { id: "tilganger", label: "Brukere og tilganger", href: "/admin/tilganger", icon: "lock" , section: "Administrasjon" },
      { id: "kunder", label: "Kunder", href: "/admin/kunder", icon: "building" , section: "Administrasjon" },
      { id: "forhandsvis", label: "Forhåndsvis som", href: "/admin/forhandsvis", icon: "eye" , section: "Administrasjon" },
      { id: "revisjonslogg", label: "Revisjonslogg", href: "/admin/revisjonslogg", icon: "history" , section: "Administrasjon" },
    ],
  },
};
