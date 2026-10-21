import type { Ad, AdTemplate, Board, Publication } from "@/types/ad";
import type { Interview, InterviewMessage, Leader } from "@/types/interview";
import { CANDIDATES } from "@/lib/mock-data";
import { LEADERS, iso, isoDay } from "./srs-seed";

/**
 * A3 fixtures (ANN, BOOK) in the recruitment-service contract.
 *
 * Mock mode must look like the real thing (master, 21.10): the same shapes the
 * server returns, publications that wait for the board, messages that get a
 * delivery status, a leader calendar with real busy blocks. The texts follow
 * SRS l.4 — no money, no sales wording in anything a candidate reads.
 */

export const BOARDS: Board[] = [
  { key: "nav", name: "Nav (arbeidsplassen.no)", free: true, mode: "push", enabled: true },
  { key: "indeed", name: "Indeed", free: true, mode: "feed", enabled: true },
  { key: "finn", name: "Finn", free: false, mode: "manual", enabled: true },
];

export const JOB_TYPES = ["Promotør, dør til dør", "Promotør, stand", "Teamleder", "Rekrutterer"];
export const LOCATIONS = ["Oslo", "Bergen", "Trondheim", "Stavanger", "Kristiansand", "Tromsø"];

/** Leaders by id; the names match the rest of the demo (tasks, dashboard). */
export const MOCK_LEADERS: Leader[] = LEADERS.map((name, i) => ({
  id: `led-${name.split(" ")[0].toLowerCase()}`,
  name,
  teams: [["Team Vest"], ["Team Nord"], ["Team Sør"], ["Team Øst"]][i % 4],
}));
export const leaderByName = (name: string) => MOCK_LEADERS.find((l) => l.name === name) ?? MOCK_LEADERS[0];
export const leaderById = (id: string) => MOCK_LEADERS.find((l) => l.id === id);

export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: "tpl-promotor-oslo",
    name: "Promotør Oslo",
    jobType: "Promotør, dør til dør",
    location: "Oslo",
    title: "Promotør i Oslo – bli med på laget",
    body:
      "Liker du å møte folk og snakke om saker som betyr noe? Som promotør hos AB Marketing er du ute " +
      "blant folk for kjente frivillige organisasjoner. Du får opplæring, et godt team rundt deg og en " +
      "leder som følger deg opp.\n\nVi ser etter deg som er åpen, pålitelig og liker å jobbe sammen med " +
      "andre. Erfaring er ikke nødvendig. Fleksible dager som passer for studenter.\n\nSøk i dag, så tar vi " +
      "kontakt for en kort prat.",
  },
  {
    id: "tpl-promotor-bergen",
    name: "Promotør Bergen",
    jobType: "Promotør, dør til dør",
    location: "Bergen",
    title: "Promotør i Bergen – bli med på laget",
    body:
      "Liker du å møte folk og snakke om saker som betyr noe? Som promotør hos AB Marketing er du ute " +
      "blant folk for kjente frivillige organisasjoner i Bergen. Du får opplæring, et godt team og en " +
      "leder som følger deg opp.\n\nErfaring er ikke nødvendig. Søk i dag, så tar vi kontakt.",
  },
  {
    id: "tpl-teamleder",
    name: "Teamleder Oslo",
    jobType: "Teamleder",
    location: "Oslo",
    title: "Teamleder – bygg og følg opp ditt eget team",
    body:
      "Vi søker teamledere som vil ta ansvar for et team av promotører.\n\nSom teamleder har du ansvar " +
      "for oppfølging, opplæring og utvikling av teamet ditt, og du jobber tett med lederne over deg.\n\n" +
      "Vi ser etter deg som har erfaring fra feltarbeid eller kundekontakt, og som trives med å få andre " +
      "til å lykkes.",
  },
];

/** Today ± n days at an Oslo-ish hour (ads and publications, relative to the real date). */
function dayOffset(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 2, minute, 0, 0);
  return d;
}

export function trackingUrl(publicId: string, token: string) {
  return `https://erp.abmarketing.no/soknad/${publicId}?k=${token}`;
}

function pub(adId: string, publicId: string, board: string, p: Partial<Publication>): Publication {
  const b = BOARDS.find((x) => x.key === board)!;
  const token = `${board}${adId.slice(-1)}tok`;
  return {
    id: `${adId}-${board}`, platform: board, platformName: b.name, externalId: "", trackingUrl: trackingUrl(publicId, token),
    state: "publisert", manual: b.mode === "manual", publishedAt: null, unpublishedAt: null, lastError: "", applicants: 0,
    ...p,
  };
}

function ad(a: Omit<Ad, "applicantsTotal" | "acceptingApplications" | "campaignId" | "unpublishedReason"> &
  Partial<Pick<Ad, "unpublishedReason">>): Ad {
  return {
    campaignId: null, unpublishedReason: "", ...a,
    applicantsTotal: a.publications.reduce((n, p) => n + p.applicants, 0),
    acceptingApplications: a.status === "publisert",
  };
}

export const ADS: Ad[] = [
  ad({
    id: "ad-1", publicId: "k3m9q2x7aa", title: AD_TEMPLATES[0].title, jobType: "Promotør, dør til dør", location: "Oslo",
    campaign: "Høstkampanjen 2026", body: AD_TEMPLATES[0].body, status: "publisert", deadline: isoDay(dayOffset(21)),
    createdAt: iso(dayOffset(-24)), createdBy: "Fredrik Amundsen",
    publications: [
      pub("ad-1", "k3m9q2x7aa", "nav", { externalId: "k3m9q2x7aa", publishedAt: iso(dayOffset(-24, 11)), applicants: 41 }),
      pub("ad-1", "k3m9q2x7aa", "indeed", { externalId: "", publishedAt: iso(dayOffset(-24, 11)), applicants: 18 }),
      pub("ad-1", "k3m9q2x7aa", "finn", { externalId: "334455667", publishedAt: iso(dayOffset(-23, 9)), applicants: 27 }),
    ],
  }),
  ad({
    id: "ad-2", publicId: "b8t2w5n1cc", title: AD_TEMPLATES[1].title, jobType: "Promotør, dør til dør", location: "Bergen",
    campaign: "Bergen oppstart", body: AD_TEMPLATES[1].body, status: "publisert", deadline: isoDay(dayOffset(9)),
    createdAt: iso(dayOffset(-12)), createdBy: "Hanne Lie",
    publications: [
      // A board that refused: the «Feilet» state with a reason and «Prøv igjen».
      pub("ad-2", "b8t2w5n1cc", "nav", { state: "feilet", lastError: "Nav svarte 400: mangler kategori (STYRK).", applicants: 0 }),
      pub("ad-2", "b8t2w5n1cc", "indeed", { publishedAt: iso(dayOffset(-12, 13)), applicants: 9 }),
      // Finn in manual mode, waiting for the pasted id (ANN-02).
      pub("ad-2", "b8t2w5n1cc", "finn", { state: "venter" }),
    ],
  }),
  ad({
    id: "ad-3", publicId: "t4r7y1u0dd", title: AD_TEMPLATES[2].title, jobType: "Teamleder", location: "Trondheim",
    campaign: "Vinterrekruttering 2027", body: AD_TEMPLATES[2].body, status: "utkast", deadline: null,
    createdAt: iso(dayOffset(-2)), createdBy: "Ida Moen", publications: [],
  }),
  ad({
    id: "ad-4", publicId: "s9d3f6g2ee", title: "Promotør i Stavanger – sommerjobb", jobType: "Promotør, dør til dør",
    location: "Stavanger", campaign: "Høstkampanjen 2026", body: AD_TEMPLATES[0].body, status: "avpublisert",
    // ANN-05 — the deadline passed, so the ad took itself down.
    deadline: isoDay(dayOffset(-6)), unpublishedReason: "frist", createdAt: iso(dayOffset(-61)), createdBy: "Fredrik Amundsen",
    publications: [
      pub("ad-4", "s9d3f6g2ee", "nav", { state: "avpublisert", externalId: "s9d3f6g2ee", publishedAt: iso(dayOffset(-61, 10)), unpublishedAt: iso(dayOffset(-5, 0)), applicants: 55 }),
      pub("ad-4", "s9d3f6g2ee", "indeed", { state: "avpublisert", publishedAt: iso(dayOffset(-61, 10)), unpublishedAt: iso(dayOffset(-5, 0)), applicants: 12 }),
    ],
  }),
];

// ── Intervjuer (BOOK) ───────────────────────────────────────────────────────

const WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTHS = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

/** Same wording as the server («tirsdag 4. november kl. 10.00»). */
export function fmtWhen(isoStr: string) {
  const d = new Date(isoStr);
  const parts = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    .formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const local = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Oslo" }));
  return `${WEEKDAYS[local.getDay()]} ${get("day")}. ${MONTHS[Number(get("month")) - 1]} kl. ${get("hour")}.${get("minute")}`;
}

export const LOCATION_DEFAULT = "AB Marketing, Karl Johans gate 12, Oslo";
const CONTACT = "+47 900 11 222";

/** The rendered booking messages, identical in wording to the server templates. */
export function bookingMessages(iv: Pick<Interview, "id" | "candidateName" | "candidatePhone" | "leader" | "startsAt" | "location">,
  email: string, leaderPhone: string, sentAt: string, token: string): InterviewMessage[] {
  const first = iv.candidateName.split(" ")[0];
  const when = fmtWhen(iv.startsAt);
  const link = `https://erp.abmarketing.no/intervju/${token}`;
  const base = { sentAt, sendAfter: null, status: "delivered" as const, error: "", subject: "" };
  const out: InterviewMessage[] = [
    { ...base, id: `${iv.id}-m1`, channel: "sms", to: iv.candidatePhone, recipientRole: "kandidat", kind: "bekreftelse",
      body: `Hei ${first}! Du har intervju hos AB Marketing ${when}, ${iv.location}. Du møter ${iv.leader.name}. Spørsmål: ${CONTACT}. Flytt eller avbestill: ${link}` },
    { ...base, id: `${iv.id}-m2`, channel: "sms", to: leaderPhone, recipientRole: "leder", kind: "bekreftelse",
      body: `Intervju booket: ${iv.candidateName} ${when}, ${iv.location}. Kandidatens tlf: ${iv.candidatePhone}. Invitasjonen ligger i kalenderen din.` },
  ];
  if (email) {
    out.push({ ...base, id: `${iv.id}-m3`, channel: "epost", to: email, recipientRole: "kandidat", kind: "bekreftelse",
      subject: `Intervju hos AB Marketing ${when}`,
      body: `Hei ${first},\n\nTakk for at du vil snakke med oss. Intervjuet er satt opp ${when}, ${iv.location}.\n\nDu møter ${iv.leader.name}. Har du spørsmål, ring ${CONTACT}.\n\nKalenderinvitasjonen ligger vedlagt. Trenger du å flytte eller avbestille, bruk denne lenken:\n${link}\n\nVennlig hilsen\nAB Marketing` });
  }
  return out;
}

/**
 * The n-th weekday after (or before, n < 0) TODAY, at an Oslo hour. Interviews are relative
 * to the real date so «Kommende» is always in the future and the booking week lines up with
 * the lists (master, design review round 1). Never on a weekend.
 */
function weekday(n: number, hour: number, minute = 0) {
  const base = new Date();
  base.setUTCHours(12, 0, 0, 0);
  let left = Math.abs(n);
  const step = n < 0 ? -1 : 1;
  const d = new Date(base);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }
  // Oslo is UTC+1/+2; resolve the offset for that day so 10:00 means 10:00 in Oslo.
  const probe = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
  const osloHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", hour12: false }).format(probe));
  const offset = osloHour - 12;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour - offset, minute));
}

export function buildInterviews(): Interview[] {
  const booked = CANDIDATES.filter((c) => c.stageId === "intervju-booket").slice(0, 4);
  const done = CANDIDATES.filter((c) => c.stageId === "intervjuet").slice(0, 3);
  const out: Interview[] = [];

  booked.forEach((c, i) => {
    // The first one took place yesterday and still waits for the leader's outcome (BOOK-08).
    const startsAt = iso(i === 0 ? weekday(-1, 13) : weekday(i, 10 + (i % 4), i % 2 ? 30 : 0));
    const leader = leaderByName(LEADERS[i % LEADERS.length]);
    const id = `iv-${c.id}`;
    const iv: Interview = {
      id, candidateId: c.id, candidateName: c.name, candidatePhone: c.phone, candidateStatus: "intervju-booket",
      leader: { id: leader.id, name: leader.name }, startsAt, endsAt: iso(new Date(new Date(startsAt).getTime() + 30 * 60000)),
      location: LOCATION_DEFAULT, status: "booket", calendarEventId: `mock-${1000 + i}`,
      // One invite the calendar refused, so «Invitasjon ikke sendt» is demonstrable.
      calendarState: i === 3 ? "feilet" : "synket",
      reminderEnabled: i !== 2, reminderSentAt: null, attended: null, assessment: "", rating: null, recommend: null,
      outcomeAt: null, bookedBy: c.owner, bookedAt: iso(weekday(-3, 14)), cancelledAt: null, cancelledBy: "",
      rebookedTo: null, messages: [],
    };
    iv.messages = bookingMessages(iv, c.email, `+47 900 11 2${i}2`, iso(weekday(-3, 14, 2)), `tok-${c.id}`);
    out.push(iv);
  });

  done.forEach((c, i) => {
    const startsAt = iso(weekday(-1 - i, 11, 0));
    const leader = leaderByName(LEADERS[(i + 1) % LEADERS.length]);
    // One did not turn up — DASH-02 needs something to count.
    const attended = i !== 1;
    const id = `iv-${c.id}`;
    const iv: Interview = {
      id, candidateId: c.id, candidateName: c.name, candidatePhone: c.phone, candidateStatus: attended ? "intervjuet" : "no-show",
      leader: { id: leader.id, name: leader.name }, startsAt, endsAt: iso(new Date(new Date(startsAt).getTime() + 30 * 60000)),
      location: LOCATION_DEFAULT, status: attended ? "gjennomfort" : "no-show", calendarEventId: `mock-${2000 + i}`,
      calendarState: "synket", reminderEnabled: true, reminderSentAt: iso(weekday(-2 - i, 17)), attended,
      assessment: attended
        ? ["God muntlig framstilling, virker motivert. Anbefaler videre.", "Litt usikker, men lærevillig. Kan prøves på et mindre team."][i % 2]
        : "Møtte ikke, svarte ikke på telefon.",
      rating: attended ? [4, 3][i % 2] : null, recommend: attended ? i % 2 === 0 : null, outcomeAt: iso(weekday(-1 - i, 12)),
      bookedBy: c.owner, bookedAt: iso(weekday(-4 - i, 9)), cancelledAt: null, cancelledBy: "", rebookedTo: null, messages: [],
    };
    iv.messages = bookingMessages(iv, c.email, `+47 900 11 3${i}3`, iso(weekday(-4 - i, 9, 5)), `tok-${c.id}`);
    out.push(iv);
  });

  return out;
}

/** The mock leader calendar: lunch daily, a team meeting some mornings, a field afternoon. */
export function busyBlocks(leaderId: string, day: Date): [number, number][] {
  const seed = [...`${leaderId}${day.getUTCDate()}`].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const probe = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12));
  const off = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", hour12: false }).format(probe)) - 12;
  const at = (h: number, m: number) => Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h - off, m);
  const out: [number, number][] = [[at(11, 30), at(12, 0)]];
  if (seed % 3 === 0) out.push([at(9, 0), at(10, 0)]);
  if (seed % 4 === 1) out.push([at(14, 0), at(15, 0)]);
  if (day.getUTCDay() === (leaderId.length % 5) + 1) out.push([at(13, 0), at(16, 0)]);
  return out;
}
