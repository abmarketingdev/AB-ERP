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
    c.stageId = "avsluttet";
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
      stageId: "avsluttet",
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
