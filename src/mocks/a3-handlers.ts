import { http, HttpResponse, delay, type JsonBodyType } from "msw";
import { db, persistDb } from "./db";
import { writeAudit } from "./handlers";
import { DEMO_TODAY, iso } from "./srs-seed";
import {
  BOARDS, JOB_TYPES, LOCATIONS, MOCK_LEADERS, bookingMessages, busyBlocks, fmtWhen, leaderById, trackingUrl,
} from "./a3-seed";
import type { Ad, Publication } from "@/types/ad";
import type { Interview, InterviewMessage } from "@/types/interview";

/**
 * Mock of recruitment-service's ads + interviews endpoints (A3), on the SAME paths
 * and in the SAME shapes as the real service, so a component cannot tell which one
 * answered. Behaviour mirrors the server where a demo would otherwise mislead:
 * push boards answer a moment later, Finn waits for a pasted id, a slot that is
 * taken comes back 409, money words are refused (SRS l.4), cancel is idempotent.
 */

const R = "/api/recruitment";

/**
 * The demo scenario switch (?scenario=… on the page URL, carried by the client):
 * every screen's five states can be shown on purpose — loading, empty, error, and
 * «stale» (the leader's calendar not answering) — for design review and demos.
 */
type Scenario = "loading" | "empty" | "error" | "stale" | null;
function scenario(request: Request): Scenario {
  const s = new URL(request.url).searchParams.get("scenario");
  return s === "loading" || s === "empty" || s === "error" || s === "stale" ? s : null;
}
async function scenarioResponse(request: Request, empty: JsonBodyType) {
  const s = scenario(request);
  if (s === "loading") { await delay("infinite"); }
  if (s === "error") return HttpResponse.json({ message: "Tjenesten svarte ikke. Prøv igjen om litt." }, { status: 503 });
  if (s === "empty") return HttpResponse.json(empty);
  return null;
}
const latency = () => delay(180 + Math.random() * 220);
const err = (status: number, message: string, code?: string, errors?: Record<string, string[]>) =>
  HttpResponse.json({ message, ...(code ? { code } : {}), ...(errors ? { errors } : {}) }, { status });

// SRS l.4 / l.240 — the same rules the server seeds (ads/0002).
const BLOCK: [string, RegExp][] = [
  ["valutategn", /[$€£¥¢]/g], ["beløp i kroner", /\d[\d\s.]*(?:,\d+)?\s*(?:kr\b|kroner\b|,-)/gi],
  ["kr", /(?<!\w)kr\.?(?!\w)/gi], ["NOK", /\bNOK\b/g], ["provisjon", /\bprovisjon\w*/gi], ["bonus", /\bbonus\w*/gi],
  ["tjene", /\btjen(?:e|er|es|t|te)?\b/gi], ["penger", /\bpeng(?:er|ene)\b/gi], ["salg", /\bsalg\w*/gi],
  ["selge", /\b(?:selg(?:e|er|ere|eren|erne|es)?|solgt\w*)\b/gi],
];
const WARN: [string, RegExp][] = [["lønn", /\b(?:fast|time|grunn)?lønn\w*/gi]];

function hits(text: string, rules: [string, RegExp][]) {
  const out: { term: string; text: string; start: number; end: number }[] = [];
  for (const [term, rx] of rules) for (const m of text.matchAll(rx)) out.push({ term, text: m[0], start: m.index!, end: m.index! + m[0].length });
  return out.sort((a, b) => a.start - b.start);
}

function lint(fields: Record<string, string>) {
  const blocked: Record<string, string[]> = {};
  const warnings: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(fields)) {
    const b = hits(v ?? "", BLOCK).map((h) => h.text);
    const w = hits(v ?? "", WARN).map((h) => h.text);
    if (b.length) blocked[k] = b;
    if (w.length) warnings[k] = w;
  }
  return { blocked, warnings };
}

function withCounts(ad: Ad): Ad {
  return {
    ...ad,
    applicantsTotal: ad.publications.reduce((n, p) => n + p.applicants, 0),
    acceptingApplications: ad.status === "publisert" && !(ad.deadline && ad.deadline < iso(DEMO_TODAY).slice(0, 10)),
  };
}

function newPublication(ad: Ad, board: string): Publication {
  const b = BOARDS.find((x) => x.key === board)!;
  const token = Math.random().toString(36).slice(2, 12);
  return {
    id: `${ad.id}-${board}-${Date.now()}`, platform: board, platformName: b.name, externalId: "",
    trackingUrl: trackingUrl(ad.publicId, token), state: b.mode === "feed" ? "publisert" : "venter",
    manual: b.mode === "manual", publishedAt: b.mode === "feed" ? new Date().toISOString() : null,
    unpublishedAt: null, lastError: "", applicants: 0,
  };
}

/** A push board answers a moment after the request, like the worker would. */
function settleLater(adId: string, pubId: string) {
  setTimeout(() => {
    const p = db.ads.find((a) => a.id === adId)?.publications.find((x) => x.id === pubId);
    if (p && p.state === "venter") {
      p.state = "publisert";
      p.externalId = db.ads.find((a) => a.id === adId)!.publicId;
      p.publishedAt = new Date().toISOString();
      persistDb();
    }
  }, 2500);
}

function publish(ad: Ad, boards: string[]) {
  for (const key of boards) {
    if (ad.publications.some((p) => p.platform === key && !p.unpublishedAt)) continue;
    const p = newPublication(ad, key);
    ad.publications.push(p);
    if (BOARDS.find((b) => b.key === key)?.mode === "push") settleLater(ad.id, p.id);
  }
  ad.status = "publisert";
  ad.unpublishedReason = "";
}

// ── interviews ──────────────────────────────────────────────────────────────

const DEMO_LEADER = MOCK_LEADERS[0];   // the mock session's leader («Ola Nordmann»)

function slotsFor(leaderId: string, from: string, days: number) {
  const out: { startsAt: string; endsAt: string; available: boolean; reason: string | null }[] = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  for (let d = 0; d < days; d++) {
    const day = new Date(start.getTime() + d * 86_400_000);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const busy = busyBlocks(leaderId, day);
    for (let mins = 9 * 60; mins + 30 <= 16 * 60; mins += 30) {
      // Oslo is UTC+2 in the demo's August.
      const s = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, mins - 120);
      const e = s + 30 * 60_000;
      if (s <= DEMO_TODAY.getTime()) continue;
      const taken = db.interviews.find((iv) => iv.leader.id === leaderId && iv.status === "booket"
        && new Date(iv.startsAt).getTime() < e && new Date(iv.endsAt).getTime() > s);
      const cal = busy.some(([bs, be]) => bs < e && be > s);
      const short = s < DEMO_TODAY.getTime() + 2 * 3600_000;
      out.push({
        startsAt: new Date(s).toISOString(), endsAt: new Date(e).toISOString(),
        available: !taken && !cal && !short,
        reason: taken ? "Opptatt: annet intervju" : cal ? "Opptatt i kalenderen" : short ? "For kort varsel (under 2 timer)" : null,
      });
    }
  }
  return out;
}

type NewMessage = Pick<InterviewMessage, "channel" | "to" | "recipientRole" | "kind" | "body"> & { subject?: string };

function msg(iv: Interview, partial: NewMessage) {
  iv.messages.push({ id: `${iv.id}-m${iv.messages.length + 1}`, sentAt: new Date().toISOString(), sendAfter: null,
    status: "sent", error: "", subject: "", ...partial });
}

function setCandidateStage(candidateId: string, stageId: string, actor: string, detail: string) {
  const c = db.candidates.find((x) => x.id === candidateId);
  if (!c) return;
  c.history.push({ id: `h-${Date.now()}`, at: new Date().toLocaleString("nb-NO"), actor, type: "stage-change", stageId, detail } as never);
  c.stageId = stageId as never;
}

function publicView(iv: Interview) {
  const canChange = iv.status === "booket" && new Date(iv.startsAt) > DEMO_TODAY;
  const alternatives = canChange
    ? slotsFor(iv.leader.id, iso(new Date(DEMO_TODAY.getTime() + 86_400_000)).slice(0, 10), 10)
      .filter((s) => s.available).slice(0, 6).map((s) => s.startsAt)
    : [];
  return {
    id: iv.id, candidateName: iv.candidateName.split(" ")[0], leader: iv.leader.name, startsAt: iv.startsAt,
    location: iv.location, status: iv.status === "booket" && !canChange ? "passert" : iv.status, canChange, alternatives,
  };
}

/** The mock link token: «tok-<candidateId>», as seeded. */
const byToken = (token: string) => {
  const chain = db.interviews.filter((iv) => `tok-${iv.candidateId}` === token);
  return chain.sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))[0];
};

function rebook(iv: Interview, startsAt: string, by: string): Interview {
  const old = { ...iv };
  iv.status = "ombooket";
  const next: Interview = {
    ...old, id: `iv-${Date.now()}`, startsAt, endsAt: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
    status: "booket", bookedAt: new Date().toISOString(), messages: [], rebookedTo: null, reminderSentAt: null,
  };
  iv.rebookedTo = next.id;
  db.interviews.unshift(next);
  const link = `https://erp.abmarketing.no/intervju/tok-${iv.candidateId}`;
  msg(next, { channel: "sms", to: next.candidatePhone, recipientRole: "kandidat", kind: "ombooking",
    body: `Hei ${next.candidateName.split(" ")[0]}! Intervjuet ditt er flyttet til ${fmtWhen(startsAt)}, ${next.location}. Du møter ${next.leader.name}. Flytt eller avbestill: ${link}` });
  msg(next, { channel: "sms", to: "+47 900 11 222", recipientRole: "leder", kind: "ombooking",
    body: `Intervjuet med ${next.candidateName} er flyttet fra ${fmtWhen(old.startsAt)} til ${fmtWhen(startsAt)}. Kalenderen er oppdatert.` });
  writeAudit({ actor: by, action: "Ombooket intervju", area: "Intervju", affected: next.candidateName, before: fmtWhen(old.startsAt), after: fmtWhen(startsAt) });
  return next;
}

function cancel(iv: Interview, by: "kandidat" | "rekrutterer") {
  if (iv.status === "avlyst") return iv;
  iv.status = "avlyst";
  iv.cancelledAt = new Date().toISOString();
  iv.cancelledBy = by;
  iv.calendarState = "avlyst";
  const who = by === "kandidat" ? "kandidaten" : "rekrutterer";
  msg(iv, { channel: "sms", to: "+47 900 11 222", recipientRole: "leder", kind: "avlysning",
    body: `Intervjuet med ${iv.candidateName} ${fmtWhen(iv.startsAt)} er avlyst av ${who}. Hendelsen er fjernet fra kalenderen.` });
  msg(iv, { channel: "epost", to: "rekruttering@abmarketing.no", recipientRole: "rekrutterer", kind: "avlysning",
    subject: `Intervju avlyst: ${iv.candidateName} ${fmtWhen(iv.startsAt)}`,
    body: `Intervjuet med ${iv.candidateName} ${fmtWhen(iv.startsAt)} er avlyst av ${who}.\n\nKalenderhendelsen er fjernet, og kandidaten står nå som «Kvalifisert» i rekrutteringssystemet, klar for en ny booking.` });
  msg(iv, { channel: "sms", to: iv.candidatePhone, recipientRole: "kandidat",
    kind: by === "kandidat" ? "kansellering-kvittering" : "avlysning",
    body: by === "kandidat"
      ? `Hei ${iv.candidateName.split(" ")[0]}, intervjuet ${fmtWhen(iv.startsAt)} er avbestilt. Vil du ha en ny tid? Kontakt oss på +47 900 11 222.`
      : `Hei ${iv.candidateName.split(" ")[0]}, intervjuet ditt ${fmtWhen(iv.startsAt)} er dessverre avlyst. Vi tar kontakt for å finne en ny tid.` });
  setCandidateStage(iv.candidateId, "kvalifisert", by === "kandidat" ? iv.candidateName : "Rekrutterer",
    "Intervjuet ble avbestilt. Klar for ny booking.");
  writeAudit({ actor: by === "kandidat" ? iv.candidateName : "Rekrutterer", action: "Avbestilte intervju", area: "Intervju",
    affected: iv.candidateName, before: "Booket", after: "Avlyst" });
  return iv;
}

export const a3Handlers = [
  // ── Annonser ──────────────────────────────────────────────────────────────
  http.get(`${R}/ads/`, async ({ request }) => {
    await latency();
    const forced = await scenarioResponse(request, []);
    if (forced) return forced;
    const status = new URL(request.url).searchParams.get("status");
    const list = status ? db.ads.filter((a) => status.split(",").includes(a.status)) : db.ads;
    return HttpResponse.json(list.map(withCounts));
  }),
  http.get(`${R}/ads/meta/`, async () => {
    await latency();
    return HttpResponse.json({ jobTypes: JOB_TYPES, locations: LOCATIONS, boards: BOARDS });
  }),
  http.get(`${R}/ads/templates/`, async () => {
    await latency();
    return HttpResponse.json(db.adTemplates);
  }),
  http.post(`${R}/ads/wording-check/`, async ({ request }) => {
    const { text } = (await request.json()) as { text: string };
    return HttpResponse.json({ blocked: hits(text ?? "", BLOCK), warnings: hits(text ?? "", WARN) });
  }),
  http.get(`${R}/ads/:id/`, async ({ params }) => {
    await latency();
    const ad = db.ads.find((a) => a.id === params.id);
    return ad ? HttpResponse.json(withCounts(ad)) : err(404, "Fant ikke det du lette etter.");
  }),
  http.post(`${R}/ads/`, async ({ request }) => {
    await latency();
    const b = (await request.json()) as {
      title: string; jobType: string; location: string; campaign: string; body: string; deadline?: string;
      platforms: string[]; publish?: boolean;
    };
    const { blocked, warnings } = lint({ title: b.title, body: b.body });
    if (Object.keys(blocked).length) {
      const words = [...new Set(Object.values(blocked).flat())].join(", ");
      return err(422, `Fjern ord om penger eller salg før du lagrer: ${words}.`, "wording_blocked", blocked);
    }
    const id = `ad-${Date.now()}`;
    const ad: Ad = {
      id, publicId: Math.random().toString(36).slice(2, 12), title: b.title, jobType: b.jobType, location: b.location,
      campaign: b.campaign, campaignId: null, body: b.body, status: "utkast", deadline: b.deadline || null,
      unpublishedReason: "", createdAt: new Date().toISOString(), createdBy: "Fredrik Amundsen", publications: [],
      applicantsTotal: 0, acceptingApplications: false,
    };
    if (b.publish) publish(ad, b.platforms);
    db.ads.unshift(ad);
    writeAudit({ actor: "Fredrik Amundsen", action: b.publish ? `Publiserte annonse til ${b.platforms.join(", ")}` : "Lagret annonseutkast",
      area: "Annonser", affected: b.title, after: b.publish ? "Publisert" : "Utkast" });
    persistDb();
    return HttpResponse.json({ ...withCounts(ad), ...(Object.keys(warnings).length ? { wordingWarnings: warnings } : {}) }, { status: 201 });
  }),
  http.post(`${R}/ads/:id/publish/`, async ({ request, params }) => {
    await latency();
    const { platforms } = (await request.json()) as { platforms: string[] };
    const ad = db.ads.find((a) => a.id === params.id);
    if (!ad) return err(404, "Fant ikke det du lette etter.");
    if (!platforms?.length) return err(400, "Velg minst én plattform", undefined, { platforms: ["Velg minst én plattform"] });
    publish(ad, platforms);
    persistDb();
    return HttpResponse.json(withCounts(ad));
  }),
  http.post(`${R}/ads/:id/unpublish/`, async ({ request, params }) => {
    await latency();
    const { platforms } = (await request.json()) as { platforms?: string[] };
    const ad = db.ads.find((a) => a.id === params.id);
    if (!ad) return err(404, "Fant ikke det du lette etter.");
    const now = new Date().toISOString();
    for (const p of ad.publications) {
      if (p.unpublishedAt || (platforms?.length && !platforms.includes(p.platform))) continue;
      p.unpublishedAt = now;
      p.state = "avpublisert";
    }
    if (!platforms?.length || !ad.publications.some((p) => !p.unpublishedAt)) {
      ad.status = "avpublisert";
      ad.unpublishedReason = "manuell";
    }
    writeAudit({ actor: "Fredrik Amundsen", action: "Avpubliserte annonse", area: "Annonser", affected: ad.title, before: "Publisert", after: ad.status });
    persistDb();
    return HttpResponse.json(withCounts(ad));
  }),
  http.post(`${R}/ads/:id/publications/:board/manual/`, async ({ request, params }) => {
    await latency();
    const { externalId } = (await request.json()) as { externalId: string };
    const ad = db.ads.find((a) => a.id === params.id);
    const p = ad?.publications.find((x) => x.platform === params.board && !x.unpublishedAt);
    if (!ad || !p) return err(404, "Fant ikke det du lette etter.");
    p.externalId = externalId.trim();
    p.state = "publisert";
    p.publishedAt = p.publishedAt ?? new Date().toISOString();
    persistDb();
    return HttpResponse.json(withCounts(ad));
  }),
  http.post(`${R}/ads/:id/publications/:board/retry/`, async ({ params }) => {
    await latency();
    const ad = db.ads.find((a) => a.id === params.id);
    const p = ad?.publications.find((x) => x.platform === params.board && !x.unpublishedAt);
    if (!ad || !p) return err(404, "Fant ikke det du lette etter.");
    p.state = "venter";
    p.lastError = "";
    settleLater(ad.id, p.id);
    persistDb();
    return HttpResponse.json(withCounts(ad));
  }),

  // ── Offentlig søknad ──────────────────────────────────────────────────────
  http.get(`${R}/public/ads/:publicId/`, async ({ params, request }) => {
    await latency();
    if (scenario(request) === "loading") await delay("infinite");
    const ad = db.ads.find((a) => a.publicId === params.publicId && a.status !== "utkast");
    if (!ad) return err(404, "Fant ikke annonsen.");
    const open = withCounts(ad).acceptingApplications;
    return HttpResponse.json({ id: ad.publicId, title: ad.title, jobType: ad.jobType, location: ad.location,
      body: ad.body, deadline: ad.deadline, open });
  }),
  http.post(`${R}/public/apply/`, async ({ request }) => {
    await latency();
    const b = (await request.json()) as { adId: string; k?: string; name: string; phone: string; email: string;
      message?: string; consentContact: boolean; consentAdAudience: boolean; website?: string };
    if (b.website) return HttpResponse.json({ ok: true }, { status: 201 });
    const ad = db.ads.find((a) => a.publicId === b.adId && a.status !== "utkast");
    if (!ad) return err(404, "Fant ikke annonsen.");
    if (!withCounts(ad).acceptingApplications) {
      return err(410, "Søknadsfristen er ute, eller annonsen er tatt ned. Takk for interessen!", "ad_closed");
    }
    const pub = b.k ? ad.publications.find((p) => p.trackingUrl.endsWith(`k=${b.k}`)) : undefined;
    const now = new Date().toISOString();
    const channel = pub ? pub.platformName.split(" ")[0] : "Nettside";
    db.leadExtra.unshift({
      id: `l-apply-${Date.now()}`, name: b.name, phone: b.phone, email: b.email, channel: channel as never,
      campaign: ad.campaign, receivedAt: now, promoter: null, assignedTo: null, status: "ny",
      consent: { contact: true, adAudience: b.consentAdAudience, at: now, text: "Søknadsskjema (soknadsskjema v1)" },
      adId: ad.id, note: b.message ?? null, candidateId: null, duplicateOf: [],
    } as never);
    // ANN-06 — counted on the publication the link came from.
    if (pub) pub.applicants += 1;
    persistDb();
    return HttpResponse.json({ ok: true }, { status: 201 });
  }),

  // ── Intervjuer ────────────────────────────────────────────────────────────
  http.get(`${R}/interviews/`, async ({ request }) => {
    await latency();
    const forced = await scenarioResponse(request, []);
    if (forced) return forced;
    const p = new URL(request.url).searchParams;
    let list = db.interviews;
    if (p.get("scope") === "mine") list = list.filter((iv) => iv.leader.id === DEMO_LEADER.id);
    if (p.get("status")) list = list.filter((iv) => p.get("status")!.split(",").includes(iv.status));
    if (p.get("candidate")) list = list.filter((iv) => iv.candidateId === p.get("candidate"));
    return HttpResponse.json([...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  }),
  http.get(`${R}/interviews/leaders/`, async () => {
    await latency();
    return HttpResponse.json(MOCK_LEADERS);
  }),
  http.get(`${R}/interviews/slots/`, async ({ request }) => {
    await latency();
    const p = new URL(request.url).searchParams;
    const leader = p.get("leader") ?? "";
    if (!leaderById(leader)) return err(400, "Ukjent leder.", undefined, { leader: ["Ukjent leder."] });
    const from = p.get("from") || iso(DEMO_TODAY).slice(0, 10);
    const days = Math.min(Number(p.get("days") ?? 7), 31);
    const forced = await scenarioResponse(request, { source: "erklært", stale: false, computedAt: new Date().toISOString(),
      calendarSyncedAt: null, slots: [] });
    if (forced) return forced;
    const stale = scenario(request) === "stale";
    return HttpResponse.json({ source: "kalender", stale, computedAt: new Date().toISOString(),
      calendarSyncedAt: new Date(Date.now() - (stale ? 47 : 4) * 60_000).toISOString(), slots: slotsFor(leader, from, days) });
  }),
  http.post(`${R}/interviews/`, async ({ request }) => {
    await latency();
    const b = (await request.json()) as { candidateId: string; leaderId: string; startsAt: string; location: string; reminderEnabled: boolean };
    const c = db.candidates.find((x) => x.id === b.candidateId);
    const leader = leaderById(b.leaderId);
    if (!c) return err(404, "Fant ikke kandidaten.");
    if (!leader) return err(400, "Velg en leder fra listen.", undefined, { leaderId: ["Velg en leder fra listen."] });
    if (db.interviews.some((iv) => iv.candidateId === c.id && iv.status === "booket")) {
      return err(409, "Kandidaten har allerede et booket intervju. Ombook det i stedet.", "already_booked");
    }
    const slot = slotsFor(leader.id, b.startsAt.slice(0, 10), 1).find((s) => s.startsAt === new Date(b.startsAt).toISOString());
    if (!slot || !slot.available) {
      return err(409, `Tidspunktet er ikke ledig: ${slot?.reason ?? "ikke en av lederens ledige tider"}.`, "slot_taken");
    }
    const id = `iv-${Date.now()}`;
    const iv: Interview = {
      id, candidateId: c.id, candidateName: c.name, candidatePhone: c.phone, candidateStatus: "intervju-booket",
      leader: { id: leader.id, name: leader.name }, startsAt: slot.startsAt, endsAt: slot.endsAt, location: b.location,
      status: "booket", calendarEventId: "", calendarState: "venter", reminderEnabled: b.reminderEnabled,
      reminderSentAt: null, attended: null, assessment: "", rating: null, recommend: null, outcomeAt: null,
      bookedBy: c.owner, bookedAt: new Date().toISOString(), cancelledAt: null, cancelledBy: "", rebookedTo: null,
      messages: [],
    };
    iv.messages = bookingMessages(iv, c.email, "+47 900 11 222", iv.bookedAt, `tok-${c.id}`)
      .map((m) => ({ ...m, status: "queued" as const }));
    db.interviews.unshift(iv);
    // The calendar and the SMS gateway answer a moment later, like the workers do.
    setTimeout(() => {
      iv.calendarState = "synket";
      iv.calendarEventId = `mock-${id}`;
      iv.messages.forEach((m) => (m.status = "delivered"));
      persistDb();
    }, 3000);
    setCandidateStage(c.id, "intervju-booket", c.owner, `Intervju booket med ${leader.name} ${fmtWhen(slot.startsAt)}, ${b.location}.`);
    writeAudit({ actor: c.owner, action: "Booket intervju", area: "Intervju", affected: c.name, after: fmtWhen(slot.startsAt) });
    persistDb();
    return HttpResponse.json(iv, { status: 201 });
  }),
  http.patch(`${R}/interviews/:id/`, async ({ request, params }) => {
    await latency();
    const b = (await request.json()) as { reminderEnabled: boolean };
    const iv = db.interviews.find((x) => x.id === params.id);
    if (!iv) return err(404, "Fant ikke det du lette etter.");
    iv.reminderEnabled = b.reminderEnabled;
    persistDb();
    return HttpResponse.json(iv);
  }),
  http.post(`${R}/interviews/:id/rebook/`, async ({ request, params }) => {
    await latency();
    const b = (await request.json()) as { startsAt: string };
    const iv = db.interviews.find((x) => x.id === params.id);
    if (!iv) return err(404, "Fant ikke det du lette etter.");
    if (iv.status !== "booket") return err(409, "Bare et booket intervju kan flyttes.", "not_booked");
    const slot = slotsFor(iv.leader.id, b.startsAt.slice(0, 10), 1).find((s) => s.startsAt === new Date(b.startsAt).toISOString());
    if (!slot?.available) return err(409, `Tidspunktet er ikke ledig: ${slot?.reason ?? "ikke en ledig tid"}.`, "slot_taken");
    const next = rebook(iv, slot.startsAt, "Rekrutterer");
    persistDb();
    return HttpResponse.json(next);
  }),
  http.post(`${R}/interviews/:id/cancel/`, async ({ params }) => {
    await latency();
    const iv = db.interviews.find((x) => x.id === params.id);
    if (!iv) return err(404, "Fant ikke det du lette etter.");
    if (iv.status !== "booket" && iv.status !== "avlyst") return err(409, "Intervjuet kan ikke avlyses lenger.", "not_booked");
    cancel(iv, "rekrutterer");
    persistDb();
    return HttpResponse.json(iv);
  }),
  /** BOOK-08 — leder registrerer oppmøte og vurdering, én gang, etter start. */
  http.post(`${R}/interviews/:id/outcome/`, async ({ request, params }) => {
    await latency();
    const b = (await request.json()) as { attended: boolean; assessment: string; rating?: number | null; recommend?: boolean | null };
    const iv = db.interviews.find((x) => x.id === params.id);
    if (!iv) return err(404, "Fant ikke det du lette etter.");
    if (!b.assessment || b.assessment.trim().length < 3) {
      return err(400, "assessment: Skriv en kort vurdering.", undefined, { assessment: ["Skriv en kort vurdering."] });
    }
    if (iv.status !== "booket") return err(409, "Oppmøte er allerede registrert for dette intervjuet.", "already_recorded");
    if (new Date(iv.startsAt) > DEMO_TODAY) return err(409, "Oppmøte kan registreres når intervjuet har startet.", "not_started");
    Object.assign(iv, { attended: b.attended, assessment: b.assessment.trim(), rating: b.rating ?? null,
      recommend: b.recommend ?? null, status: b.attended ? "gjennomfort" : "no-show", outcomeAt: new Date().toISOString(),
      candidateStatus: b.attended ? "intervjuet" : "no-show" });
    setCandidateStage(iv.candidateId, b.attended ? "intervjuet" : "no-show", iv.leader.name,
      b.attended ? `Møtte til intervju. Vurdering: ${b.assessment}` : `Møtte ikke til intervjuet. ${b.assessment}`);
    // OPPG-01 — the system task that asked for this closes itself.
    const task = db.leaderTasks.find((t) => t.relatedCandidateId === iv.candidateId && t.source === "system" && t.status !== "fullfort");
    if (task) Object.assign(task, { status: "fullfort", response: b.assessment, completedAt: new Date().toISOString() });
    writeAudit({ actor: iv.leader.name, action: b.attended ? "Registrerte oppmøte" : "Registrerte ikke møtt", area: "Intervju",
      affected: iv.candidateName, after: b.attended ? "Gjennomført" : "Ikke møtt" });
    persistDb();
    return HttpResponse.json(iv);
  }),

  // ── Kandidatlenken (offentlig) ────────────────────────────────────────────
  http.get(`${R}/public/interview/:token/`, async ({ params, request }) => {
    await latency();
    if (scenario(request) === "loading") await delay("infinite");
    const iv = byToken(String(params.token));
    if (!iv) return err(404, "Lenken er ugyldig eller utløpt. Ta kontakt med oss hvis du trenger hjelp.");
    return HttpResponse.json(publicView(iv));
  }),
  http.post(`${R}/public/interview/:token/cancel/`, async ({ request, params }) => {
    await latency();
    const b = (await request.json()) as { rebookTo?: string };
    const iv = byToken(String(params.token));
    if (!iv) return err(404, "Lenken er ugyldig eller utløpt. Ta kontakt med oss hvis du trenger hjelp.");
    if (iv.status === "avlyst" && !b.rebookTo) return HttpResponse.json({ ok: true, ...publicView(iv) });
    if (!publicView(iv).canChange) return err(409, "Dette intervjuet kan ikke endres lenger. Ta kontakt med oss.", "not_changeable");
    if (b.rebookTo) {
      if (!publicView(iv).alternatives.includes(b.rebookTo)) {
        return HttpResponse.json({ message: "Tiden er ikke ledig lenger. Velg en annen.", code: "slot_taken", ...publicView(iv) }, { status: 409 });
      }
      const next = rebook(iv, b.rebookTo, iv.candidateName);
      persistDb();
      return HttpResponse.json({ ok: true, ...publicView(next) });
    }
    cancel(iv, "kandidat");
    persistDb();
    return HttpResponse.json({ ok: true, ...publicView(iv) });
  }),
];
