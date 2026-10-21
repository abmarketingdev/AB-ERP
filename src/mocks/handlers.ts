import { http, HttpResponse, delay, type JsonBodyType } from "msw";
import { permittedBand, withinBand } from "@/lib/goal";
import { effectivePermissions } from "@/lib/access";
import {
  db,
  persistDb,
  promoterKpis,
  dailyResults,
  goalPace,
  promoterGoalFor,
  leaderKpis,
  deviationTrend,
  thresholds,
  teamCourseStatus,
  teamRollups,
  personDetail,
  teamHistory,
  buildTeamMembers,
  goalPlanFor,
  orgGoalPlan,
  teamName,
  orgOverview,
  permissionCatalogue,
  definitionImpact,
  GOAL_LIMIT,
  TEAM_GOAL_LIMIT,
  teamTrend,
  PERIOD_MONTH,
} from "./db";
import type { Candidate, CandidateHistoryEntry } from "@/types/recruitment";
import { accessHandlers } from "./access-handlers";
import { a3Handlers } from "./a3-handlers";
import type { Lead } from "@/types/lead";
import { queryLeads, leadCounts, leadById, leadsByIds, patchLead } from "./lead-query";
import { leadCorpus } from "./leads";
import { buildDashboard } from "./srs-dashboard";
import { LEADERS, TEAMS_SRS, dayOffset, iso, isoDay, DEMO_TODAY } from "./srs-seed";
import type { NewHire, Employee, Equipment, ChecklistKey } from "@/types/onboarding";
import type { Shift, SwapRequest } from "@/types/schedule";
import type { LeaderTask } from "@/types/task";
import type { AuditEntry, CustomerAccount, CustomerAgreement } from "@/types/quality";
import { buildCampaignReport } from "./customer-report";
import { MOCK_USERS } from "@/lib/mock-users";
import {
  DEFAULT_AGREEMENT,
  IMPORT_CANDIDATES,
  RETENTION_MONTHS,
  RETENTION_BASIS,
  RETENTION_RETAINED,
  RETENTION_REMOVED,
} from "@/lib/mock-data";

/**
 * Handlers double as the API specification. When the backend team asks "what
 * does this endpoint return", the answer is this file plus src/types.
 */

/**
 * The demo scenarios. `goal-reached` exists because the fixtures otherwise never
 * show the product's best moment: Kari is at 74 of 140, the leader's permitted
 * band is ±15 %, and so there is no path through the UI that reaches a met
 * goal. A state the demo cannot reach is a state nobody reviews — and this one
 * is the single screen the whole promoter portal is arranged around.
 */
type Scenario =
  | "healthy"
  | "followups"
  | "import-failed"
  | "empty"
  | "error"
  | "goal-reached";

const SCENARIOS: Scenario[] = ["followups", "import-failed", "empty", "error", "goal-reached"];

function scenarioOf(request: Request): Scenario {
  const s = new URL(request.url).searchParams.get("scenario") as Scenario | null;
  return s && SCENARIOS.includes(s) ? s : "healthy";
}

/** A frontend built against instant responses always has broken loading states. */
async function latency() {
  await delay(150 + Math.round(Math.random() * 250));
}

function nowStamp() {
  return new Date().toLocaleString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

let auditCounter = 0;
export function writeAudit(entry: Omit<AuditEntry, "id" | "at" | "ts"> & { at?: string; ts?: string }) {
  const row: AuditEntry = {
    // The counter is module state and resets on reload, but db.audit is restored
    // from sessionStorage — so a plain counter reissues ids that already exist
    // and React sees two rows with the same key. The timestamp makes it unique
    // across reloads; the counter keeps entries written in the same millisecond
    // apart.
    id: `a-live-${Date.now().toString(36)}-${++auditCounter}`,
    at: entry.at ?? nowStamp(),
    ts: entry.ts ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    area: entry.area,
    affected: entry.affected,
    before: entry.before,
    after: entry.after,
  };
  db.audit.unshift(row);
  return row;
}


/**
 * Who is calling, and what they may see.
 *
 * Taken from the bearer token, never from a query parameter. Scope is an
 * authorisation fact: a client that can widen its own scope by editing a URL has
 * no scope at all. The request may *narrow* — a sales chief looking at one team —
 * and anything outside the token's entitlement is refused with 403 rather than
 * quietly filtered away, so the boundary is visible in the network tab.
 */
function callerTeams(request: Request): string[] {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace(/^Bearer /, "");
  if (!token) return [];
  try {
    const { userKey } = JSON.parse(atob(token)) as { userKey?: string };
    return (userKey && MOCK_USERS[userKey]?.scope.teamIds) || [];
  } catch {
    return [];
  }
}

/**
 * Resolves the customer portal's own bearer token to an account.
 *
 * Separate from `callerTeams` on purpose: the customer portal is a different
 * product with a different session, and letting one function serve both is how
 * a staff token eventually ends up authorising a customer request.
 */
function callerCustomer(request: Request): CustomerAccount | null {
  const token = request.headers.get("X-Customer-Token");
  if (!token) return null;
  try {
    const { email, verified } = JSON.parse(atob(token)) as { email?: string; verified?: boolean };
    if (!verified || !email) return null;
    return db.customerAccounts.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

class ScopeDenied extends Error {
  constructor(public teams: string[]) {
    super("out of scope");
  }
}

/** Resolves ?teams=t1,t2 against the caller's entitlement. */
function resolveScope(request: Request): string[] {
  const allowed = callerTeams(request);
  const asked = new URL(request.url).searchParams.get("teams");
  if (!asked) return allowed;
  const wanted = asked.split(",").filter(Boolean);
  const denied = wanted.filter((t) => !allowed.includes(t));
  if (denied.length) throw new ScopeDenied(denied);
  return wanted;
}

/** Wraps a GET resolver with latency plus the empty/error scenarios. */
function get<T extends JsonBodyType>(path: string, resolve: (req: Request) => T, emptyValue?: T) {
  return http.get(path, async ({ request }) => {
    await latency();
    const scenario = scenarioOf(request);
    if (scenario === "error") {
      return HttpResponse.json({ message: "Simulert feil" }, { status: 500 });
    }
    if (scenario === "empty" && emptyValue !== undefined) {
      return HttpResponse.json(emptyValue);
    }
    try {
      return HttpResponse.json(resolve(request));
    } catch (err) {
      if (err instanceof ScopeDenied) {
        return HttpResponse.json(
          { message: `Du har ikke tilgang til ${err.teams.map(teamName).join(", ")}` },
          { status: 403 },
        );
      }
      throw err;
    }
  });
}

export const handlers = [
  // ── recruitment-service: access (A1) ──────────────────────────────────────
  ...accessHandlers,
  ...a3Handlers,
  // ── Promoter ───────────────────────────────────────────────────────────────
  get(
    "/api/dashboard/employee/me/stats",
    (request) => {
      const g = new URL(request.url).searchParams.get("granularity");
      return promoterKpis(g === "day" || g === "month" ? g : "week");
    },
    [],
  ),
  get(
    "/api/dashboard/employee/me/daily",
    (request) => {
      const g = new URL(request.url).searchParams.get("granularity");
      return dailyResults(g === "day" || g === "month" ? g : "week");
    },
    [],
  ),
  get("/api/dashboard/promoter/pace", (r) => goalPace(scenarioOf(r) === "goal-reached"), []),
  get("/api/maps/promoter/weekplan", () => db.weekPlan, []),
  get("/api/dashboard/promoter/goal", (request) =>
    promoterGoalFor(scenarioOf(request) === "goal-reached"),
  ),
  get("/api/learning/promoter/courses", () => db.courses, []),
  get("/api/maps/promoter/news", () => db.news, []),
  get("/api/qc/corrections/notices", () => db.correctionNotices, []),

  // ── Leader ─────────────────────────────────────────────────────────────────
  get("/api/dashboard/v2/overview", (r) => leaderKpis(resolveScope(r)), []),
  get("/api/dashboard/v2/trends", (r) => teamTrend(resolveScope(r)), []),
  get("/api/dashboard/v2/employees", (r) => buildTeamMembers(resolveScope(r)), []),
  get("/api/dashboard/deviations", (r) => deviationTrend(resolveScope(r)), []),
  get("/api/dashboard/analytics/thresholds/effective", () => thresholds(), []),
  get("/api/dashboard/leader/goal", (r) => {
    const teams = resolveScope(r);
    const rolls = teamRollups(teams);
    return {
      ...db.leaderGoal,
      label: rolls.length === 1 ? `${rolls[0].name} — aktive givere denne måneden` : "Alle team — aktive givere denne måneden",
      target: rolls.reduce((n, t) => n + t.target, 0),
      current: rolls.reduce((n, t) => n + t.donors, 0),
      setBy: rolls.length === 1 ? "Salgssjef Vest" : "Regiondirektør",
    };
  }),
  // FR-L-11/12 — read-only by construction: there is no PATCH counterpart.
  get("/api/learning/team/status", (r) => teamCourseStatus(resolveScope(r)), []),

  get(
    "/api/hr/followups",
    (request) => {
      const names = new Set(resolveScope(request).map(teamName));
      const inScope = db.followUps.filter((f) => names.has(f.team));
      // The "several follow-ups needed" demo scenario shows the queue including
      // rows already acted on, so the volume is visible.
      if (scenarioOf(request) === "followups") return inScope;
      return inScope.filter((f) => !f.outcome);
    },
    [],
  ),
  get("/api/hr/measures", () => db.measures, []),
  get("/api/dashboard/leader/teams", (r) => teamRollups(resolveScope(r)), []),
  get("/api/dashboard/leader/history", (r) => teamHistory(resolveScope(r))),
  http.get("/api/dashboard/leader/person/:id", async ({ request, params }) => {
    await latency();
    const detail = personDetail(String(params.id));
    if (!detail) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    // Scope is enforced on the person's team, not just on list endpoints — a
    // direct URL to someone else's detail page is the obvious way round a filter.
    if (!callerTeams(request).includes(detail.teamId)) {
      return HttpResponse.json({ message: "Du har ikke tilgang til denne personen" }, { status: 403 });
    }
    return HttpResponse.json(detail);
  }),
  get("/api/dashboard/leader/org-goal-plan", (r) => orgGoalPlan(resolveScope(r))),
  get("/api/dashboard/leader/goal-plan", (r) => {
    const teams = resolveScope(r);
    return goalPlanFor(teams[0] ?? "t1");
  }),

  // ── Recruitment ────────────────────────────────────────────────────────────
  // ── Onboarding (ONB) ───────────────────────────────────────────────────────
  get("/api/hr/onboarding", () => db.newHires, []),

  http.get("/api/hr/onboarding/:id", async ({ params }) => {
    await latency();
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    return HttpResponse.json(h);
  }),

  /** ONB-05 — the checklist. Ticking the last box is what finishes onboarding. */
  http.post("/api/hr/onboarding/:id/check", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { key: ChecklistKey; done: boolean };
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });

    /*
     * ONB-03 — "Ansatt kan ikke starte før kontrakten er signert." So the first
     * working day cannot be ticked while the contract is outstanding. Refusing
     * with a reason rather than hiding the control keeps the rule visible.
     */
    if (body.key === "forstedag" && body.done && h.contract.status !== "signert") {
      return HttpResponse.json(
        { message: "Kontrakten må være signert før første arbeidsdag kan bekreftes." },
        { status: 409 },
      );
    }
    if (body.key === "utstyr" && body.done && h.equipment.length === 0) {
      return HttpResponse.json(
        { message: "Registrer utstyret med serienummer før du huker av." },
        { status: 409 },
      );
    }

    const item = h.checklist.find((c) => c.key === body.key);
    if (item) {
      item.done = body.done;
      item.at = body.done ? new Date().toISOString() : null;
    }

    // ONB-09 — a completed checklist creates the employee, with the access
    // template. That transition is the point of the module, so it happens here
    // rather than being a separate button somebody forgets to press.
    if (h.checklist.every((c) => c.done) && !h.completedAt) {
      h.completedAt = new Date().toISOString();
      const employee: Employee = {
        id: `emp-${Date.now()}`,
        name: h.name,
        phone: h.phone,
        email: h.email,
        team: h.team,
        campaign: h.campaign,
        role: "Promotør",
        startDate: h.startDate,
        active: true,
        accessTemplate: "Promotør",
        equipment: h.equipment,
        photo: Boolean(h.photo),
        fromNewHireId: h.id,
      };
      db.employees.unshift(employee);
      writeAudit({ actor: "Ole Marius Sormbråten", action: "Opprettet ansatt fra onboarding", area: "Ansatte", affected: h.name, after: "Tilgangsmal: Promotør" });
    }

    persistDb();
    return HttpResponse.json(h);
  }),

  /** ONB-02 / ONB-03 — kontrakt til signering, og purring på det som ikke er signert. */
  http.post("/api/hr/onboarding/:id/contract", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { action: "send" | "remind" | "sign" };
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const now = new Date().toISOString();
    if (body.action === "send") {
      h.contract.status = "sendt";
      h.contract.sentAt = now;
    } else if (body.action === "remind") {
      h.contract.remindersSent += 1;
    } else {
      h.contract.status = "signert";
      h.contract.signedAt = now;
      const item = h.checklist.find((c) => c.key === "kontrakt");
      if (item) { item.done = true; item.at = now; }
    }
    writeAudit({ actor: "Ole Marius Sormbråten", action: `Kontrakt: ${body.action}`, area: "Onboarding", affected: h.name, after: h.contract.status });
    persistDb();
    return HttpResponse.json(h);
  }),

  /** ONB-06 — Ole tar bildet og kobler det til personen. */
  http.post("/api/hr/onboarding/:id/photo", async ({ params }) => {
    await latency();
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const now = new Date().toISOString();
    h.photo = { uploadedAt: now, uploadedBy: "Ole Marius Sormbråten" };
    const item = h.checklist.find((c) => c.key === "bilde");
    if (item) { item.done = true; item.at = now; }
    persistDb();
    return HttpResponse.json(h);
  }),

  /**
   * ONB-07 — utstyr registreres med serienummer, og utstyrskontrakten sendes
   * *etter* utlevering.
   *
   * The order is the requirement: the contract is the employee confirming what
   * they received, so it cannot be sent before there is anything to confirm.
   */
  http.post("/api/hr/onboarding/:id/equipment", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { kind: string; model: string; serial: string };
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const dupe = db.newHires.flatMap((x) => x.equipment).find((e) => e.serial === body.serial);
    if (dupe) {
      return HttpResponse.json(
        { message: `Serienummeret ${body.serial} er allerede registrert på en annen ansatt.` },
        { status: 409 },
      );
    }
    const eq: Equipment = {
      id: `eq-${Date.now()}`,
      kind: body.kind,
      model: body.model,
      serial: body.serial,
      handedOutAt: new Date().toISOString(),
      handedOutBy: "Ole Marius Sormbråten",
    };
    h.equipment.push(eq);
    writeAudit({ actor: "Ole Marius Sormbråten", action: "Registrerte utlevert utstyr", area: "Onboarding", affected: h.name, after: `${body.kind} ${body.serial}` });
    persistDb();
    return HttpResponse.json(h);
  }),

  http.post("/api/hr/onboarding/:id/equipment-contract", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { action: "send" | "sign" };
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (body.action === "send" && h.equipment.length === 0) {
      return HttpResponse.json(
        { message: "Utstyrskontrakten signeres etter utlevering — registrer utstyret først." },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    if (body.action === "send") {
      h.equipmentContract = { status: "sendt", sentAt: now, signedAt: null };
    } else {
      h.equipmentContract = { ...h.equipmentContract, status: "signert", signedAt: now };
      const item = h.checklist.find((c) => c.key === "utstyr");
      if (item) { item.done = true; item.at = now; }
    }
    persistDb();
    return HttpResponse.json(h);
  }),

  /** ONB-08 — møtte ikke første arbeidsdag, etter at de er fulgt opp. */
  http.post("/api/hr/onboarding/:id/no-show", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { note: string };
    const h = db.newHires.find((x) => x.id === params.id);
    if (!h) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    h.firstDayNoShow = { at: new Date().toISOString(), followedUpBy: "Ole Marius Sormbråten", note: body.note };
    writeAudit({ actor: "Ole Marius Sormbråten", action: "Registrerte ikke møtt første arbeidsdag", area: "Onboarding", affected: h.name, after: "Ikke møtt" });
    persistDb();
    // Nasrin is told, per ONB-08. Modelled as an audit entry here; the real
    // system sends it on whichever channel §4 settles on.
    return HttpResponse.json(h);
  }),

  // ── Ansatte ────────────────────────────────────────────────────────────────
  get("/api/hr/employees", () => db.employees, []),
  http.get("/api/hr/employees/:id", async ({ params }) => {
    await latency();
    const e = db.employees.find((x) => x.id === params.id);
    if (!e) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    return HttpResponse.json(e);
  }),

  // ── Vaktplan og oppmøte (BEM) ──────────────────────────────────────────────
  get("/api/hr/shifts", (request) => {
    const url = new URL(request.url);
    const employee = url.searchParams.get("employee");
    const team = url.searchParams.get("team");
    let rows: Shift[] = db.shifts;
    if (employee) rows = rows.filter((s) => s.employeeName === employee);
    if (team) rows = rows.filter((s) => s.team === team);
    return rows;
  }, []),

  get("/api/hr/shifts/swaps", () => db.swapRequests, []),

  /** BEM-07 — a swap is a request; it takes effect only once the leader agrees. */
  http.post("/api/hr/shifts/swaps", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { fromShiftId: string; toShiftId: string; reason: string };
    const from = db.shifts.find((s) => s.id === body.fromShiftId);
    const to = db.shifts.find((s) => s.id === body.toShiftId);
    if (!from || !to) return HttpResponse.json({ message: "Ukjent vakt" }, { status: 404 });
    const req: SwapRequest = {
      id: `sw-${Date.now()}`,
      fromEmployee: from.employeeName,
      toEmployee: to.employeeName,
      fromShiftId: from.id,
      toShiftId: to.id,
      fromDate: from.date,
      toDate: to.date,
      reason: body.reason,
      status: "venter",
      requestedAt: new Date().toISOString(),
      decidedAt: null,
      decidedBy: null,
    };
    db.swapRequests.unshift(req);
    from.swapPending = true;
    to.swapPending = true;
    persistDb();
    return HttpResponse.json(req, { status: 201 });
  }),

  http.post("/api/hr/shifts/swaps/:id/decide", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { approve: boolean; by?: string };
    const req = db.swapRequests.find((r) => r.id === params.id);
    if (!req) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const from = db.shifts.find((s) => s.id === req.fromShiftId);
    const to = db.shifts.find((s) => s.id === req.toShiftId);

    req.status = body.approve ? "godkjent" : "avvist";
    req.decidedAt = new Date().toISOString();
    req.decidedBy = body.by ?? "Ola Nordmann";

    if (body.approve && from && to) {
      // The swap exchanges who owns each shift, which is the only thing a swap
      // actually is — the dates and the team stay where they are.
      const a = { id: from.employeeId, name: from.employeeName };
      from.employeeId = to.employeeId;
      from.employeeName = to.employeeName;
      to.employeeId = a.id;
      to.employeeName = a.name;
    }
    if (from) from.swapPending = false;
    if (to) to.swapPending = false;

    writeAudit({ actor: req.decidedBy, action: body.approve ? "Godkjente vaktbytte" : "Avviste vaktbytte", area: "Vaktplan", affected: `${req.fromEmployee} ↔ ${req.toEmployee}`, after: req.status });
    persistDb();
    return HttpResponse.json(req);
  }),

  /** BEM-02 — follow up an absence from the calendar cell itself. */
  http.post("/api/hr/shifts/:id/follow-up", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { note: string; by?: string };
    const shift = db.shifts.find((s) => s.id === params.id);
    if (!shift) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    shift.followUp = { at: new Date().toISOString(), by: body.by ?? "Ola Nordmann", note: body.note };
    persistDb();
    return HttpResponse.json(shift);
  }),

  /**
   * BEM-03 / BEM-04 — reelt behov for dagsverk, regnet fra historisk oppmøte
   * "uavhengig av tilgjengeligheten de ansatte selv oppgir".
   *
   * `reliable` exists because BEM-04 says this is the basis for decisions about
   * coaching, contracts and recruitment. A forecast built on a fortnight of
   * data should say so rather than look like one built on a year.
   */
  get("/api/hr/shifts/forecast", () => {
    const MIN_BASIS_DAYS = 10;
    const byTeam = new Map<string, { planned: number; attended: number; missed: number; past: number }>();
    for (const s of db.shifts) {
      if (s.kind !== "arbeid") continue;
      const cur = byTeam.get(s.team) ?? { planned: 0, attended: 0, missed: 0, past: 0 };
      if (s.attendance === "planlagt") cur.planned += 1;
      if (s.attendance === "mott") { cur.attended += 1; cur.past += 1; }
      if (s.attendance === "ikke-mott") { cur.missed += 1; cur.past += 1; }
      byTeam.set(s.team, cur);
    }
    return [...byTeam.entries()].map(([team, v]) => {
      const showRate = v.past ? v.attended / v.past : 0;
      return {
        team,
        plannedDays: v.planned,
        expectedDays: Math.round(v.planned * showRate),
        showRate,
        basisDays: v.past,
        reliable: v.past >= MIN_BASIS_DAYS,
      };
    }).sort((a, b) => a.team.localeCompare(b.team, "nb"));
  }, []),

  // ── Lederoppgaver (OPPG) ───────────────────────────────────────────────────
  get("/api/hr/tasks", (request) => {
    const leader = new URL(request.url).searchParams.get("leader");
    return leader ? db.leaderTasks.filter((t) => t.leader === leader) : db.leaderTasks;
  }, []),

  /** OPPG-02 — etterlevelse per leder, for admin. */
  get("/api/hr/tasks/compliance", () => {
    const byLeader = new Map<string, { open: number; completed: number; overdue: number }>();
    for (const t of db.leaderTasks) {
      const cur = byLeader.get(t.leader) ?? { open: 0, completed: 0, overdue: 0 };
      if (t.status === "apen") cur.open += 1;
      if (t.status === "fullfort") cur.completed += 1;
      if (t.status === "forfalt") cur.overdue += 1;
      byLeader.set(t.leader, cur);
    }
    return [...byLeader.entries()].map(([leader, v]) => ({
      leader,
      ...v,
      // Open tasks are not yet a failure, so they are left out of the rate.
      // Counting them would punish a leader for having work in front of them.
      rate: v.completed + v.overdue === 0 ? null : v.completed / (v.completed + v.overdue),
    })).sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2));
  }, []),

  /** OPPG-01 — "Hver oppgave har svarfelt, som i Asana". */
  http.post("/api/hr/tasks/:id/complete", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { response: string };
    const t = db.leaderTasks.find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.response?.trim()) {
      return HttpResponse.json({ message: "Skriv et svar før du fullfører." }, { status: 422 });
    }
    t.status = "fullfort";
    t.response = body.response.trim();
    t.completedAt = new Date().toISOString();
    writeAudit({ actor: t.leader, action: "Fullførte lederoppgave", area: "Lederoppgaver", affected: t.title, after: "Fullført" });
    persistDb();
    return HttpResponse.json(t);
  }),

  http.post("/api/hr/tasks", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { title: string; detail?: string; dueDate: string; leader?: string };
    const t: LeaderTask = {
      id: `tk-${Date.now()}`,
      leader: body.leader ?? "Ola Nordmann",
      title: body.title,
      detail: body.detail ?? "",
      source: "egen",
      relatedCandidateId: null,
      dueDate: body.dueDate,
      status: "apen",
      response: null,
      completedAt: null,
    };
    db.leaderTasks.unshift(t);
    persistDb();
    return HttpResponse.json(t, { status: 201 });
  }),

  // ── Rekrutteringsdashboard (DASH) ──────────────────────────────────────────
  get("/api/hr/dashboard/recruitment", (request) => buildDashboard(new URL(request.url))),

  // Annonser (ANN) og intervjubooking (BOOK) live in ./a3-handlers (A3).

  // ── Notater og vedlegg (KAND-06, KAND-09) ─────────────────────────────────
  /**
   * KAND-09 — private notes are filtered **server-side**, by the caller's
   * permissions, not hidden in the component.
   *
   * A client-side filter means the note is in the JSON that reaches the
   * browser, and "we don't render it" is not the same promise as "you cannot
   * read it". This is personal data about somebody who has not been hired.
   */
  http.post("/api/hr/recruitment/candidates/:id/notes", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { body: string; visibleTo: string[]; author?: string };
    const c = db.candidates.find((x) => x.id === params.id);
    if (!c) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const note = {
      id: `n-${Date.now()}`,
      at: nowStamp(),
      author: body.author ?? "Fredrik Amundsen",
      body: body.body,
      visibleTo: body.visibleTo ?? [],
    };
    c.notes.push(note);
    // IFK-05 — the note itself is not written to the audit log, only that one
    // was added. The log is read by more people than the note is.
    writeAudit({
      actor: note.author,
      action: note.visibleTo.length ? "La inn privat notat" : "La inn notat",
      area: "Rekruttering",
      affected: c.name,
      after: note.visibleTo.length ? "Privat" : "Synlig for alle",
    });
    persistDb();
    return HttpResponse.json(c);
  }),

  http.post("/api/hr/recruitment/candidates/:id/attachments", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { name: string; kind: string; sizeKb?: number };
    const c = db.candidates.find((x) => x.id === params.id);
    if (!c) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    c.attachments.push({
      id: `f-${Date.now()}`,
      name: body.name,
      kind: (body.kind as "cv") ?? "annet",
      sizeKb: body.sizeKb ?? Math.round(40 + Math.random() * 200),
      uploadedAt: nowStamp(),
      uploadedBy: "Fredrik Amundsen",
    });
    persistDb();
    return HttpResponse.json(c);
  }),

  // ── GODK-04: stedfortreder ────────────────────────────────────────────────
  /**
   * "Godkjenner kan ha stedfortreder ved fravær (ikke personsavhengig)."
   *
   * The parenthesis is the requirement: the queue must not stop because one
   * person is away, so the deputy is a property of the *role*, not a favour one
   * named person does another. Stored as a setting, with a window, so it
   * expires by itself rather than quietly leaving two approvers forever.
   */
  get("/api/hr/approval/deputy", () => db.approvalDeputy),

  http.post("/api/hr/approval/deputy", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { deputy: string | null; from?: string; to?: string };
    db.approvalDeputy = body.deputy
      ? { deputy: body.deputy, from: body.from ?? null, to: body.to ?? null, setAt: new Date().toISOString() }
      : { deputy: null, from: null, to: null, setAt: new Date().toISOString() };
    writeAudit({
      actor: "Ole Marius Sormbråten",
      action: body.deputy ? "Satte stedfortreder for godkjenning" : "Fjernet stedfortreder",
      area: "Godkjenning",
      affected: body.deputy ?? "—",
      after: body.deputy ? `${body.from ?? "nå"} – ${body.to ?? "inntil videre"}` : "ingen",
    });
    persistDb();
    return HttpResponse.json(db.approvalDeputy);
  }),

  // ── LEAD-11: målgruppeeksport til Meta og TikTok ──────────────────────────
  /**
   * "Leads og ansatte som presterer godt kan eksporteres som målgrupper til
   * Meta og TikTok, slik at annonsene kan bruke lookalike audiences."
   *
   * Only people who ticked the *second* consent box are included (LEAD-10).
   * That is the whole reason the two consents are separate fields, and the
   * response reports how many were excluded for exactly that reason — an export
   * that silently drops a third of the list is one nobody can verify.
   */
  http.post("/api/hr/leads/audience-export", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { platform: "Meta" | "TikTok"; basis: "hired" | "qualified" };
    const all = [...db.leadExtra, ...leadCorpus()];
    const pool = body.basis === "hired"
      ? all.filter((l) => l.status === "sendt" && db.candidates.some(
          (c) => c.name === l.name && ["ansatt", "onboarding", "godkjent"].includes(c.stageId)))
      : all.filter((l) => l.status === "sendt");

    const eligible = pool.filter((l) => l.consent.adAudience);
    const excluded = pool.length - eligible.length;

    writeAudit({
      actor: "Fredrik Amundsen",
      action: `Eksporterte målgruppe til ${body.platform}`,
      area: "Samleinnboks",
      affected: `${eligible.length} personer`,
      before: `${pool.length} vurdert`,
      after: `${excluded} utelatt uten samtykke`,
    });
    persistDb();
    return HttpResponse.json({
      platform: body.platform,
      exported: eligible.length,
      considered: pool.length,
      excludedNoConsent: excluded,
      // Hashed in the real thing — Meta and TikTok both take SHA-256 of a
      // normalised e-mail. Shown here so the shape of what leaves is visible.
      sample: eligible.slice(0, 3).map((l) => ({ hashedEmail: `sha256:${l.email.length}${l.id}` })),
    });
  }),

  // ── BEM-05 / OPPG-03: Slack-varsling ──────────────────────────────────────
  /**
   * Both requirements are "Bør", and both are the same mechanism: a message
   * composed by the system and sent to Slack. Rendering the text rather than a
   * "sent" flag is the same decision as for the interview SMS — what it says is
   * the part anybody can have an opinion about before it goes live.
   */
  get("/api/hr/notifications/preview", () => {
    const behind = db.shifts.filter((s) => s.attendance === "ikke-mott");
    const byPerson = new Map<string, number>();
    for (const s of behind) byPerson.set(s.employeeName, (byPerson.get(s.employeeName) ?? 0) + 1);
    const worst = [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

    const overdue = db.leaderTasks.filter((t) => t.status === "forfalt");
    const byLeader = new Map<string, number>();
    for (const t of overdue) byLeader.set(t.leader, (byLeader.get(t.leader) ?? 0) + 1);

    return {
      absence: worst.map(([name, n]) => ({
        channel: "slack" as const,
        to: `@${name.toLowerCase().replace(/ /g, ".")}`,
        kind: "oppmøte" as const,
        body: `Hei ${name.split(" ")[0]}! Du ligger ${n} dager bak planlagt oppmøte de siste fire ukene. Si fra til lederen din hvis noe står i veien — vi finner en løsning.`,
      })),
      leaderSummary: [...byLeader.entries()].map(([leader, n]) => ({
        channel: "slack" as const,
        to: `@${leader.toLowerCase().replace(/ /g, ".")}`,
        kind: "oppgaver" as const,
        body: `Du har ${n} forfalte oppgave${n === 1 ? "" : "r"} i portalen. ${overdue.filter((t) => t.leader === leader).slice(0, 2).map((t) => `• ${t.title}`).join("\n")}`,
      })),
    };
  }),

  // ── DASH-01: rapport på e-post for de som vil ha den ──────────────────────
  get("/api/hr/dashboard/subscription", () => db.reportSubscription),
  http.post("/api/hr/dashboard/subscription", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { enabled: boolean; frequency: "ukentlig" | "manedlig"; recipients: string[] };
    db.reportSubscription = { ...body };
    persistDb();
    return HttpResponse.json(db.reportSubscription);
  }),

  // ── Godkjenning (GODK) ─────────────────────────────────────────────────────
  /**
   * GODK-02 / GODK-03 — Ole approves or rejects, and nothing reaches onboarding
   * without it.
   *
   * The decision is a stage change like any other, so it lands in the same
   * append-only history and the same audit log rather than in a parallel
   * "approvals" store that the candidate timeline would not show.
   */
  http.post("/api/hr/recruitment/candidates/:id/decision", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as {
      decision: "godkjent" | "avvist";
      comment: string;
      actor?: string;
    };
    const candidate = db.candidates.find((c) => c.id === params.id);
    if (!candidate) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (candidate.stageId !== "til-godkjenning") {
      return HttpResponse.json(
        { message: "Kandidaten ligger ikke til godkjenning." },
        { status: 409 },
      );
    }

    const actor = body.actor ?? "Ole Marius Sormbråten";
    candidate.history.push({
      id: `h-${Date.now()}`,
      at: nowStamp(),
      actor,
      type: "stage-change",
      stageId: body.decision,
      detail:
        body.decision === "godkjent"
          ? `Godkjent av ${actor}.${body.comment ? ` Kommentar: ${body.comment}` : ""}`
          : `Avvist av ${actor}. Begrunnelse: ${body.comment}`,
    });
    candidate.stageId = body.decision;

    /*
     * ONB-05 — approval is what creates the onboarding checklist. Building it
     * here rather than on the onboarding screen means the progress counter on
     * the board card is right the moment Ole presses the button.
     */
    if (body.decision === "godkjent" && candidate.onboarding.length === 0) {
      candidate.onboarding = [
        { id: "ob-1", task: "Personalia registrert", done: false },
        { id: "ob-2", task: "Kontrakt sendt til signering", done: false },
        { id: "ob-3", task: "Bilde tatt og lagt inn", done: false },
        { id: "ob-4", task: "Utstyr utlevert med serienummer", done: false },
        { id: "ob-5", task: "Opplæring gjennomført", done: false },
        { id: "ob-6", task: "Første arbeidsdag bekreftet", done: false },
      ];
    }

    writeAudit({
      actor,
      action: body.decision === "godkjent" ? "Godkjente kandidat" : "Avviste kandidat",
      area: "Godkjenning",
      affected: candidate.name,
      before: "Til godkjenning",
      after: body.decision === "godkjent" ? "Godkjent" : "Avvist",
    });
    persistDb();
    return HttpResponse.json(candidate);
  }),

  // ── Samleinnboks (LEAD) ────────────────────────────────────────────────────
  /*
   * Filtering, sorting and paging happen here rather than in the table, because
   * IFK-07 is a requirement about 10 000 leads and a client-side filter over
   * 10 000 rows is a different product from a server-side one. The response
   * carries `tookMs` so the demo can show the number instead of claiming it.
   */
  get(
    "/api/hr/leads",
    (request) => queryLeads(new URL(request.url)),
    { rows: [], total: 0, tookMs: 0 },
  ),
  get("/api/hr/leads/counts", () => leadCounts()),

  http.get("/api/hr/leads/:id", async ({ params }) => {
    await latency();
    const lead = leadById(String(params.id));
    if (!lead) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    return HttpResponse.json(lead);
  }),

  /**
   * LEAD-08 — send one or many leads on to the recruitment system.
   *
   * This is the step the whole SRS is arranged around, so it is a real
   * transition and not a flag: each lead becomes a candidate at the first
   * stage, the lead keeps a pointer to what it became, and the act is written
   * to the audit log. Sending an already-sent lead is a no-op rather than an
   * error — a double-click on a bulk action should not produce duplicates.
   */
  http.post("/api/hr/leads/send", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { ids: string[]; assignTo?: string };
    const leads = leadsByIds(body.ids).filter((l) => l.status === "ny");
    const created: Candidate[] = [];

    for (const lead of leads) {
      const owner = body.assignTo ?? lead.assignedTo ?? "Fredrik Amundsen";
      const candidate: Candidate = {
        id: `c-${lead.id}`,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.promoter ? `${lead.channel} (${lead.promoter})` : lead.channel,
        campaign: lead.campaign,
        appliedDate: nowStamp(),
        owner,
        stageId: db.stages[0].id,
        history: [
          {
            id: `h-${lead.id}`,
            at: nowStamp(),
            actor: owner,
            type: "created",
            detail: `Sendt videre fra samleinnboksen. Kanal: ${lead.channel}.` +
              (lead.promoter ? ` Registrert av ${lead.promoter}.` : ""),
          },
        ],
        contract: "not-sent",
        notes: [],
        attachments: [],
        onboarding: [],
        closure: null,
      };
      db.candidates.unshift(candidate);
      created.push(candidate);
      patchLead(lead.id, { status: "sendt", candidateId: candidate.id, assignedTo: owner });
    }

    writeAudit({
      actor: "Fredrik Amundsen",
      action: leads.length === 1 ? "Sendte lead til rekruttering" : `Sendte ${leads.length} leads til rekruttering`,
      area: "Samleinnboks",
      affected: leads.length === 1 ? leads[0].name : `${leads.length} leads`,
      after: db.stages[0].label,
    });
    persistDb();
    return HttpResponse.json({ sent: created.length, skipped: body.ids.length - created.length });
  }),

  /** LEAD-09 — distribute, or hand on to a colleague. */
  http.post("/api/hr/leads/assign", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { ids: string[]; assignTo: string };
    for (const id of body.ids) patchLead(id, { assignedTo: body.assignTo });
    writeAudit({
      actor: "Fredrik Amundsen",
      action: `Tildelte ${body.ids.length} lead(s)`,
      area: "Samleinnboks",
      affected: body.assignTo,
      after: body.assignTo,
    });
    persistDb();
    return HttpResponse.json({ assigned: body.ids.length });
  }),

  /**
   * LEAD-07 — fold duplicates into one record.
   *
   * The merged-away leads are marked `duplikat` rather than deleted. Somebody
   * will ask why there were three records for the same person and which one the
   * phone number came from, and a deleted row cannot answer that.
   */
  http.post("/api/hr/leads/merge", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { keepId: string; mergeIds: string[] };
    const keep = leadById(body.keepId);
    if (!keep) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const merged = leadsByIds(body.mergeIds).filter((l) => l.id !== keep.id);

    /*
     * Consent is unioned, not overwritten: if the person ticked the ad-audience
     * box on any one of the forms they filled in, that consent was given. The
     * text records which record it came from, because "they consented
     * somewhere" is not something anyone can act on later.
     */
    const adAudience = keep.consent.adAudience || merged.some((m) => m.consent.adAudience);
    const channels = [...new Set([keep.channel, ...merged.map((m) => m.channel)])];

    patchLead(keep.id, {
      consent: {
        ...keep.consent,
        adAudience,
        text: keep.consent.text + ` Slått sammen med ${merged.length} duplikat fra ${channels.join(", ")}.`,
      },
      duplicateOf: [],
    });
    for (const m of merged) patchLead(m.id, { status: "duplikat", duplicateOf: [] });

    writeAudit({
      actor: "Fredrik Amundsen",
      action: "Slo sammen duplikater",
      area: "Samleinnboks",
      affected: keep.name,
      before: `${merged.length + 1} oppføringer`,
      after: "1 oppføring",
    });
    persistDb();
    return HttpResponse.json({ kept: keep.id, merged: merged.length });
  }),

  http.post("/api/hr/leads/discard", async ({ request }) => {
    await latency();
    const body = (await request.json()) as { ids: string[]; reason?: string };
    for (const id of body.ids) patchLead(id, { status: "forkastet", note: body.reason ?? null });
    persistDb();
    return HttpResponse.json({ discarded: body.ids.length });
  }),

  /**
   * LEAD-05 — the stand form. The promoter is taken from the session rather
   * than typed, which is what makes "registrert av" trustworthy on the
   * promotørkvalitet dashboard (DASH-03).
   */
  http.post("/api/hr/leads/stand", async ({ request }) => {
    await latency();
    const body = (await request.json()) as {
      name: string; phone: string; email: string; campaign: string;
      consentContact: boolean; consentAdAudience: boolean; note?: string; promoter?: string;
    };
    const now = new Date().toISOString();
    const lead: Lead = {
      id: `l-stand-${Date.now()}`,
      name: body.name,
      phone: body.phone,
      email: body.email,
      channel: "Stand",
      campaign: body.campaign,
      receivedAt: now,
      promoter: body.promoter ?? "Kari Nordmann",
      assignedTo: null,
      status: "ny",
      consent: {
        contact: body.consentContact,
        adAudience: body.consentAdAudience,
        at: now,
        text: "Samtykket muntlig på stand til å bli kontaktet om stilling." +
          (body.consentAdAudience ? " Samtykket også til bruk i annonsemålgrupper." : ""),
      },
      adId: null,
      note: body.note ?? null,
      candidateId: null,
      duplicateOf: [],
    };
    db.leadExtra.unshift(lead);
    persistDb();
    return HttpResponse.json(lead, { status: 201 });
  }),

  get("/api/hr/recruitment/stages", () => db.stages, []),
  get("/api/hr/recruitment/candidates", () => db.candidates, []),
  http.get("/api/hr/recruitment/candidates/:id", async ({ params }) => {
    await latency();
    const found = db.candidates.find((c) => c.id === params.id);
    if (!found) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    return HttpResponse.json(found);
  }),

  // ── Customer ───────────────────────────────────────────────────────────────
  /**
   * FR-C-02/03/04/07/08 — the report, computed for the caller's own agreement.
   *
   * The identity comes from the portal token in the request header, never from
   * a query parameter. That is what makes FR-C-02 ("no cross-customer data
   * reachable by any means") true rather than merely intended: a customer can
   * put any campaign name in the URL they like, and if it is not on their
   * account they get a refusal, not somebody else's numbers.
   */
  http.get("/api/customer/report", async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    if (scenarioOf(request) === "error") {
      return HttpResponse.json({ message: "Rapporten er utilgjengelig" }, { status: 500 });
    }

    const account = callerCustomer(request);
    if (!account) {
      return HttpResponse.json({ message: "Ikke logget inn" }, { status: 401 });
    }
    if (!account.provisioned) {
      return HttpResponse.json({ message: "Portaltilgangen er ikke aktiv" }, { status: 403 });
    }
    const asked = url.searchParams.get("campaign");
    if (asked && !account.campaigns.includes(asked)) {
      return HttpResponse.json(
        { message: "Kampanjen hører ikke til din organisasjon" },
        { status: 403 },
      );
    }
    if (account.campaigns.length === 0) {
      return HttpResponse.json({ message: "Ingen kampanjer på kontoen" }, { status: 404 });
    }

    return HttpResponse.json(
      buildCampaignReport(
        {
          campaign: asked,
          granularity: url.searchParams.get("granularity"),
          period: url.searchParams.get("period"),
          location: url.searchParams.get("location"),
          organisation: url.searchParams.get("organisation"),
        },
        account.agreement,
        account.campaigns,
      ),
    );
  }),

  // ── Quality / admin ────────────────────────────────────────────────────────
  get("/api/qc/kpi-definitions", () => db.kpiDefinitions, []),
  get("/api/qc/corrections", () => db.corrections, []),
  // Newest first, at the source — every consumer inherits the order.
  get("/api/qc/audit", () => [...db.audit].sort((a, b) => b.ts.localeCompare(a.ts)), []),
  get(
    "/api/qc/import/runs",
    (request) =>
      scenarioOf(request) === "import-failed"
        ? [
            {
              id: "r0",
              file: "Dashboard_uke35.xlsx",
              period: "Uke 35, 2026",
              accepted: 0,
              rejected: 118,
              runBy: "Admin Bruker",
              runAt: "21. aug 2026, 08:04",
              status: "failed" as const,
            },
            ...db.importRuns,
          ]
        : db.importRuns,
    [],
  ),
  get("/api/qc/import/rejected", () => db.rejectedRows, []),
  get("/api/auth/access", () => db.userAccess, []),
  get("/api/auth/permissions", () => permissionCatalogue(), []),
  get("/api/auth/customers", () => db.customerAccounts, []),
  get("/api/admin/overview", () => orgOverview(), []),
  get("/api/admin/integrations", () => db.integrations, []),
  get("/api/qc/import/inbox", () => db.inbox, []),

  /** FR-K-06 — dry-run a proposed definition change against closed periods. */
  http.post("/api/qc/kpi-definitions/:id/impact", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { proposal: string };
    if (!body.proposal?.trim()) {
      return HttpResponse.json({ message: "Forslag til ny regeltekst kreves" }, { status: 422 });
    }
    const def = db.kpiDefinitions.find((d) => d.id === params.id);
    if (!def) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    return HttpResponse.json(definitionImpact(def.id, body.proposal.trim()));
  }),
  get("/api/auth/period", () => PERIOD_MONTH),

  // ── Mutations ──────────────────────────────────────────────────────────────
  /** FR-P-10 — read state per news item. */
  http.post("/api/maps/promoter/news/:id/read", async ({ params }) => {
    await latency();
    const item = db.news.find((n) => n.id === params.id);
    if (!item) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    item.read = true;
    persistDb();
    return HttpResponse.json(item);
  }),

  /** Client-originated audit entries — preview sessions, exports (FR-A-06). */
  http.post("/api/qc/audit", async ({ request }) => {
    await latency();
    const body = (await request.json()) as Omit<AuditEntry, "id" | "at"> & { at?: string };
    const row = writeAudit(body);
    persistDb();
    return HttpResponse.json(row, { status: 201 });
  }),

  http.post("/api/hr/recruitment/candidates", async ({ request }) => {
    await latency();
    const body = (await request.json()) as {
      name: string;
      phone: string;
      email: string;
      source: string;
      campaign: string;
    };
    const candidate: Candidate = {
      id: `c-${Date.now()}`,
      name: body.name,
      phone: body.phone,
      email: body.email,
      source: body.source,
      campaign: body.campaign,
      appliedDate: nowStamp(),
      owner: "Fredrik Amundsen",
      stageId: db.stages[0].id,
      history: [
        {
          id: `h-${Date.now()}`,
          at: nowStamp(),
          actor: "Fredrik Amundsen",
          type: "created",
          detail: `Kandidat registrert fra ${body.source}`,
        },
      ],
      contract: "not-sent",
      notes: [],
      attachments: [],
      onboarding: [],
      closure: null,
    };
    db.candidates.unshift(candidate);
    writeAudit({
      actor: "Fredrik Amundsen",
      action: "Registrerte kandidat",
      area: "Rekruttering",
      affected: body.name,
      after: db.stages[0].label,
    });
    persistDb();
    return HttpResponse.json(candidate, { status: 201 });
  }),

  http.post("/api/hr/recruitment/candidates/:id/advance", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { toStageId: string; fields: Record<string, string> };
    const candidate = db.candidates.find((c) => c.id === params.id);
    if (!candidate) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });

    const from = db.stages.find((s) => s.id === candidate.stageId);
    const to = db.stages.find((s) => s.id === body.toStageId);
    if (!to) return HttpResponse.json({ message: "Ukjent steg" }, { status: 422 });

    const detail = Object.entries(body.fields)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => {
        const field = to.fields.find((f) => f.id === k);
        return `${field?.label ?? k}: ${v}`;
      })
      .join(" · ");

    const entry: CandidateHistoryEntry = {
      id: `h-${Date.now()}`,
      at: nowStamp(),
      actor: "Fredrik Amundsen",
      type: "stage-change",
      stageId: to.id,
      detail: detail || `Flyttet til ${to.label}`,
    };
    // Append-only: history grows, it is never rewritten.
    // push, not unshift — the seed stores history oldest-first and the timeline
    // reverses it to show newest at top. Unshifting here would file a brand-new
    // entry at the bottom of the list.
    candidate.history.push(entry);
    candidate.stageId = to.id;
    if (to.terminal === "hired" && candidate.onboarding.length === 0) {
      candidate.onboarding = [
        { id: "o1", task: "Signer kontrakt", done: false },
        { id: "o2", task: "Bestill utstyr", done: false },
        { id: "o3", task: "Fullfør obligatoriske kurs", done: false },
      ];
      candidate.contract = "sent";
    }
    writeAudit({
      actor: "Fredrik Amundsen",
      action: "Flyttet kandidat",
      area: "Rekruttering",
      affected: candidate.name,
      before: from?.label,
      after: to.label,
    });
    persistDb();
    return HttpResponse.json(candidate);
  }),

  http.post("/api/hr/followups/:id/action", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as {
      type: "accepted" | "modified" | "rejected";
      note?: string;
    };
    const row = db.followUps.find((f) => f.id === params.id);
    if (!row) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (body.type === "rejected" && !body.note?.trim()) {
      // Rejecting requires a reason (FR-L-07) — enforced at the boundary too.
      return HttpResponse.json({ message: "Begrunnelse kreves ved avvisning" }, { status: 422 });
    }
    row.outcome = { type: body.type, note: body.note };

    if (body.type !== "rejected") {
      db.measures.unshift({
        id: `m-${Date.now()}`,
        person: row.name,
        action: body.note?.trim() || row.suggestedAction,
        owner: "Ola Nordmann",
        deadline: "Om 3 uker",
        status: "open",
      });
    }
    writeAudit({
      actor: "Ola Nordmann",
      action:
        body.type === "accepted"
          ? "Godtok oppfølgingsforslag"
          : body.type === "modified"
            ? "Endret oppfølgingsforslag"
            : "Avviste oppfølgingsforslag",
      area: "Oppfølging",
      affected: row.name,
      before: row.suggestedAction,
      after: body.note?.trim() || row.suggestedAction,
    });
    persistDb();
    return HttpResponse.json(row);
  }),

  /**
   * FR-I-07 — the audit record for a correction carries reason, time, before,
   * after and approver. A decision note is mandatory for both outcomes: a
   * rejection with no stated why is the one an auditor asks about.
   */

  get("/api/qc/import/candidates", () => IMPORT_CANDIDATES, []),
  get("/api/qc/import/decided-corrections", () => db.decidedCorrections, []),

  /**
   * FR-I-02 — a dry run. The file is parsed and validated, nothing is written,
   * and the caller gets the counts, the column map and every validation error.
   * FR-I-03 — if the period has already been imported, the preview says so and
   * the commit replaces that run rather than adding to it.
   */
  http.post("/api/qc/import/preview", async ({ request }) => {
    await latency();
    const { file } = (await request.json()) as { file: string };
    const candidate = IMPORT_CANDIDATES.find((c) => c.file === file);
    if (!candidate) return HttpResponse.json({ message: "Ukjent fil" }, { status: 422 });

    const clean = file.includes("rettet");
    const errors = clean
      ? []
      : [
          { row: 47, ref: "PR-1182", reason: "Ukjent promoter-ID" },
          { row: 112, ref: "Even Svendsen", reason: "Negativt beløp uten korrigeringskode" },
          { row: 118, ref: "Mari Haugen", reason: "Manglende kampanjekobling" },
        ];
    const total = 845;
    const previous = db.importRuns.find((r) => r.period === candidate.period);

    return HttpResponse.json({
      file: candidate.file,
      period: candidate.period,
      totalRows: total,
      accepted: total - errors.length,
      rejected: errors.length,
      duplicateOf: previous ? previous.file : null,
      columns: [
        { source: "PromoterID", target: "promoter_id", required: true },
        { source: "Dato", target: "date", required: true },
        { source: "Dører", target: "doors", required: true },
        { source: "Ja", target: "yes", required: true },
        { source: "Kampanje", target: "campaign", required: true },
        { source: "Beløp", target: "amount", required: false },
        // Deliberately unmapped: the case a silent column map would swallow.
        { source: "Notat", target: null, required: false },
      ],
      errors,
    });
  }),

  /** FR-I-01 / FR-I-04 — commit, and record the run. */
  http.post("/api/qc/import/commit", async ({ request }) => {
    await latency();
    const { file } = (await request.json()) as { file: string };
    const candidate = IMPORT_CANDIDATES.find((c) => c.file === file);
    if (!candidate) return HttpResponse.json({ message: "Ukjent fil" }, { status: 422 });

    const clean = file.includes("rettet");
    const rejected = clean ? 0 : 3;
    const accepted = 845 - rejected;

    // FR-I-03 — replace the run for a period that was already imported instead
    // of appending a second one, so the totals cannot double.
    const existing = db.importRuns.findIndex((r) => r.period === candidate.period);
    const run = {
      id: `run-${Date.now()}`,
      file: candidate.file,
      period: candidate.period,
      accepted,
      rejected,
      runBy: "Admin Bruker",
      runAt: nowStamp(),
      status: (rejected === 0 ? "success" : "partial") as "success" | "partial" | "failed",
    };
    if (existing >= 0) db.importRuns.splice(existing, 1, run);
    else db.importRuns.unshift(run);

    if (!clean) {
      const already = new Set(db.rejectedRows.map((r) => `${r.row}`));
      for (const e of [
        { row: 47, ref: "PR-1182", reason: "Ukjent promoter-ID" },
        { row: 112, ref: "Even Svendsen", reason: "Negativt beløp uten korrigeringskode" },
        { row: 118, ref: "Mari Haugen", reason: "Manglende kampanjekobling" },
      ]) {
        if (!already.has(`${e.row}`)) {
          db.rejectedRows.push({ id: `rr-${e.row}`, row: e.row, person: e.ref, reason: e.reason });
        }
      }
    }

    // A file that arrived automatically leaves the inbox once it is committed,
    // so the queue always shows what still needs a person.
    const inboxItem = db.inbox.find((f) => f.file === candidate.file && f.status === "awaiting-review");
    if (inboxItem) inboxItem.status = "committed";

    writeAudit({
      actor: "Admin Bruker",
      action: existing >= 0 ? "Erstattet import" : "Kjørte import",
      area: "Import",
      affected: `${candidate.file} — ${candidate.period}`,
      before: existing >= 0 ? "tidligere kjøring for samme periode" : undefined,
      after: `${accepted} godkjent, ${rejected} avvist`,
    });
    persistDb();
    return HttpResponse.json(run, { status: 201 });
  }),

  /**
   * FR-I-08 — accept a file that arrived on its own into the ordinary review
   * flow. It does not commit anything: it hands the file to the same preview
   * and commit a person would have used for a manual upload. A second,
   * unreviewed path into the figures is the thing this must not become.
   */
  http.post("/api/qc/import/inbox/:id/claim", async ({ params }) => {
    await latency();
    const item = db.inbox.find((f) => f.id === params.id);
    if (!item) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    writeAudit({
      actor: "Admin Bruker",
      action: "Hentet automatisk mottatt fil til gjennomgang",
      area: "Import",
      affected: `${item.file} — ${item.period}`,
      before: item.source,
      after: "til gjennomgang",
    });
    persistDb();
    return HttpResponse.json(item);
  }),

  /**
   * FR-R-10 — end a candidate process.
   *
   * Two clocks start, and keeping them separate is the point: access is revoked
   * immediately, while the record is retained for an agreed period so the
   * company can still show why someone was not hired. Minimisation — actually
   * deleting the contact details — is a later, separate event.
   */
  http.post("/api/hr/recruitment/candidates/:id/close", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { reason: string };
    const c = db.candidates.find((x) => x.id === params.id);
    if (!c) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.reason?.trim()) {
      return HttpResponse.json({ message: "Begrunnelse kreves" }, { status: 422 });
    }

    const now = nowStamp();
    const until = new Date();
    until.setMonth(until.getMonth() + RETENTION_MONTHS);
    c.stageId = "avvist";
    c.nextActivity = undefined;
    c.closure = {
      endedAt: now,
      reason: body.reason.trim(),
      accessRevokedAt: now,
      retentionUntil: until.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" }),
      retentionMonths: RETENTION_MONTHS,
      basis: RETENTION_BASIS,
      minimised: false,
      retained: RETENTION_RETAINED,
      removed: RETENTION_REMOVED,
    };
    c.history.push({
      id: `h-${Date.now()}`,
      at: now,
      actor: "Fredrik Amundsen",
      type: "stage-change",
      stageId: "avvist",
      detail: `Prosessen avsluttet: ${c.closure.reason}`,
    });
    writeAudit({
      actor: "Fredrik Amundsen",
      action: "Avsluttet kandidatprosess",
      area: "Rekruttering",
      affected: c.name,
      before: "aktiv prosess",
      after: `avsluttet — tilgang fjernet, oppbevares til ${c.closure.retentionUntil}`,
    });
    persistDb();
    return HttpResponse.json(c);
  }),

  /** FR-R-10 — carry out the deletion the retention rule promised. */
  http.post("/api/hr/recruitment/candidates/:id/minimise", async ({ params }) => {
    await latency();
    const c = db.candidates.find((x) => x.id === params.id);
    if (!c?.closure) return HttpResponse.json({ message: "Ikke avsluttet" }, { status: 422 });

    c.phone = "—";
    c.email = "—";
    c.history = c.history.filter((h) => h.type !== "note");
    c.closure.minimised = true;
    writeAudit({
      actor: "Fredrik Amundsen",
      action: "Slettet personopplysninger etter oppbevaringstid",
      area: "Rekruttering",
      affected: c.name,
      before: "kontaktopplysninger og fritekstnotater",
      after: "slettet — kun navn, kilde og begrunnelse beholdt",
    });
    persistDb();
    return HttpResponse.json(c);
  }),

  /** FR-I-05 — a rejected row leaves the queue when it is resubmitted. */
  http.post("/api/qc/import/rejected/:id/resubmit", async ({ params }) => {
    await latency();
    const idx = db.rejectedRows.findIndex((r) => r.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const [row] = db.rejectedRows.splice(idx, 1);
    writeAudit({
      actor: "Admin Bruker",
      action: "Sendte inn avvist rad på nytt",
      area: "Import",
      affected: `Rad ${row.row} — ${row.person}`,
      before: row.reason,
      after: "sendt til ny validering",
    });
    persistDb();
    return HttpResponse.json({ ok: true });
  }),

  http.post("/api/qc/corrections/:id/decide", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { outcome: "approved" | "rejected"; note: string };
    const idx = db.corrections.findIndex((c) => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.note?.trim()) {
      return HttpResponse.json({ message: "Begrunnelse kreves" }, { status: 422 });
    }
    const [correction] = db.corrections.splice(idx, 1);
    const decided = {
      ...correction,
      outcome: body.outcome,
      decidedBy: "Admin Bruker",
      decidedAt: nowStamp(),
      decisionNote: body.note.trim(),
    };
    db.decidedCorrections.unshift(decided);

    if (body.outcome === "approved") {
      // The cascade: the correction becomes visible to promoter and customer.
      db.correctionNotices.unshift({
        id: `cn-${Date.now()}`,
        at: nowStamp(),
        summary: correction.description,
      });
    }
    writeAudit({
      actor: "Admin Bruker",
      action: body.outcome === "approved" ? "Godkjente korrigering" : "Avviste korrigering",
      area: "Korrigeringer",
      affected: correction.affectedPeople.join(", ") || "—",
      before: correction.before,
      after:
        body.outcome === "approved"
          ? `${correction.after} — godkjent av Admin Bruker: ${decided.decisionNote}`
          : `uendret — avvist av Admin Bruker: ${decided.decisionNote}`,
    });
    persistDb();
    return HttpResponse.json(decided);
  }),

  http.post("/api/qc/corrections/:id/approve", async ({ params }) => {
    await latency();
    const idx = db.corrections.findIndex((c) => c.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    const [correction] = db.corrections.splice(idx, 1);

    // The cascade: the correction becomes visible to promoter and customer.
    db.correctionNotices.unshift({
      id: `cn-${Date.now()}`,
      at: nowStamp(),
      summary: correction.description,
    });
    writeAudit({
      actor: "Admin Bruker",
      action: "Godkjente korrigering",
      area: "Korrigeringer",
      affected: correction.affectedPeople.join(", ") || "—",
      before: correction.before,
      after: correction.after,
    });
    persistDb();
    return HttpResponse.json({ ok: true, id: correction.id });
  }),

  /**
   * FR-L-13 — adjust one person's target.
   *
   * The band is enforced here as well as in the form, using the same
   * `permittedBand` the form uses. Client-side validation is a courtesy; this is
   * the rule. And a reason is mandatory for the same reason FR-L-07 requires one
   * to reject a suggestion — a target that moved with no recorded why is exactly
   * what a person has no way to challenge later.
   */

  /** FR-L-13 at the sales chief's level — adjust one team's target. */

  /**
   * FR-A-02 / FR-S-04 — grant, revoke or reset one permission for one user.
   *
   * A reason is mandatory on every change. An access grant with no recorded why
   * is the single hardest thing to unpick six months later, and this log is what
   * an audit actually reads.
   */
  http.patch("/api/auth/access/:id", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as {
      permission: string;
      action: "grant" | "revoke" | "reset";
      reason: string;
    };
    const user = db.userAccess.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.reason?.trim()) {
      return HttpResponse.json({ message: "Begrunnelse kreves" }, { status: 422 });
    }
    if (!permissionCatalogue().some((p) => p.key === body.permission)) {
      return HttpResponse.json({ message: "Ukjent tilgang" }, { status: 422 });
    }

    const before = effectivePermissions(user);
    user.granted = user.granted.filter((p) => p !== body.permission);
    user.revoked = user.revoked.filter((p) => p !== body.permission);
    if (body.action === "grant") user.granted.push(body.permission);
    if (body.action === "revoke") user.revoked.push(body.permission);

    if (body.action === "reset") delete user.reasons[body.permission];
    else user.reasons[body.permission] = body.reason.trim();

    const after = effectivePermissions(user);
    writeAudit({
      actor: "Admin Bruker",
      action:
        body.action === "grant"
          ? "Ga tilgang"
          : body.action === "revoke"
            ? "Fjernet tilgang"
            : "Tilbakestilte tilgang",
      area: "Tilganger",
      affected: user.name,
      before: before.join(", ") || "ingen",
      after: `${after.join(", ") || "ingen"} — ${body.reason.trim()}`,
    });
    persistDb();
    return HttpResponse.json(user);
  }),

  /** FR-A-02 — deactivate or reactivate a user account. */
  http.patch("/api/auth/access/:id/active", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { active: boolean; reason: string };
    const user = db.userAccess.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.reason?.trim()) {
      return HttpResponse.json({ message: "Begrunnelse kreves" }, { status: 422 });
    }
    const before = user.active;
    user.active = body.active;
    writeAudit({
      actor: "Admin Bruker",
      action: body.active ? "Aktiverte bruker" : "Deaktiverte bruker",
      area: "Tilganger",
      affected: user.name,
      before: before ? "aktiv" : "deaktivert",
      after: `${body.active ? "aktiv" : "deaktivert"} — ${body.reason.trim()}`,
    });
    persistDb();
    return HttpResponse.json(user);
  }),

  /** FR-A-03 — create a customer account. Creating it does not give anyone a login. */
  http.post("/api/auth/customers", async ({ request }) => {
    await latency();
    const body = (await request.json()) as {
      organisation: string;
      orgNumber: string;
      contactName: string;
      email: string;
      campaigns: string[];
    };
    const missing = ["organisation", "orgNumber", "contactName", "email"].filter(
      (k) => !String((body as Record<string, unknown>)[k] ?? "").trim(),
    );
    if (missing.length) {
      return HttpResponse.json({ message: "Alle feltene må fylles ut" }, { status: 422 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      return HttpResponse.json({ message: "Ugyldig e-postadresse" }, { status: 422 });
    }
    if (db.customerAccounts.some((c) => c.email.toLowerCase() === body.email.toLowerCase())) {
      return HttpResponse.json({ message: "E-postadressen er allerede i bruk" }, { status: 422 });
    }

    const account: CustomerAccount = {
      id: `ca-${db.customerAccounts.length + 1}-${body.orgNumber.replace(/\s/g, "")}`,
      organisation: body.organisation.trim(),
      orgNumber: body.orgNumber.trim(),
      contactName: body.contactName.trim(),
      email: body.email.trim().toLowerCase(),
      campaigns: body.campaigns ?? [],
      provisioned: false,
      provisionedAt: null,
      provisionedBy: null,
      lastLogin: null,
      createdAt: nowStamp().split(",")[0],
      credentialsSentTo: null,
      credentialsSentAt: null,
      // A new account starts on the minimum agreement, not on everything.
      agreement: JSON.parse(JSON.stringify(DEFAULT_AGREEMENT)),
    };
    db.customerAccounts.unshift(account);
    writeAudit({
      actor: "Admin Bruker",
      action: "Opprettet kundekonto",
      area: "Kunder",
      affected: account.organisation,
      after: `${account.contactName}, ${account.email}`,
    });
    persistDb();
    return HttpResponse.json(account, { status: 201 });
  }),

  /** FR-A-03 — provision (or withdraw) the portal login for a customer account. */
  http.post("/api/auth/customers/:id/provision", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { provisioned: boolean };
    const account = db.customerAccounts.find((c) => c.id === params.id);
    if (!account) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });

    account.provisioned = body.provisioned;
    account.provisionedAt = body.provisioned ? nowStamp() : null;
    account.provisionedBy = body.provisioned ? "Admin Bruker" : null;
    // FR-C-12 — credentials are created by hand and delivered by email. The
    // record of that delivery is part of the account, not a side effect nobody
    // can point to afterwards.
    account.credentialsSentTo = body.provisioned ? account.email : null;
    account.credentialsSentAt = body.provisioned ? nowStamp() : null;
    writeAudit({
      actor: "Admin Bruker",
      action: body.provisioned ? "Ga portaltilgang" : "Fjernet portaltilgang",
      area: "Kunder",
      affected: account.organisation,
      before: body.provisioned ? "ingen portaltilgang" : "portaltilgang aktiv",
      after: body.provisioned ? `portaltilgang aktiv for ${account.email}` : "ingen portaltilgang",
    });
    persistDb();
    return HttpResponse.json(account);
  }),

  /**
   * FR-C-07 — change what a customer's agreement lets them see.
   *
   * Every change is audited with before and after (FR-A-08), because this is
   * the endpoint that decides what leaves the company. Widening it is a
   * commercial decision somebody has to be able to point at later.
   */
  http.patch("/api/auth/customers/:id/agreement", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as Partial<CustomerAgreement>;
    const account = db.customerAccounts.find((c) => c.id === params.id);
    if (!account) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });

    const next: CustomerAgreement = { ...account.agreement, ...body };
    if (next.figures.length === 0) {
      return HttpResponse.json(
        { message: "Avtalen må inneholde minst ett tall — ellers får kunden en tom rapport" },
        { status: 422 },
      );
    }
    if (next.granularities.length === 0) {
      return HttpResponse.json(
        { message: "Avtalen må dekke minst én periodeinndeling" },
        { status: 422 },
      );
    }

    const describe = (a: CustomerAgreement) =>
      `${a.figures.length} tall · ${a.fieldworkDetail === "aggregate" ? "innsats vises" : "innsats skjult"} · ${a.granularities.join("/")}${a.costDefinitionAgreed ? " · kostnad avklart" : ""}`;
    const before = describe(account.agreement);
    account.agreement = next;
    writeAudit({
      actor: "Admin Bruker",
      action: "Endret kundeavtale",
      area: "Kunder",
      affected: account.organisation,
      before,
      after: describe(next),
    });
    persistDb();
    return HttpResponse.json(account);
  }),

  http.patch("/api/dashboard/leader/team-goals/:id", async ({ request, params }) => {
    await latency();
    const allowed = callerTeams(request);
    if (!allowed.includes(String(params.id))) {
      return HttpResponse.json({ message: "Du har ikke tilgang til dette teamet" }, { status: 403 });
    }
    const body = (await request.json()) as { target: number; reason: string };
    const row = db.teamGoals.find((g) => g.id === params.id);
    if (!row) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.reason?.trim()) {
      return HttpResponse.json({ message: "Begrunnelse kreves" }, { status: 422 });
    }
    const target = Math.round(Number(body.target));
    if (!withinBand(target, row.baseline, TEAM_GOAL_LIMIT)) {
      const band = permittedBand(row.baseline, TEAM_GOAL_LIMIT);
      return HttpResponse.json(
        { message: `Teammålet må være mellom ${band.min} og ${band.max} for denne perioden` },
        { status: 422 },
      );
    }
    const before = row.target;
    row.target = target;
    row.reason = body.reason.trim();
    row.updatedBy = "Marte Solberg, salgssjef";
    row.updatedAt = nowStamp();
    // Team Vest's target is what the team lead's own Mål screen distributes.
    if (row.id === "t1") db.leaderGoal.target = target;
    writeAudit({
      actor: "Marte Solberg",
      action: "Justerte teammål",
      area: "Mål",
      affected: teamName(row.id),
      before: String(before),
      after: `${target} — ${row.reason}`,
    });
    persistDb();
    return HttpResponse.json(orgGoalPlan(allowed).teams.find((t) => t.id === row.id));
  }),

  http.patch("/api/dashboard/leader/goal-plan/:id", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { target: number; reason: string };
    const row = db.personGoals.find((p) => p.id === params.id);
    if (!row) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });

    if (!body.reason?.trim()) {
      return HttpResponse.json({ message: "Begrunnelse kreves" }, { status: 422 });
    }
    const target = Math.round(Number(body.target));
    if (!withinBand(target, row.baseline, GOAL_LIMIT)) {
      const band = permittedBand(row.baseline, GOAL_LIMIT);
      return HttpResponse.json(
        { message: `Målet må være mellom ${band.min} og ${band.max} for denne perioden` },
        { status: 422 },
      );
    }

    const before = row.target;
    row.target = target;
    row.reason = body.reason.trim();
    row.updatedBy = "Ola Nordmann, teamleder";
    row.updatedAt = nowStamp();

    // The cascade that makes this real: the promoter's own Mål screen is the
    // same target. A leader adjusting a figure the person never sees change
    // would make the closed loop a lie.
    if (row.person === "Kari Nordmann") {
      db.promoterGoal.target = target;
      db.promoterGoal.setBy = "Ola Nordmann, teamleder";
    }

    writeAudit({
      actor: "Ola Nordmann",
      action: "Justerte mål",
      area: "Mål",
      affected: row.person,
      before: String(before),
      after: `${target} — ${row.reason}`,
    });
    persistDb();
    return HttpResponse.json(row);
  }),

  http.patch("/api/hr/measures/:id/close", async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { outcomeNote: string };
    const measure = db.measures.find((m) => m.id === params.id);
    if (!measure) return HttpResponse.json({ message: "Ikke funnet" }, { status: 404 });
    if (!body.outcomeNote?.trim()) {
      return HttpResponse.json({ message: "Sluttnotat kreves" }, { status: 422 });
    }
    measure.status = "closed";
    measure.outcomeNote = body.outcomeNote;
    writeAudit({
      actor: "Ola Nordmann",
      action: "Lukket tiltak",
      area: "Tiltak",
      affected: measure.person,
      after: body.outcomeNote,
    });
    persistDb();
    return HttpResponse.json(measure);
  }),
];
