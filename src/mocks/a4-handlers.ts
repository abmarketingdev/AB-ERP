import { http, HttpResponse, delay, type JsonBodyType } from "msw";
import { db, persistDb } from "./db";
import { writeAudit } from "./handlers";
import { DEMO_TODAY, LEADERS, TEAMS_SRS } from "./srs-seed";
import { newHireSchema, type NewHire } from "@/types/onboarding";
import type { ApprovalRequest, TemplateMapping } from "@/types/approval";

/**
 * Mock of recruitment-service `approvals` + `onboarding_bridge` (A4), same paths and shapes
 * as the real API (types/approval.ts, types/onboarding.ts), and the same refusals: the
 * gate (GODK-03) and the start rule (ONB-03) hold in mock mode too, so a demo never shows
 * something the real system would refuse.
 */

const R = "/api/recruitment";
const OLE = "Ole Marius Sormbråten";
const TEAMS = TEAMS_SRS.map((name, i) => ({ id: `team-${i + 1}`, name }));
const CAMPAIGNS = [
  { id: "camp-nf", name: "Norsk Folkehjelp" },
  { id: "camp-nrc", name: "Flyktninghjelpen (NRC)" },
  { id: "camp-care", name: "CARE Norge" },
];
const LEADER_LEVEL_CAMPAIGNS = new Set(["camp-nf", "camp-nrc"]);

async function latency() {
  await delay(150 + Math.round(Math.random() * 250));
}
// Mock dates are relative to the real today (designreview: a seed anchored to a fixed day
// shows «oppstart for 60 dager siden» a month later). The shared seed is anchored to
// DEMO_TODAY, so the hires it builds are shifted by the same distance.
const DAY = 86_400_000;
const today = () => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; };
const rel = (days: number) => new Date(today().getTime() + days * DAY);
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const SHIFT = today().getTime() - DEMO_TODAY.getTime();
const shift = (v: string | null) => (v ? new Date(new Date(v).getTime() + SHIFT).toISOString() : v);
const shiftDay = (v: string) => isoDay(new Date(new Date(v).getTime() + SHIFT));

function shiftHire(h: NewHire): NewHire {
  return {
    ...h, startDate: shiftDay(h.startDate), completedAt: shift(h.completedAt),
    checklist: h.checklist.map((c) => ({ ...c, at: shift(c.at) })),
    contract: { ...h.contract, sentAt: shift(h.contract.sentAt), seenAt: shift(h.contract.seenAt), signedAt: shift(h.contract.signedAt) },
    contracts: h.contracts.map((c) => ({ ...c, sentAt: shift(c.sentAt), seenAt: shift(c.seenAt), signedAt: shift(c.signedAt) })),
    photo: h.photo ? { ...h.photo, uploadedAt: shift(h.photo.uploadedAt)! } : null,
    equipment: h.equipment.map((e) => ({ ...e, handedOutAt: shift(e.handedOutAt)! })),
    equipmentContract: { ...h.equipmentContract, sentAt: shift(h.equipmentContract.sentAt), signedAt: shift(h.equipmentContract.signedAt) },
    firstDayNoShow: h.firstDayNoShow ? { ...h.firstDayNoShow, at: shift(h.firstDayNoShow.at) } : null,
  };
}

/** The demo scenarios the shell carries through (?scenario=…), so every one of the five
 *  mandatory states (02-design-system) can be shown on these screens. */
type Scenario = "loading" | "error" | "empty" | "partial" | null;
function scenarioOf(request: Request): Scenario {
  const s = new URL(request.url).searchParams.get("scenario");
  return s === "loading" || s === "error" || s === "empty" || s === "partial" ? s : null;
}
/** Applies loading / error / empty; returns a Response to short-circuit, or null. */
async function scenarioGate(request: Request, empty: JsonBodyType): Promise<Response | null> {
  const s = scenarioOf(request);
  if (s === "loading") { await delay(120_000); return null; }
  if (s === "error") return HttpResponse.json({ message: "Simulert feil" }, { status: 500 });
  if (s === "empty") return HttpResponse.json(empty);
  return null;
}
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
const refuse = (status: number, code: string, message: string, errors?: Record<string, string[]>) =>
  HttpResponse.json({ code, message, ...(errors ? { errors } : {}) }, { status });

// ── seed ────────────────────────────────────────────────────────────────────

type Store = { approvals: ApprovalRequest[]; templates: TemplateMapping[]; hires: NewHire[]; deputy: {
  deputy: string | null; deputyUserId: string | null; from: string | null; to: string | null; setAt: string | null;
} };

function seedApprovals(): ApprovalRequest[] {
  const queue = db.candidates.filter((c) => c.stageId === "til-godkjenning");
  return queue.map((c, i) => {
    const submitted = rel(-(i * 2 + 1));
    const start = rel(i === 0 ? 2 : 9 + i * 4);
    const level = i % 3 === 1 ? "senior" : "junior";
    return {
      id: `appr-${c.id}`, round: 1, status: "pending",
      candidate: { id: c.id, name: c.name, phone: c.phone, status: "til-godkjenning" },
      email: c.email, contractKinds: ["ansettelse", "prosjekt"], startDate: isoDay(start),
      team: TEAMS[i % TEAMS.length], campaign: CAMPAIGNS[i % CAMPAIGNS.length], positionLevel: level,
      workDays: i % 2 ? [1, 2, 3, 4, 5] : [1, 3, 5], positionPercentage: i % 2 ? 100 : 60, isStudent: i % 2 === 0,
      note: i === 0 ? "Har jobbet på stand for oss i sommer. Klar til å starte raskt." : "",
      submittedBy: { id: `leader-${i}`, name: LEADERS[i % LEADERS.length] },
      submittedAt: submitted.toISOString(), decision: null,
      waitingDays: daysBetween(submitted, today()), daysToStart: daysBetween(today(), start),
      overdue: daysBetween(submitted, today()) >= 3 || daysBetween(today(), start) <= 2,
      remindersSent: daysBetween(submitted, today()) >= 3 ? 1 : 0,
      interview: { id: `int-${c.id}`, rating: 4 - (i % 2), recommend: true,
                   assessment: i === 0 ? "Trygg, blid og tydelig. God på å lytte." : null, leader: LEADERS[i % LEADERS.length] },
    } satisfies ApprovalRequest;
  });
}

function seedTemplates(): TemplateMapping[] {
  const rows: [string, string, string, string][] = [
    ["ansettelse", "", "", "9222115557590686491"], ["bil", "", "", "9222115557546208282"],
    ["utstyr", "", "", "9222115557590820283"], ["prosjekt", "nf", "", "9222115557572213277"],
    ["prosjekt", "nrc", "", "9222115557541229062"], ["prosjekt", "care", "", "9222115557574264561"],
    ["prosjekt", "nf", "senior", "9222115557572299001"], ["prosjekt", "nrc", "teamleader", "9222115557541299002"],
  ];
  return rows.map(([kind, campaignSlug, level, templateId], i) => ({
    id: `tpl-${i + 1}`, kind, campaignSlug, level, templateId, version: 1, status: "active", note: "Seedet fra kodekonstantene",
    createdByName: "", createdAt: rel(-60).toISOString(), notifiedAt: null, notifiedTo: [], acknowledgedAt: null,
    acknowledgedByName: "", activatedAt: rel(-60).toISOString(), retiredAt: null,
  }));
}

const KEY = "a4";
function store(): Store {
  const anyDb = db as unknown as Record<string, Store | undefined>;
  if (!anyDb[KEY]) {
    anyDb[KEY] = { approvals: seedApprovals(), templates: seedTemplates(), hires: db.newHires.map(shiftHire),
                   deputy: { deputy: null, deputyUserId: null, from: null, to: null, setAt: null } };
  }
  return anyDb[KEY]!;
}
const save = () => persistDb();

// ── helpers ─────────────────────────────────────────────────────────────────

function hireFromApproval(a: ApprovalRequest): NewHire {
  const now = new Date().toISOString();
  return newHireSchema.parse({
    id: `nh-${a.candidate.id}`, candidateId: a.candidate.id, name: a.candidate.name, phone: a.candidate.phone,
    email: a.email, campaign: a.campaign.name, team: a.team.name, startDate: a.startDate, registeredBy: a.submittedBy.name,
    checklist: ["personalia", "kontrakt", "utstyr", "bilde", "opplaering", "forstedag"].map((key) => ({
      key, done: false, at: null, source: key === "personalia" ? "manual" : "system", manual: key === "personalia" })),
    contract: { id: `c-${a.id}-1`, kind: "ansettelse", status: "sendt", templateId: "9222115557590686491", sentAt: now,
                seenAt: null, signedAt: null, remindersSent: 0 },
    contracts: a.contractKinds.map((kind, i) => ({ id: `c-${a.id}-${i + 1}`, kind, status: "sendt",
      templateId: kind === "ansettelse" ? "9222115557590686491" : "9222115557572213277", sentAt: now, seenAt: null,
      signedAt: null, remindersSent: 0 })),
    photo: null, equipment: [], equipmentContract: { status: "ikke-sendt", sentAt: null, signedAt: null },
    firstDayNoShow: null, completedAt: null, status: "in_progress", positionLevel: a.positionLevel,
    manualAccount: ["teamleader", "sales_manager", "teamleder_trainee"].includes(a.positionLevel),
    blockedReasons: [{ code: "kontrakt_ikke_signert", label: "Kontrakten er ikke signert." }],
    hrSync: { state: "ok", at: now, error: null },
    timeline: [{ at: now, kind: "approved", actor: OLE, payload: {} }, { at: now, kind: "contract_sent", actor: null, payload: {} }],
  });
}

function recompute(h: NewHire) {
  const signed = (h.contracts.length ? h.contracts : [h.contract]).every((c) => c.status === "signert");
  const set = (key: string, done: boolean) => {
    const item = h.checklist.find((c) => c.key === key);
    if (item && item.done !== done) { item.done = done; item.at = done ? new Date().toISOString() : null; }
  };
  set("kontrakt", signed);
  set("bilde", !!h.photo);
  set("utstyr", h.equipment.length > 0 && h.equipmentContract.status === "signert");
  h.blockedReasons = signed ? [] : [{ code: "kontrakt_ikke_signert", label: "Kontrakten er ikke signert." }];
  if (h.status === "in_progress" && h.checklist.every((c) => c.done)) h.status = "ready";
  if (h.status === "ready" && !h.checklist.every((c) => c.done)) h.status = "in_progress";
}

const findHire = (id: string) => store().hires.find((h) => h.id === id);

// ── handlers ────────────────────────────────────────────────────────────────

export const a4Handlers = [
  // GODK-01..05
  http.get(`${R}/approval/requests/`, async ({ request }) => {
    await latency();
    const gate = await scenarioGate(request, []);
    if (gate) return gate;
    const status = new URL(request.url).searchParams.get("status");
    const rows = store().approvals.filter((a) => !status || a.status === status);
    return HttpResponse.json(rows);
  }),

  http.get(`${R}/approval/form-options/`, async ({ request }) => {
    await latency();
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId") ?? "";
    const cand = db.candidates.find((c) => c.id === url.searchParams.get("candidateId"));
    const levels = [{ key: "junior", label: "Junior", leader: false, manualAccount: false },
                    { key: "senior", label: "Senior", leader: false, manualAccount: false }];
    if (LEADER_LEVEL_CAMPAIGNS.has(campaignId)) levels.push({ key: "teamleader", label: "Teamleder", leader: true, manualAccount: true });
    return HttpResponse.json({
      teams: TEAMS, campaigns: CAMPAIGNS, levels: campaignId ? levels : levels.slice(0, 1),
      contractKinds: [{ key: "ansettelse", label: "Ansettelseskontrakt" }, { key: "prosjekt", label: "Prosjektavtale" },
                      { key: "bil", label: "Bilavtale" }, { key: "utstyr", label: "Utstyrsavtale" }],
      weekdays: ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"].map((label, i) => ({ key: i + 1, label })),
      prefill: cand ? { email: cand.email, campaignId: null, interview: { rating: 4, recommend: true } } : {},
    });
  }),

  http.post(`${R}/approval/requests/`, async ({ request }) => {
    await latency();
    const b = (await request.json()) as Record<string, unknown>;
    const cand = db.candidates.find((c) => c.id === b.candidateId);
    if (!cand) return refuse(404, "not_found", "Fant ikke kandidaten.");
    if (cand.stageId !== "intervjuet") return refuse(409, "wrong_status", "Kandidaten må være intervjuet før godkjenning.");
    const pct = Number(b.positionPercentage);
    if (!(pct >= 1 && pct <= 100)) return refuse(400, "invalid", "Skjemaet har feil.", { positionPercentage: ["Mellom 1 og 100."] });
    const team = TEAMS.find((t) => t.id === b.teamId)!;
    const campaign = CAMPAIGNS.find((c) => c.id === b.campaignId)!;
    const start = new Date(String(b.startDate));
    const req: ApprovalRequest = {
      id: `appr-${cand.id}-${Date.now()}`, round: 1, status: "pending",
      candidate: { id: cand.id, name: cand.name, phone: cand.phone, status: "til-godkjenning" },
      email: String(b.email), contractKinds: b.contractKinds as string[], startDate: String(b.startDate), team, campaign,
      positionLevel: String(b.positionLevel), workDays: b.workDays as number[], positionPercentage: pct,
      isStudent: Boolean(b.isStudent), note: String(b.note ?? ""), submittedBy: { id: "me", name: cand.owner },
      submittedAt: new Date().toISOString(), decision: null, waitingDays: 0, daysToStart: daysBetween(today(), start),
      overdue: daysBetween(today(), start) <= 2, remindersSent: 0, interview: null,
    };
    store().approvals.unshift(req);
    cand.stageId = "til-godkjenning";
    writeAudit({ actor: cand.owner, action: "Sendte kandidat til godkjenning", area: "Godkjenning", affected: cand.name,
                 before: "Intervjuet", after: "Til godkjenning" });
    save();
    return HttpResponse.json(req, { status: 201 });
  }),

  http.post(`${R}/approval/requests/:id/decision/`, async ({ request, params }) => {
    await latency();
    const b = (await request.json()) as { decision: string; comment?: string };
    const req = store().approvals.find((a) => a.id === params.id);
    if (!req) return refuse(404, "not_found", "Ikke funnet.");
    if (req.status !== "pending") return refuse(409, "not_pending", "Godkjenningen er allerede behandlet.");
    const comment = (b.comment ?? "").trim();
    if (b.decision !== "godkjent" && !comment) {
      return refuse(400, "comment_required", "Skriv en begrunnelse.", { comment: ["Begrunnelse er påkrevd ved avvisning."] });
    }
    const map = { godkjent: "approved", avvist: "rejected", "sendt-tilbake": "returned" } as const;
    const decision = map[b.decision as keyof typeof map];
    req.status = decision;
    req.decision = { decision, comment, decidedBy: OLE, decidedAt: new Date().toISOString(), asDeputy: false };
    const cand = db.candidates.find((c) => c.id === req.candidate.id);
    const next = { approved: "godkjent", rejected: "avvist", returned: "intervjuet" }[decision];
    if (cand) cand.stageId = next;
    req.candidate.status = next;
    if (decision === "approved" && !findHire(`nh-${req.candidate.id}`)) {
      store().hires.unshift(hireFromApproval(req));
      if (cand) cand.stageId = "onboarding";
      req.candidate.status = "onboarding";
    }
    writeAudit({ actor: OLE, action: { approved: "Godkjente kandidat", rejected: "Avviste kandidat", returned: "Sendte tilbake til leder" }[decision],
                 area: "Godkjenning", affected: req.candidate.name, before: "Til godkjenning", after: next });
    save();
    return HttpResponse.json(req);
  }),

  http.get(`${R}/approval/deputy/`, async ({ request }) => {
    await latency();
    // «partial»: the queue loads but the deputy service does not — the page must show both.
    if (scenarioOf(request) === "partial") return HttpResponse.json({ message: "Simulert feil" }, { status: 503 });
    return HttpResponse.json(store().deputy);
  }),
  http.post(`${R}/approval/deputy/`, async ({ request }) => {
    await latency();
    const b = (await request.json()) as { deputyUserId: string; validFrom: string; validUntil: string };
    if (!b.validFrom || !b.validUntil) return refuse(400, "invalid", "Velg både fra- og til-dato.");
    if (daysBetween(new Date(b.validFrom), new Date(b.validUntil)) > 60) {
      return refuse(400, "invalid", "En stedfortreder kan settes for maks 60 dager om gangen.");
    }
    const name = [...LEADERS, "Nasrin Hassan"].find((n) => `user-${n}` === b.deputyUserId) ?? b.deputyUserId;
    store().deputy = { deputy: name, deputyUserId: b.deputyUserId, from: b.validFrom, to: b.validUntil, setAt: new Date().toISOString() };
    writeAudit({ actor: OLE, action: "Satte stedfortreder", area: "Godkjenning", affected: name, before: "—", after: `${b.validFrom}–${b.validUntil}` });
    save();
    return HttpResponse.json(store().deputy, { status: 201 });
  }),
  http.delete(`${R}/approval/deputy/`, async () => {
    await latency();
    store().deputy = { deputy: null, deputyUserId: null, from: null, to: null, setAt: null };
    save();
    return HttpResponse.json(store().deputy);
  }),
  http.get(`${R}/approval/approvers/`, async () => {
    await latency();
    return HttpResponse.json({
      approvers: [{ userId: "user-ole", name: OLE, deputyUntil: store().deputy.to }],
      selectable: [...LEADERS, "Nasrin Hassan"].map((n) => ({ userId: `user-${n}`, name: n })),
    });
  }),

  // ONB-01..09
  http.get(`${R}/onboarding/`, async ({ request }) => {
    await latency();
    const gate = await scenarioGate(request, []);
    if (gate) return gate;
    if (scenarioOf(request) === "partial") {
      return HttpResponse.json(store().hires.map((h, i) => i === 0 ? { ...h, hrSync: { state: "failed", at: h.hrSync?.at ?? null, error: "HR svarer ikke" } } : h));
    }
    return HttpResponse.json(store().hires);
  }),
  http.get(`${R}/onboarding/templates/`, async ({ request }) => {
    await latency();
    const gate = await scenarioGate(request, []);
    return gate ?? HttpResponse.json(store().templates);
  }),
  http.post(`${R}/onboarding/templates/`, async ({ request }) => {
    await latency();
    const b = (await request.json()) as Pick<TemplateMapping, "kind" | "campaignSlug" | "level" | "templateId" | "note">;
    const prev = store().templates.filter((t) => t.kind === b.kind && t.campaignSlug === b.campaignSlug && t.level === b.level);
    const row: TemplateMapping = { id: `tpl-${Date.now()}`, ...b, version: Math.max(0, ...prev.map((p) => p.version)) + 1,
      status: "notified", createdByName: "Lars Admin", createdAt: new Date().toISOString(), notifiedAt: new Date().toISOString(),
      notifiedTo: ["user-dana"], acknowledgedAt: null, acknowledgedByName: "", activatedAt: null, retiredAt: null };
    store().templates.unshift(row);
    save();
    return HttpResponse.json(row, { status: 201 });
  }),
  http.post(`${R}/onboarding/templates/:id/:action/`, async ({ params }) => {
    await latency();
    const row = store().templates.find((t) => t.id === params.id);
    if (!row) return refuse(404, "not_found", "Ikke funnet.");
    if (params.action === "acknowledge") {
      if (row.status !== "notified") return refuse(409, "wrong_status", "Endringen er ikke varslet.");
      row.status = "acknowledged"; row.acknowledgedAt = new Date().toISOString(); row.acknowledgedByName = "Dana Barzinje";
    } else if (params.action === "activate") {
      if (row.status !== "acknowledged") return refuse(409, "not_acknowledged", "Endringen må kvitteres av Dana før den tas i bruk.");
      for (const t of store().templates) {
        if (t !== row && t.status === "active" && t.kind === row.kind && t.campaignSlug === row.campaignSlug && t.level === row.level) {
          t.status = "retired"; t.retiredAt = new Date().toISOString();
        }
      }
      row.status = "active"; row.activatedAt = new Date().toISOString();
    }
    save();
    return HttpResponse.json(row);
  }),
  http.get(`${R}/onboarding/:id/`, async ({ request, params }) => {
    await latency();
    const s = scenarioOf(request);
    if (s === "loading") await delay(120_000);
    if (s === "error") return HttpResponse.json({ message: "Simulert feil" }, { status: 500 });
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Fant ikke onboardingen.");
    if (s === "partial") return HttpResponse.json({ ...h, hrSync: { state: "failed", at: h.hrSync?.at ?? null, error: "HR svarer ikke" } });
    return HttpResponse.json(h);
  }),
  http.post(`${R}/onboarding/:id/check/`, async ({ request, params }) => {
    await latency();
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Ikke funnet.");
    const b = (await request.json()) as { key: string; done: boolean };
    if (b.key !== "personalia") return refuse(409, "system_item", "Dette punktet oppdateres automatisk fra kilden.");
    const item = h.checklist.find((c) => c.key === "personalia")!;
    item.done = b.done; item.at = b.done ? new Date().toISOString() : null;
    recompute(h); save();
    return HttpResponse.json(h);
  }),
  http.post(`${R}/onboarding/:id/contract/`, async ({ request, params }) => {
    await latency();
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Ikke funnet.");
    const b = (await request.json()) as { contractId?: string };
    const c = h.contracts.find((x) => x.id === b.contractId) ?? h.contract;
    if (c.status === "signert") return refuse(409, "already_signed", "Kontrakten venter ikke på signatur.");
    if (c.remindersSent >= 3) return refuse(409, "max_reminders", "Det er allerede sendt 3 purringer.");
    c.remindersSent += 1;
    if (c.id === h.contract.id) h.contract.remindersSent = c.remindersSent;
    h.timeline.push({ at: new Date().toISOString(), kind: "reminder", actor: "HR", payload: {} });
    save();
    return HttpResponse.json(h);
  }),
  http.post(`${R}/onboarding/:id/provision/`, async ({ params }) => {
    await latency();
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Ikke funnet.");
    if (!(h.contracts.length ? h.contracts : [h.contract]).every((c) => c.status === "signert")) {
      return refuse(409, "contracts_unsigned", "Kontraktene må være signert før brukerkontoen opprettes.");
    }
    h.authUserId = `user-${h.id}`;
    save();
    return HttpResponse.json(h);
  }),
  http.post(`${R}/onboarding/:id/photo/`, async ({ params }) => {
    await latency();
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Ikke funnet.");
    if (!h.authUserId) return refuse(409, "not_provisioned", "Brukerkontoen må opprettes før bildet kan lagres.");
    h.photo = { uploadedAt: new Date().toISOString(), uploadedBy: OLE };
    recompute(h); save();
    return HttpResponse.json(h, { status: 201 });
  }),
  http.post(`${R}/onboarding/:id/complete/`, async ({ request, params }) => {
    await latency();
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Ikke funnet.");
    const open = h.checklist.filter((c) => !c.done);
    if (open.length) return refuse(409, "checklist_incomplete", `Sjekklisten er ikke ferdig: ${open.map((c) => c.key).join(", ")}.`);
    const b = (await request.json()) as { accessTemplate?: string };
    h.status = "completed"; h.completedAt = new Date().toISOString(); h.accessTemplate = b.accessTemplate ?? "promotor";
    const cand = db.candidates.find((c) => c.id === h.candidateId);
    if (cand) cand.stageId = "ansatt";
    writeAudit({ actor: "HR", action: "Opprettet ansatt fra onboarding", area: "Ansatte", affected: h.name, before: "Onboarding", after: "Ansatt" });
    save();
    return HttpResponse.json(h);
  }),
  http.post(`${R}/onboarding/:id/retry-handover/`, async ({ params }) => {
    await latency();
    const h = findHire(String(params.id));
    if (!h) return refuse(404, "not_found", "Ikke funnet.");
    h.hrSync = { state: "ok", at: new Date().toISOString(), error: null };
    save();
    return HttpResponse.json(h, { status: 202 });
  }),

  http.get(`${R}/employees/`, async ({ request }) => {
    await latency();
    const gate = await scenarioGate(request, []);
    return gate ?? HttpResponse.json(db.employees);
  }),
];

