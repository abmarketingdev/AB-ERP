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

// Annonser (ANN) og intervjuer (BOOK): see ./a3-seed (A3).

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
const CORRECTION_REASONS = [
  { code: "registrert_feil", label: "Registrert feil" }, { code: "kom_senere", label: "Kom senere på dagen" },
  { code: "dro_tidlig", label: "Dro tidlig" }, { code: "avtalt_fravaer", label: "Avtalt fravær" }, { code: "annet", label: "Annet" },
];

/** Mock team ids: the real API keys teams by uuid, the demo by a slug of the name. */
export function teamIdOf(team: string) {
  return `team-${team.toLowerCase().replace(/[^a-zæøå0-9]+/g, "-")}`;
}

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
      const followUp =
        missed && r() > 0.5
          ? { at: iso(dayOffset(d + 1, 9)), by: LEADERS[ei % LEADERS.length], note: "Ringt. Sykt barn, kommer tilbake i morgen." }
          : null;
      out.push({
        id: `sh-${e.id}-${d + 14}`,
        personRef: { kind: "user", id: e.id },
        employeeId: e.id,
        employeeName: e.name,
        teamId: teamIdOf(e.team),
        team: e.team,
        date: isoDay(date),
        kind,
        kindAtPlan: kind,
        source: "plan",
        declaredAvailable: true,
        attendance,
        attendanceHistory:
          attendance === "mott" || attendance === "ikke-mott"
            ? [{ status: attendance, at: iso(dayOffset(d, 16)), by: LEADERS[ei % LEADERS.length], reason: null, correction: false }]
            : [],
        followUps: followUp ? [followUp] : [],
        followUp,
        clearance: null,
        correctionReasons: CORRECTION_REASONS,
        swapPending: false,
        swapState: "none",
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
      fromEmployeeId: a.employeeId,
      toEmployee: b.employeeName,
      toEmployeeId: b.employeeId,
      teamId: a.teamId,
      fromShiftId: a.id,
      toShiftId: b.id,
      fromDate: a.date,
      toDate: b.date,
      reason: ["Eksamen samme dag", "Skal i bryllup", "Legetime jeg ikke får flyttet"][i],
      status: i === 0 ? "venter_kollega" : "venter_leder",
      requestedAt: iso(dayOffset(-1, 18)),
      counterpartRespondedAt: i === 0 ? null : iso(dayOffset(-1, 20)),
      counterpartComment: null,
      decidedAt: null,
      decidedBy: null,
      decisionComment: null,
    });
  }
  return out;
}

// ── Lederoppgaver (OPPG) ────────────────────────────────────────────────────

/** The seed is written the readable way; toTask() turns it into the API's shape. */
interface SeedTask {
  id: string;
  leader: string;
  title: string;
  detail: string;
  source: "system" | "egen";
  relatedCandidateId: string | null;
  dueDate: string;
  status: "apen" | "fullfort" | "forfalt";
  response: string | null;
  completedAt: string | null;
}

const INTERVIEW_SCHEMA: LeaderTask["responseSchema"] = [
  { key: "mott", label: "Møtte kandidaten?", type: "bool", required: true },
  { key: "vurdering", label: "Vurdering", type: "text", required: true, minLength: 3 },
  { key: "rating", label: "Helhetsinntrykk (1–5)", type: "number", min: 1, max: 5, integer: true },
  { key: "anbefales", label: "Anbefales?", type: "bool" },
];

export function leaderIdOf(name: string) {
  return `leader-${name.toLowerCase().replace(/[^a-zæøå]+/g, "-")}`;
}

function toTask(t: SeedTask): LeaderTask {
  const kind = t.source === "egen" ? "egen"
    : t.id.startsWith("tk-sys-a") ? "registrer_oppmote_intervju"
    : t.id === "tk-sys-c3" ? "fyll_godkjenningsdata" : "systemoppgave";
  return {
    id: t.id,
    leaderId: leaderIdOf(t.leader),
    leaderName: t.leader,
    kind,
    kindLabel: kind === "egen" ? "Egen oppgave" : "Systemoppgave",
    source: t.source,
    title: t.title,
    detail: t.detail,
    relatedCandidateId: t.relatedCandidateId,
    dueAt: `${t.dueDate}T12:00:00+02:00`,
    status: t.status === "forfalt" ? "apen" : t.status,
    overdue: t.status === "forfalt",
    answerable: kind !== "fyll_godkjenningsdata",
    responseSchema: kind === "registrer_oppmote_intervju" ? INTERVIEW_SCHEMA : [],
    response: t.response ? [{ key: kind === "registrer_oppmote_intervju" ? "vurdering" : "svar", value: t.response }] : null,
    completedAt: t.completedAt,
    closedReason: t.status === "fullfort" ? "svar" : null,
    payload: kind === "fyll_godkjenningsdata" ? { formUrl: "/godkjenning" } : {},
  };
}

export function buildTasks(): LeaderTask[] {
  const out: SeedTask[] = [];
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

  return out.map(toTask);
}
