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
    permissions: ["promoter.view"],
    scope: { kind: "self", teamIds: ["t1"], label: "Kari Nordmann" },
    navigation: [
      { id: "forside", label: "Forside", href: "/promoter", icon: "home" },
      { id: "resultater", label: "Resultater", href: "/promoter/resultater", icon: "bar-chart" },
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
    permissions: ["leader.view"],
    scope: { kind: "team", teamIds: ["t1"], label: "Team Vest" },
    navigation: [
      { id: "forside", label: "Forside", href: "/leder", icon: "home" },
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
    permissions: ["leader.view", "saleschief.view"],
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
    permissions: ["recruitment.view"],
    scope: { kind: "org", teamIds: ["t1", "t2", "t3", "t4"], label: "Alle team" },
    navigation: [
      { id: "forside", label: "Forside", href: "/rekruttering", icon: "home" },
      { id: "kandidater", label: "Kandidater", href: "/rekruttering/kandidater", icon: "users" },
    ],
  },
  admin: {
    key: "admin",
    userId: "u-admin",
    name: "Admin Bruker",
    role: "Administrator",
    permissions: ["admin.view", "kpi.view", "import.view"],
    scope: { kind: "org", teamIds: ["t1", "t2", "t3", "t4"], label: "Alle team" },
    navigation: [
      { id: "oversikt", label: "Oversikt", href: "/admin", icon: "layout-grid" },
      { id: "kpi-ordbok", label: "KPI-ordbok", href: "/admin/kpi-ordbok", icon: "book-open" },
      { id: "import", label: "Import", href: "/admin/import", icon: "upload" },
      { id: "integrasjoner", label: "Integrasjoner", href: "/admin/integrasjoner", icon: "activity" },
      { id: "korrigeringer", label: "Korrigeringer", href: "/admin/korrigeringer", icon: "wrench" },
      { id: "tilganger", label: "Brukere og tilganger", href: "/admin/tilganger", icon: "lock" },
      { id: "kunder", label: "Kunder", href: "/admin/kunder", icon: "building" },
      { id: "forhandsvis", label: "Forhåndsvis som", href: "/admin/forhandsvis", icon: "eye" },
      { id: "revisjonslogg", label: "Revisjonslogg", href: "/admin/revisjonslogg", icon: "history" },
    ],
  },
};
