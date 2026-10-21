import { delay, http, HttpResponse, type JsonBodyType } from "msw";
import { MOCK_USERS } from "@/lib/mock-users";
import { db, persistDb } from "./db";
import { buildDashboard } from "./srs-dashboard";
import { DEMO_TODAY, isoDay, LEADERS } from "./srs-seed";
import type { Shift, SwapRequest, Forecast } from "@/types/schedule";
import type { LeaderTask, ResponseField } from "@/types/task";

/**
 * MOCK of recruitment-service's staffing / tasks / dashboard (A5), same paths and
 * shapes as the real API (types/schedule.ts, task.ts, recruitment-dashboard.ts), so
 * NEXT_PUBLIC_DATA_SOURCE=mock keeps every A5 screen working for demos and tests.
 *
 * It mirrors the server's rules where a demo would otherwise lie: attendance is
 * refused in the future, «møtt» is refused until the contract is signed, a swap
 * changes nothing until the leader approves, and «forfalt» is derived.
 */
const R = "/api/recruitment";
const TODAY = isoDay(DEMO_TODAY);

async function latency() {
  await delay(150 + Math.round(Math.random() * 250));
}

function scenario(request: Request) {
  return new URL(request.url).searchParams.get("scenario");
}

function get<T extends JsonBodyType>(path: string, resolve: (req: Request) => T, emptyValue?: T) {
  return http.get(path, async ({ request }) => {
    await latency();
    if (scenario(request) === "error") return HttpResponse.json({ message: "Simulert feil" }, { status: 500 });
    if (scenario(request) === "empty" && emptyValue !== undefined) return HttpResponse.json(emptyValue);
    return HttpResponse.json(resolve(request));
  });
}

function refuse(status: number, message: string, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ message, code, ...extra }, { status });
}

/** The demo caller, from the mock bearer token (never from a query parameter). */
function caller(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  try {
    const { userKey } = JSON.parse(atob(token ?? "")) as { userKey?: string };
    return (userKey && MOCK_USERS[userKey]) || null;
  } catch {
    return null;
  }
}

const isPromoter = (request: Request) => caller(request)?.role === "Promoter";

/** The promoter demo user is not in the generated staff list; she stands in for its first person. */
function myEmployeeId(request: Request) {
  const name = caller(request)?.name;
  const own = db.shifts.find((s) => s.employeeName === name);
  return own?.employeeId ?? db.shifts[0]?.employeeId;
}

function myLeaderName(request: Request) {
  const name = caller(request)?.name ?? "";
  return db.leaderTasks.some((t) => t.leaderName === name) ? name : LEADERS[0];
}

function withOverdue(t: LeaderTask): LeaderTask {
  return { ...t, overdue: t.status === "apen" && t.dueAt < new Date(`${TODAY}T23:59:59`).toISOString() };
}

const shift = (id: string) => db.shifts.find((s) => s.id === id);

export const a5Handlers = [
  // ── staffing ───────────────────────────────────────────────────────────────
  get(`${R}/staffing/days/`, (request) => {
    const q = new URL(request.url).searchParams;
    const from = q.get("from") ?? "0000", to = q.get("to") ?? "9999";
    let rows: Shift[] = db.shifts.filter((s) => s.date >= from && s.date <= to);
    if (isPromoter(request)) {
      const me = myEmployeeId(request);
      const mine = rows.filter((s) => s.employeeId === me);
      if (!q.get("swap_targets")) return mine;
      const teams = new Set(mine.map((s) => s.teamId));
      const targets = rows
        .filter((s) => s.employeeId !== me && teams.has(s.teamId) && s.kind === "arbeid" && s.date > TODAY)
        .map(({ id, personRef, employeeId, employeeName, teamId, team, date, kind, source, swapPending, swapState }) =>
          ({ id, personRef, employeeId, employeeName, teamId, team, date, kind, source, swapPending, swapState }));
      return [...mine, ...targets] as Shift[];
    }
    if (q.get("team_id")) rows = rows.filter((s) => s.teamId === q.get("team_id"));
    if (q.get("user_id")) rows = rows.filter((s) => s.employeeId === q.get("user_id"));
    return rows;
  }, []),

  http.post(`${R}/staffing/days/:id/attendance/`, async ({ request, params }) => {
    await latency();
    const body = (await request.json()) as { status: "mott" | "ikke-mott"; reason?: string };
    const s = shift(String(params.id));
    if (!s) return refuse(404, "Fant ikke vakten.", "not_found");
    if (s.kind !== "arbeid") return refuse(409, "Oppmøte registreres bare på arbeidsdager.", "not_a_working_day");
    if (s.date > TODAY) return refuse(409, "Oppmøte kan ikke registreres før dagen er kommet.", "future");
    if (body.status === "mott" && s.clearance && !s.clearance.cleared) {
      return refuse(409, "Kan ikke registreres som møtt før kontrakten er signert.", "not_cleared",
        { reasons: s.clearance.reasons });
    }
    const current = s.attendance === "mott" || s.attendance === "ikke-mott" ? s.attendance : null;
    if (current && current !== body.status && !body.reason?.trim()) {
      return refuse(422, "Skriv hvorfor oppmøtet rettes.", "reason_required", { errors: { reason: "Påkrevd ved retting" } });
    }
    if (current !== body.status) {
      s.attendanceHistory = [...(s.attendanceHistory ?? []), { status: body.status, at: new Date().toISOString(),
        by: caller(request)?.name ?? "Leder", reason: body.reason?.trim() || null, correction: Boolean(current) }];
      s.attendance = body.status;
    }
    persistDb();
    return HttpResponse.json(s);
  }),

  http.post(`${R}/staffing/days/:id/follow-up/`, async ({ request, params }) => {
    await latency();
    const { note } = (await request.json()) as { note: string };
    const s = shift(String(params.id));
    if (!s) return refuse(404, "Fant ikke vakten.", "not_found");
    if (s.attendance !== "ikke-mott") return refuse(409, "Bare fravær kan følges opp.", "not_absent");
    if ((note ?? "").trim().length < 3) return refuse(422, "Skriv hva som ble gjort.", "note_required", { errors: { note: "Minst 3 tegn" } });
    const fu = { at: new Date().toISOString(), by: caller(request)?.name ?? "Leder", note: note.trim() };
    s.followUps = [...(s.followUps ?? []), fu];
    s.followUp = fu;
    persistDb();
    return HttpResponse.json(s);
  }),

  http.patch(`${R}/staffing/days/:id/`, async ({ request, params }) => {
    await latency();
    const { kind } = (await request.json()) as { kind: Shift["kind"] };
    const s = shift(String(params.id));
    if (!s) return refuse(404, "Fant ikke vakten.", "not_found");
    if (isPromoter(request) && (kind !== "syk" || s.date < TODAY)) {
      return refuse(403, "Du kan bare melde deg syk for i dag eller fremover.", "not_allowed");
    }
    s.kind = kind;
    if (kind !== "arbeid") s.attendance = null;
    else if (!s.attendance) s.attendance = "planlagt";
    persistDb();
    return HttpResponse.json(s);
  }),

  get(`${R}/staffing/swaps/`, (request) => {
    if (!isPromoter(request)) return db.swapRequests;
    const me = myEmployeeId(request);
    return db.swapRequests.filter((r) => r.fromEmployeeId === me || r.toEmployeeId === me);
  }, []),

  http.post(`${R}/staffing/swaps/`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as { fromShiftId: string; toShiftId: string; reason: string };
    const from = shift(body.fromShiftId), to = shift(body.toShiftId);
    if (!from || !to) return refuse(404, "Ukjent vakt.", "not_found");
    if ((body.reason ?? "").trim().length < 3) return refuse(422, "Skriv en kort begrunnelse.", "reason_required");
    if (from.swapPending || to.swapPending) return refuse(409, "En av vaktene har allerede en åpen bytteforespørsel.", "already_pending");
    const req: SwapRequest = {
      id: `sw-${Date.now()}`, fromEmployee: from.employeeName, fromEmployeeId: from.employeeId, toEmployee: to.employeeName,
      toEmployeeId: to.employeeId, teamId: from.teamId, fromShiftId: from.id, toShiftId: to.id, fromDate: from.date,
      toDate: to.date, reason: body.reason.trim(), status: "venter_kollega", requestedAt: new Date().toISOString(),
      counterpartRespondedAt: null, counterpartComment: null, decidedAt: null, decidedBy: null, decisionComment: null,
    };
    db.swapRequests.unshift(req);
    from.swapPending = to.swapPending = true;
    from.swapState = to.swapState = "pending";
    persistDb();
    return HttpResponse.json(req, { status: 201 });
  }),

  http.post(`${R}/staffing/swaps/:id/respond/`, async ({ request, params }) => {
    await latency();
    const { accept, comment } = (await request.json()) as { accept: boolean; comment?: string };
    const req = db.swapRequests.find((r) => r.id === params.id);
    if (!req) return refuse(404, "Fant ikke forespørselen.", "not_found");
    if (req.status !== "venter_kollega") return refuse(409, "Forespørselen venter ikke på svar fra deg.", "not_waiting");
    req.status = accept ? "venter_leder" : "avslatt_kollega";
    req.counterpartRespondedAt = new Date().toISOString();
    req.counterpartComment = comment || null;
    if (!accept) for (const s of [shift(req.fromShiftId), shift(req.toShiftId)]) if (s) { s.swapPending = false; s.swapState = "none"; }
    persistDb();
    return HttpResponse.json(req);
  }),

  /** BEM-07 — only the leader's approval changes either day. */
  http.post(`${R}/staffing/swaps/:id/decide/`, async ({ request, params }) => {
    await latency();
    const { approve, comment } = (await request.json()) as { approve: boolean; comment?: string };
    const req = db.swapRequests.find((r) => r.id === params.id);
    if (!req) return refuse(404, "Fant ikke forespørselen.", "not_found");
    if (req.status !== "venter_leder") return refuse(409, "Forespørselen venter ikke på lederens avgjørelse.", "not_waiting");
    const from = shift(req.fromShiftId), to = shift(req.toShiftId);
    req.status = approve ? "godkjent" : "avvist_leder";
    req.decidedAt = new Date().toISOString();
    req.decidedBy = caller(request)?.name ?? "Leder";
    req.decisionComment = comment || null;
    if (from && to) {
      if (approve) {
        const a = { id: from.employeeId, name: from.employeeName };
        from.employeeId = to.employeeId; from.employeeName = to.employeeName; from.personRef = { kind: "user", id: to.employeeId };
        to.employeeId = a.id; to.employeeName = a.name; to.personRef = { kind: "user", id: a.id };
        from.source = to.source = "swap";
      }
      from.swapPending = to.swapPending = false;
      from.swapState = to.swapState = approve ? "swapped" : "none";
    }
    persistDb();
    return HttpResponse.json(req);
  }),

  http.post(`${R}/staffing/swaps/:id/withdraw/`, async ({ params }) => {
    await latency();
    const req = db.swapRequests.find((r) => r.id === params.id);
    if (!req) return refuse(404, "Fant ikke forespørselen.", "not_found");
    if (req.status !== "venter_kollega" && req.status !== "venter_leder") return refuse(409, "Forespørselen er allerede avgjort.", "not_open");
    req.status = "trukket";
    for (const s of [shift(req.fromShiftId), shift(req.toShiftId)]) if (s) { s.swapPending = false; s.swapState = "none"; }
    persistDb();
    return HttpResponse.json(req);
  }),

  /** BEM-03 — same model as the server: history rate, shrunk towards the team, a range, the basis. */
  http.get(`${R}/staffing/forecast/`, async ({ request }) => {
    await latency();
    if (isPromoter(request)) return refuse(403, "Du har ikke tilgang til prognosen.", "permission_denied");
    if (scenario(request) === "empty") return HttpResponse.json([]);
    const target = Number(new URL(request.url).searchParams.get("target")) || null;
    const teams = [...new Set(db.shifts.map((s) => s.teamId))];
    const rows = teams.map((teamId): Forecast => {
      const rows = db.shifts.filter((s) => s.teamId === teamId);
      const past = rows.filter((s) => s.date < TODAY && s.kindAtPlan === "arbeid");
      const attended = past.filter((s) => s.attendance === "mott").length;
      const lost = past.filter((s) => s.attendance === "ikke-mott" || s.kind === "syk").length;
      const basis = attended + lost;
      const rate = (attended + 1) / (basis + 2);
      const planned = rows.filter((s) => s.date >= TODAY && s.kind === "arbeid").length;
      const expected = planned * rate;
      const spread = Math.sqrt(planned * rate * (1 - rate) + (planned * planned * rate * (1 - rate)) / (basis + 10));
      return {
        teamId, team: rows[0]?.team ?? teamId, plannedDays: planned, expectedDays: Math.round(expected * 10) / 10,
        expectedLow: Math.max(0, Math.round(expected - 1.28 * spread)), expectedHigh: Math.min(planned, Math.round(expected + 1.28 * spread)),
        showRate: rate, basisDays: basis, reliable: basis >= 20, windowWeeks: 12,
        neededForTarget: target ? Math.ceil(target / rate) : null,
        explanation: "Forventet = planlagte arbeidsdager × hvor ofte hver person faktisk har møtt de siste 12 ukene. Det de selv har oppgitt som tilgjengelighet, teller ikke med.",
      };
    }).sort((a, b) => a.team.localeCompare(b.team, "nb"));
    return HttpResponse.json(rows);
  }),

  get(`${R}/staffing/behind-plan/`, () => {
    const by = new Map<string, { name: string; teamId: string; planned: number; missed: number }>();
    for (const s of db.shifts) {
      if (s.kind !== "arbeid" || s.date >= TODAY) continue;
      const cur = by.get(s.employeeId) ?? { name: s.employeeName, teamId: s.teamId, planned: 0, missed: 0 };
      cur.planned += 1;
      if (s.attendance === "ikke-mott") cur.missed += 1;
      by.set(s.employeeId, cur);
    }
    return [...by.entries()].filter(([, v]) => v.missed >= 2).map(([userId, v]) => ({
      userId, ...v,
      body: `Hei ${v.name.split(" ")[0]}! Du har ikke møtt ${v.missed} av ${v.planned} planlagte dager de siste fire ukene. Si fra til lederen din hvis noe står i veien — vi finner en løsning.`,
    }));
  }, []),

  // ── tasks ──────────────────────────────────────────────────────────────────
  get(`${R}/tasks/`, (request) => {
    const q = new URL(request.url).searchParams;
    const leader = myLeaderName(request);
    let rows = db.leaderTasks.map(withOverdue).filter((t) => t.leaderName === leader);
    if (q.get("status") === "forfalt") rows = rows.filter((t) => t.overdue);
    else if (q.get("status")) rows = rows.filter((t) => t.status === q.get("status"));
    return rows.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, []),

  http.post(`${R}/tasks/`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as { title: string; detail?: string; dueAt: string; responseSchema?: ResponseField[] };
    const leaderName = myLeaderName(request);
    const t: LeaderTask = {
      id: `tk-${Date.now()}`, leaderId: `leader-${leaderName}`, leaderName, kind: "egen", kindLabel: "Egen oppgave",
      source: "egen", title: body.title, detail: body.detail ?? "", relatedCandidateId: null, dueAt: body.dueAt,
      status: "apen", overdue: false, answerable: true, responseSchema: body.responseSchema ?? [], response: null,
      completedAt: null, closedReason: null, payload: {},
    };
    db.leaderTasks.unshift(t);
    persistDb();
    return HttpResponse.json(t, { status: 201 });
  }),

  http.post(`${R}/tasks/:id/complete/`, async ({ request, params }) => {
    await latency();
    const { response } = (await request.json()) as { response: { key: string; value: unknown }[] };
    const t = db.leaderTasks.find((x) => x.id === params.id);
    if (!t) return refuse(404, "Fant ikke oppgaven.", "not_found");
    if (t.status !== "apen") return refuse(409, "Oppgaven er allerede lukket.", "not_open");
    if (!t.answerable) return refuse(409, "Denne oppgaven lukkes når handlingen er gjort — åpne skjemaet fra oppgaven.", "not_answerable");
    const schema = t.responseSchema.length ? t.responseSchema : [{ key: "svar", label: "Svar", type: "text", required: true } as ResponseField];
    const given = Object.fromEntries((response ?? []).map((r) => [r.key, r.value]));
    const errors: Record<string, string> = {};
    for (const f of schema) {
      const v = given[f.key];
      if (f.required && (v === undefined || v === null || (typeof v === "string" && !v.trim()))) errors[f.key] = "Må fylles ut";
    }
    if (Object.keys(errors).length) return refuse(422, "Svaret mangler eller har feil i noen felt.", "invalid_response", { errors });
    t.status = "fullfort";
    t.closedReason = "svar";
    t.response = schema.filter((f) => given[f.key] !== undefined).map((f) => ({ key: f.key, value: given[f.key] }));
    t.completedAt = new Date().toISOString();
    persistDb();
    return HttpResponse.json(withOverdue(t));
  }),

  get(`${R}/tasks/compliance/`, () => {
    const by = new Map<string, { open: number; onTime: number; late: number; overdue: number; cancelled: number }>();
    for (const t0 of db.leaderTasks) {
      const t = withOverdue(t0);
      const cur = by.get(t.leaderName) ?? { open: 0, onTime: 0, late: 0, overdue: 0, cancelled: 0 };
      if (t.status === "kansellert") cur.cancelled += 1;
      else if (t.status === "fullfort") cur[t.completedAt && t.completedAt > t.dueAt ? "late" : "onTime"] += 1;
      else if (t.overdue) cur.overdue += 1;
      else cur.open += 1;
      by.set(t.leaderName, cur);
    }
    return [...by.entries()].map(([leader, v]) => {
      const judged = v.onTime + v.late + v.overdue;
      return { leaderId: `leader-${leader}`, leader, ...v, completed: v.onTime + v.late,
        rate: judged === 0 ? null : (v.onTime + v.late) / judged };
    }).sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2) || b.overdue - a.overdue);
  }, []),

  // ── dashboard ──────────────────────────────────────────────────────────────
  get(`${R}/dashboard/recruitment/`, (request) => buildDashboard(new URL(request.url))),

  get(`${R}/dashboard/filters/`, () => ({
    channels: ["meta", "tiktok", "finn", "nav", "indeed", "nettside", "stand"].map((key) => ({
      key, name: key === "tiktok" ? "TikTok" : key.charAt(0).toUpperCase() + key.slice(1),
      kind: key === "stand" ? "stand" : key === "meta" || key === "tiktok" ? "betalt" : "organisk" })),
    teams: [...new Map(db.shifts.map((s) => [s.teamId, s.team])).entries()].map(([id, name], i) => ({
      id, name, region: ["Oslo", "Bergen", "Trondheim", "Stavanger"][i % 4] })),
    regions: ["Bergen", "Oslo", "Stavanger", "Trondheim"],
  })),

  get(`${R}/dashboard/kpi-definitions/`, () => [
    { key: "no_show_interview", label: "Ikke møtt til intervju", srs: "DASH-02", version: "mock",
      rule: "Teller: overganger til «No show» med kontekst intervju. Nevner: samme pluss «Intervjuet». Avlyst i forkant teller ikke.",
      source: "Statuslogg", common: "Duplikater og importerte kandidater telles ikke." },
  ], []),

  get(`${R}/dashboard/subscription/`, () => db.reportSubscription),
  http.put(`${R}/dashboard/subscription/`, async ({ request }) => {
    await latency();
    const body = (await request.json()) as { enabled: boolean; frequency: "ukentlig" | "manedlig"; filters?: Record<string, unknown> };
    db.reportSubscription = { ...db.reportSubscription, enabled: body.enabled, frequency: body.frequency, filters: body.filters ?? {} };
    persistDb();
    return HttpResponse.json(db.reportSubscription);
  }),
];
