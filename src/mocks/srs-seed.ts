import type { Ad, AdTemplate } from "@/types/ad";
import type { Interview } from "@/types/interview";
import type { NewHire, Employee } from "@/types/onboarding";
import { newHireSchema } from "@/types/onboarding";
import type { Shift, SwapRequest } from "@/types/schedule";
import type { LeaderTask } from "@/types/task";
import { CANDIDATES } from "@/lib/mock-data";

/**
 * Fixtures for the modules the SRS adds beyond the core loop.
 *
 * Everything is anchored to the same demo "today" the rest of the mock uses
 * (20 August 2026). Dates that drift with the wall clock are the usual way a
 * demo rots: a shift calendar seeded relative to `new Date()` looks right the
 * day it is written and shows an empty month three weeks later.
 */

export const DEMO_TODAY = new Date("2026-08-20T09:12:00.000Z");
const DAY = 86_400_000;

export function iso(d: Date): string {
  return d.toISOString();
}
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function dayOffset(days: number, hour = 9, minute = 0): Date {
  const d = new Date(DEMO_TODAY.getTime() + days * DAY);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
}

export const LEADERS = ["Ola Nordmann", "Marte Solberg", "Jonas Five", "Silje Hauge"];
export const TEAMS_SRS = ["Team Vest", "Team Nord", "Team Sør", "Team Øst"];

// ── Annonser (ANN) ──────────────────────────────────────────────────────────

export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: "tpl-promotor-oslo",
    name: "Promotør — Oslo",
    jobType: "Promotør",
    location: "Oslo",
    title: "Promotør i Oslo — jobb for en god sak",
    body:
      "Vi søker promotører i Oslo som vil jobbe med verving for noen av Norges største " +
      "organisasjoner.\n\nDu møter mennesker ansikt til ansikt, forteller om arbeidet " +
      "organisasjonen gjør, og hjelper dem som ønsker å bidra.\n\nVi tilbyr grundig " +
      "opplæring, tett oppfølging fra din egen teamleder, og fleksible arbeidsdager som " +
      "lar seg kombinere med studier.\n\nDu trenger ingen erfaring. Du må være over 18 år, " +
      "snakke god norsk, og like å snakke med folk.",
  },
  {
    id: "tpl-promotor-bergen",
    name: "Promotør — Bergen",
    jobType: "Promotør",
    location: "Bergen",
    title: "Promotør i Bergen — deltid ved siden av studiene",
    body:
      "Vi utvider i Bergen og søker promotører som vil jobbe deltid.\n\nArbeidet går ut på " +
      "å møte mennesker, fortelle om arbeidet organisasjonen gjør, og hjelpe dem som vil " +
      "bidra.\n\nVi tilbyr opplæring fra første dag, en teamleder som følger deg opp, og " +
      "vakter som settes opp sammen med deg.\n\nIngen erfaring nødvendig.",
  },
  {
    id: "tpl-teamleder",
    name: "Teamleder — alle steder",
    jobType: "Teamleder",
    location: "Oslo",
    title: "Teamleder — bygg og følg opp ditt eget team",
    body:
      "Vi søker teamledere som vil ta ansvar for et team av promotører.\n\nSom teamleder " +
      "har du ansvar for oppfølging, opplæring og utvikling av teamet ditt, og du jobber " +
      "tett med salgssjefen.\n\nVi ser etter deg som har erfaring fra feltarbeid eller " +
      "salg, og som trives med ansvar for andres resultater.",
  },
];

export const JOB_TYPES = ["Promotør", "Teamleder", "Salgssjef"];
export const LOCATIONS = ["Oslo", "Bergen", "Trondheim", "Stavanger", "Tromsø"];

function trackingUrl(adId: string, platform: string) {
  return `https://abmarketing.no/soknad/${adId}?kanal=${platform.toLowerCase()}`;
}

export const ADS: Ad[] = [
  {
    id: "ad-1",
    title: "Promotør i Oslo — jobb for en god sak",
    jobType: "Promotør",
    location: "Oslo",
    campaign: "Høstkampanjen 2026",
    body: AD_TEMPLATES[0].body,
    status: "publisert",
    deadline: isoDay(dayOffset(21)),
    createdAt: iso(dayOffset(-24)),
    createdBy: "Fredrik Amundsen",
    publications: [
      { platform: "Nav", externalId: "NAV-884120", trackingUrl: trackingUrl("ad-1", "Nav"), publishedAt: iso(dayOffset(-24, 11)), unpublishedAt: null, applicants: 41 },
      { platform: "Indeed", externalId: "IND-5512", trackingUrl: trackingUrl("ad-1", "Indeed"), publishedAt: iso(dayOffset(-24, 11)), unpublishedAt: null, applicants: 18 },
      { platform: "Finn", externalId: "FINN-220914", trackingUrl: trackingUrl("ad-1", "Finn"), publishedAt: iso(dayOffset(-23, 9)), unpublishedAt: null, applicants: 27 },
    ],
  },
  {
    id: "ad-2",
    title: "Promotør i Bergen — deltid ved siden av studiene",
    jobType: "Promotør",
    location: "Bergen",
    campaign: "Bergen oppstart",
    body: AD_TEMPLATES[1].body,
    status: "publisert",
    deadline: isoDay(dayOffset(9)),
    createdAt: iso(dayOffset(-12)),
    createdBy: "Hanne Lie",
    publications: [
      { platform: "Nav", externalId: "NAV-884771", trackingUrl: trackingUrl("ad-2", "Nav"), publishedAt: iso(dayOffset(-12, 13)), unpublishedAt: null, applicants: 23 },
      { platform: "Jobbnorge", externalId: "JN-41200", trackingUrl: trackingUrl("ad-2", "Jobbnorge"), publishedAt: iso(dayOffset(-12, 13)), unpublishedAt: null, applicants: 6 },
    ],
  },
  {
    id: "ad-3",
    title: "Teamleder — bygg og følg opp ditt eget team",
    jobType: "Teamleder",
    location: "Trondheim",
    campaign: "Vinterrekruttering 2027",
    body: AD_TEMPLATES[2].body,
    status: "utkast",
    deadline: null,
    createdAt: iso(dayOffset(-2)),
    createdBy: "Ida Moen",
    publications: [],
  },
  {
    id: "ad-4",
    title: "Promotør i Stavanger — sommerjobb 2026",
    jobType: "Promotør",
    location: "Stavanger",
    campaign: "Høstkampanjen 2026",
    body: AD_TEMPLATES[0].body,
    status: "avpublisert",
    // ANN-05 — the deadline has passed, so the ad took itself down.
    deadline: isoDay(dayOffset(-6)),
    createdAt: iso(dayOffset(-61)),
    createdBy: "Fredrik Amundsen",
    publications: [
      { platform: "Nav", externalId: "NAV-879002", trackingUrl: trackingUrl("ad-4", "Nav"), publishedAt: iso(dayOffset(-61, 10)), unpublishedAt: iso(dayOffset(-6, 0)), applicants: 55 },
      { platform: "Indeed", externalId: "IND-5410", trackingUrl: trackingUrl("ad-4", "Indeed"), publishedAt: iso(dayOffset(-61, 10)), unpublishedAt: iso(dayOffset(-6, 0)), applicants: 12 },
    ],
  },
];

// ── Intervjuer (BOOK) ───────────────────────────────────────────────────────

function smsBody(name: string, leader: string, when: Date, where: string) {
  const f = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });
  return `Hei ${name.split(" ")[0]}! Intervjuet ditt hos AB Marketing er ${f.format(when)}, ${where}. Du møter ${leader}. Spørsmål? Ring 23 96 00 00.`;
}

export function buildInterviews(): Interview[] {
  const booked = CANDIDATES.filter((c) => c.stageId === "intervju-booket").slice(0, 4);
  const done = CANDIDATES.filter((c) => c.stageId === "intervjuet").slice(0, 3);
  const out: Interview[] = [];
  const r = rng(99);

  booked.forEach((c, i) => {
    const when = dayOffset(1 + i, 10 + (i % 4), i % 2 ? 30 : 0);
    const leader = LEADERS[i % LEADERS.length];
    const where = "AB Marketing, Karl Johans gate 12, Oslo";
    out.push({
      id: `iv-${c.id}`,
      candidateId: c.id,
      candidateName: c.name,
      candidatePhone: c.phone,
      leader,
      startsAt: iso(when),
      location: where,
      status: "booket",
      calendarEventId: `cal-${1000 + i}`,
      cancelToken: `tok-${c.id}`,
      attended: null,
      assessment: null,
      reminderEnabled: true,
      bookedBy: c.owner,
      bookedAt: iso(dayOffset(-1, 14)),
      messages: [
        { id: `m-${i}-1`, channel: "sms", to: c.phone, recipientRole: "kandidat", kind: "bekreftelse", sentAt: iso(dayOffset(-1, 14, 2)), body: smsBody(c.name, leader, when, where) },
        { id: `m-${i}-2`, channel: "sms", to: "+47 900 11 2{i}2", recipientRole: "leder", kind: "bekreftelse", sentAt: iso(dayOffset(-1, 14, 2)), body: `Intervju booket: ${c.name}, ${new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" }).format(when)}. Kalenderinvitasjon er sendt.` },
        { id: `m-${i}-3`, channel: "epost", to: c.email, recipientRole: "kandidat", kind: "bekreftelse", sentAt: iso(dayOffset(-1, 14, 3)), body: `Hei ${c.name.split(" ")[0]},\n\nTakk for at du vil snakke med oss. Intervjuet er satt opp ${new Intl.DateTimeFormat("nb-NO", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Oslo" }).format(when)}, ${where}.\n\nDu møter ${leader}. Trenger du å flytte eller avbestille, bruk lenken i påminnelsen du får dagen før.\n\nVennlig hilsen\nAB Marketing` },
      ],
    });
  });

  done.forEach((c, i) => {
    const when = dayOffset(-2 - i, 11, 0);
    const leader = LEADERS[(i + 1) % LEADERS.length];
    // One of them did not turn up — DASH-02 needs something to count.
    const attended = i !== 1;
    out.push({
      id: `iv-${c.id}`,
      candidateId: c.id,
      candidateName: c.name,
      candidatePhone: c.phone,
      leader,
      startsAt: iso(when),
      location: "AB Marketing, Karl Johans gate 12, Oslo",
      status: attended ? "gjennomfort" : "no-show",
      calendarEventId: `cal-${2000 + i}`,
      cancelToken: `tok-${c.id}`,
      attended,
      assessment: attended
        ? ["God muntlig framstilling, virker motivert. Anbefaler videre.", "Litt usikker, men lærevillig. Kan prøves på et mindre team."][i % 2]
        : null,
      reminderEnabled: true,
      bookedBy: c.owner,
      bookedAt: iso(dayOffset(-5 - i, 9)),
      messages: [
        { id: `md-${i}-1`, channel: "sms", to: c.phone, recipientRole: "kandidat", kind: "bekreftelse", sentAt: iso(dayOffset(-5 - i, 9, 5)), body: smsBody(c.name, leader, when, "AB Marketing, Oslo") },
        { id: `md-${i}-2`, channel: "sms", to: c.phone, recipientRole: "kandidat", kind: "paaminnelse", sentAt: iso(dayOffset(-3 - i, 16)), body: `Påminnelse: intervju i morgen kl. ${new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" }).format(when)} hos AB Marketing. Må du avbestille? ${"https://abmarketing.no/intervju/tok-" + c.id}` },
      ],
    });
  });

  void r;
  return out;
}

// ── Onboarding (ONB) og ansatte ─────────────────────────────────────────────

/** The seed is written in the original shape; the schema fills the api-era defaults
 *  (status, contracts, timeline, …), so mock mode and api mode render the same screen. */
export function buildNewHires(): NewHire[] {
  return buildNewHiresRaw().map((h) => newHireSchema.parse(h));
}

function buildNewHiresRaw() {
  const approved = CANDIDATES.filter((c) => c.stageId === "onboarding" || c.stageId === "godkjent");
  return approved.map((c, i) => {
    const start = dayOffset(7 + i * 3);
    // A spread of progress, so the list shows a real mix rather than one state.
    const stage = i % 4;
    const contractSigned = stage >= 1;
    const hasPhoto = stage >= 2;
    const hasKit = stage >= 3;
    return {
      id: `nh-${c.id}`,
      candidateId: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      campaign: c.campaign,
      team: TEAMS_SRS[i % TEAMS_SRS.length],
      startDate: isoDay(start),
      registeredBy: LEADERS[i % LEADERS.length],
      checklist: [
        { key: "personalia", done: true, at: iso(dayOffset(-3 + i)) },
        { key: "kontrakt", done: contractSigned, at: contractSigned ? iso(dayOffset(-2 + i)) : null },
        { key: "bilde", done: hasPhoto, at: hasPhoto ? iso(dayOffset(-1 + i)) : null },
        { key: "utstyr", done: hasKit, at: hasKit ? iso(dayOffset(0 + i)) : null },
        { key: "opplaering", done: false, at: null },
        { key: "forstedag", done: false, at: null },
      ],
      contract: {
        status: contractSigned ? "signert" : stage === 0 ? "sendt" : "apnet",
        templateId: "9222115557590686491",
        sentAt: iso(dayOffset(-3 + i, 12)),
        signedAt: contractSigned ? iso(dayOffset(-2 + i, 15)) : null,
        // ONB-03 — purring on what has not been signed.
        remindersSent: contractSigned ? 0 : stage === 0 ? 2 : 1,
      },
      photo: hasPhoto ? { uploadedAt: iso(dayOffset(-1 + i, 10)), uploadedBy: "Ole Marius Sormbråten" } : null,
      equipment: hasKit
        ? [
            { id: `eq-${i}-1`, kind: "Mobiltelefon", model: "Samsung A54", serial: `SM-A54-${90210 + i}`, handedOutAt: iso(dayOffset(0 + i, 9)), handedOutBy: "Ole Marius Sormbråten" },
            { id: `eq-${i}-2`, kind: "Jakke", model: "AB softshell L", serial: `JKT-${4400 + i}`, handedOutAt: iso(dayOffset(0 + i, 9)), handedOutBy: "Ole Marius Sormbråten" },
            { id: `eq-${i}-3`, kind: "ID-kort", model: "AB adgangskort", serial: `ID-${77100 + i}`, handedOutAt: iso(dayOffset(0 + i, 9)), handedOutBy: "Ole Marius Sormbråten" },
          ]
        : [],
      // ONB-07 — the equipment contract is sent *after* hand-over, never before.
      equipmentContract: hasKit
        ? { status: i % 2 ? "signert" : "sendt", sentAt: iso(dayOffset(0 + i, 10)), signedAt: i % 2 ? iso(dayOffset(0 + i, 11)) : null }
        : { status: "ikke-sendt", sentAt: null, signedAt: null },
      firstDayNoShow: null,
      completedAt: null,
    };
  });
}

const EMPLOYEE_NAMES = [
  "Kari Nordmann", "Jon Berge", "Silje Aune", "Petter Holt", "Mariam Osei",
  "Even Dahl", "Nora Sande", "Anders Rygg", "Lise Fjell", "Tom Hauge",
  "Sara Bakke", "Nils Vold", "Hanne Strøm", "Erik Lunde", "Maja Ryen",
  "Sondre Fossum", "Camilla Berg", "Ivar Næss", "Tone Rikard", "Kjell Aune",
];

export function buildEmployees(): Employee[] {
  const r = rng(4242);
  return EMPLOYEE_NAMES.map((name, i) => {
    const isLeader = i < 4;
    return {
      id: `emp-${i + 1}`,
      name,
      phone: `+47 9${String(20 + i).padStart(2, "0")} ${String(30 + i).padStart(2, "0")} ${String(40 + i).padStart(2, "0")}`,
      email: name.toLowerCase().replace(/ /g, ".").replace(/[æøå]/g, "o") + "@abmarketing.no",
      team: TEAMS_SRS[i % TEAMS_SRS.length],
      campaign: ["Høstkampanjen 2026", "Vinterrekruttering 2027", "Bergen oppstart"][i % 3],
      role: isLeader ? "Teamleder" : "Promotør",
      // As in real HR: people employed before the recruitment flow have no start
      // date or access template (an empty startDate crashed /ansatte on staging).
      startDate: i % 7 === 5 ? "" : isoDay(dayOffset(-30 - Math.floor(r() * 400))),
      active: i !== 17,
      accessTemplate: i % 7 === 5 ? "" : isLeader ? "Leder" : "Promotør",
      equipment:
        i % 3 === 0
          ? [{ id: `eqe-${i}`, kind: "Mobiltelefon", model: "Samsung A54", serial: `SM-A54-${80000 + i}`, handedOutAt: iso(dayOffset(-30 - i)), handedOutBy: "Ole Marius Sormbråten" }]
          : [],
      photo: i % 4 !== 3,
      fromNewHireId: null,
    };
  });
}

// ── Vaktplan og oppmøte (BEM) ───────────────────────────────────────────────

/**
 * A month of shifts for every employee.
 *
 * Attendance is only filled in for days that have already happened — a future
 * day is `planlagt` and nothing else. Marking tomorrow as "møtt" would make the
 * whole blue/green/red distinction meaningless, which is the one thing BEM-01
 * is about.
 */
export function buildShifts(employees: Employee[]): Shift[] {
  const out: Shift[] = [];
  for (const [ei, e] of employees.entries()) {
    const r = rng(1000 + ei);
    for (let d = -14; d <= 14; d++) {
      const date = dayOffset(d);
      const weekday = date.getUTCDay();
      if (weekday === 0) continue; // Sundays are not worked.

      const roll = r();
      let kind: Shift["kind"] = "arbeid";
      if (roll > 0.93) kind = "ferie";
      else if (roll > 0.88) kind = "syk";
      else if (roll > 0.78) kind = "fri";

      const past = d < 0;
      let attendance: Shift["attendance"] = null;
      if (kind === "arbeid") {
        if (!past) attendance = "planlagt";
        else attendance = r() > 0.17 ? "mott" : "ikke-mott";
      }

      const missed = attendance === "ikke-mott";
      out.push({
        id: `sh-${e.id}-${d + 14}`,
        employeeId: e.id,
        employeeName: e.name,
        team: e.team,
        date: isoDay(date),
        kind,
        attendance,
        followUp:
          missed && r() > 0.5
            ? { at: iso(dayOffset(d + 1, 9)), by: LEADERS[ei % LEADERS.length], note: "Ringt. Sykt barn, kommer tilbake i morgen." }
            : null,
        swapPending: false,
      });
    }
  }
  return out;
}

export function buildSwaps(shifts: Shift[]): SwapRequest[] {
  const future = shifts.filter((s) => s.kind === "arbeid" && s.date > isoDay(DEMO_TODAY));
  const out: SwapRequest[] = [];
  for (let i = 0; i < 3 && i * 7 + 1 < future.length; i++) {
    const a = future[i * 7];
    const b = future[i * 7 + 1];
    if (!a || !b || a.employeeId === b.employeeId) continue;
    out.push({
      id: `sw-${i + 1}`,
      fromEmployee: a.employeeName,
      toEmployee: b.employeeName,
      fromShiftId: a.id,
      toShiftId: b.id,
      fromDate: a.date,
      toDate: b.date,
      reason: ["Eksamen samme dag", "Skal i bryllup", "Legetime jeg ikke får flyttet"][i],
      status: "venter",
      requestedAt: iso(dayOffset(-1, 18)),
      decidedAt: null,
      decidedBy: null,
    });
  }
  return out;
}

// ── Lederoppgaver (OPPG) ────────────────────────────────────────────────────

export function buildTasks(): LeaderTask[] {
  const out: LeaderTask[] = [];
  const interviewed = CANDIDATES.filter((c) => c.stageId === "intervjuet");
  const booked = CANDIDATES.filter((c) => c.stageId === "intervju-booket");

  // OPPG-01 — the tasks the system makes itself: register attendance after an
  // interview, and fill in what Ole needs.
  interviewed.forEach((c, i) => {
    out.push({
      id: `tk-sys-a${i}`,
      leader: LEADERS[i % LEADERS.length],
      title: `Registrer oppmøte og vurdering for ${c.name}`,
      detail: "Møtte kandidaten til intervjuet, og hva er din vurdering?",
      source: "system",
      relatedCandidateId: c.id,
      dueDate: isoDay(dayOffset(-1 + i)),
      status: i === 0 ? "fullfort" : "forfalt",
      response: i === 0 ? "Møtte presis. God muntlig framstilling, anbefaler videre til godkjenning." : null,
      completedAt: i === 0 ? iso(dayOffset(-1, 16)) : null,
    });
  });

  booked.forEach((c, i) => {
    out.push({
      id: `tk-sys-b${i}`,
      leader: LEADERS[(i + 2) % LEADERS.length],
      title: `Forbered intervju med ${c.name}`,
      detail: "Les gjennom kandidatkortet før intervjuet.",
      source: "system",
      relatedCandidateId: c.id,
      dueDate: isoDay(dayOffset(1 + i)),
      status: "apen",
      response: null,
      completedAt: null,
    });
  });

  out.push(
    {
      id: "tk-sys-c1",
      leader: "Ola Nordmann",
      title: "Følg opp fravær i Team Vest",
      detail: "Tre ikke-møtt siste uke. Ta en samtale med hver av dem.",
      source: "system",
      relatedCandidateId: null,
      dueDate: isoDay(dayOffset(-3)),
      status: "forfalt",
      response: null,
      completedAt: null,
    },
    {
      id: "tk-egen-1",
      leader: "Ola Nordmann",
      title: "Lage ny vaktplan for september",
      detail: "Sette opp september sammen med teamet.",
      source: "egen",
      relatedCandidateId: null,
      dueDate: isoDay(dayOffset(5)),
      status: "apen",
      response: null,
      completedAt: null,
    },
    {
      id: "tk-sys-c2",
      leader: "Marte Solberg",
      title: "Godkjenn vaktbytte i Team Nord",
      detail: "To forespørsler venter på deg.",
      source: "system",
      relatedCandidateId: null,
      dueDate: isoDay(dayOffset(1)),
      status: "apen",
      response: null,
      completedAt: null,
    },
    {
      id: "tk-sys-c3",
      leader: "Jonas Five",
      title: "Send kandidat til godkjenning",
      detail: "Intervjuet er gjennomført, men skjemaet til Ole er ikke fylt ut.",
      source: "system",
      relatedCandidateId: null,
      dueDate: isoDay(dayOffset(-5)),
      status: "forfalt",
      response: null,
      completedAt: null,
    },
    {
      id: "tk-sys-c4",
      leader: "Silje Hauge",
      title: "Bekreft første arbeidsdag for nyansatte",
      detail: "To personer starter neste uke.",
      source: "system",
      relatedCandidateId: null,
      dueDate: isoDay(dayOffset(2)),
      status: "fullfort",
      response: "Begge bekreftet på telefon. Møter mandag kl. 09.",
      completedAt: iso(dayOffset(-1, 11)),
    },
  );

  return out;
}
