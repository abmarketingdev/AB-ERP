import { LEAD_CHANNELS, type Lead, type LeadChannel, type LeadStatus } from "@/types/lead";

/**
 * IFK-07 — the samleinnboks must load in under 2 seconds with 10 000 leads.
 *
 * That number is the reason this file exists instead of a fixture array. Ten
 * thousand leads is roughly 4 MB of JSON, which does not fit in the
 * sessionStorage the rest of the mock DB persists to, and writing it there
 * would silently break every other demo write when the quota was hit.
 *
 * So the corpus is *generated* from a seeded PRNG — identical on every load,
 * never stored — and the handful of records the demo actually changes are kept
 * as a small overlay in the real DB. This also makes the mock behave the way
 * the backend will have to: filtering, sorting and paging happen on the server,
 * and the client receives one page.
 */

export const LEAD_COUNT = 10_000;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const FIRST = [
  "Amalie", "Tobias", "Ingrid", "Mathias", "Sofie", "Jonas", "Nora", "Emil", "Thea", "Oskar",
  "Linnea", "Henrik", "Maja", "Aksel", "Vilde", "Sander", "Hedda", "Kasper", "Ida", "Markus",
  "Selma", "Elias", "Frida", "Noah", "Ella", "Filip", "Live", "Theodor", "Agnes", "Isak",
  "Jenny", "Lucas", "Mina", "Herman", "Aurora", "Adrian", "Emilie", "Johannes", "Tuva", "Daniel",
];
const LAST = [
  "Strand", "Wiig", "Haugen", "Berg", "Lie", "Dahl", "Moen", "Ruud", "Bakken", "Solheim",
  "Aas", "Holm", "Nygård", "Fjeld", "Vik", "Sæther", "Lund", "Eriksen", "Hagen", "Pedersen",
  "Johansen", "Andreassen", "Kristiansen", "Bøe", "Tangen", "Sandvik", "Lysaker", "Ødegård",
];
const CAMPAIGNS = ["Høstkampanjen 2026", "Vinterrekruttering 2027", "Student høst 2026", "Bergen oppstart"];
const PROMOTERS = ["Kari Nordmann", "Jon Berge", "Silje Aune", "Petter Holt", "Mariam Osei"];
const RECRUITERS = ["Fredrik Amundsen", "Hanne Lie", "Ida Moen"];

/** Weighted so the channel mix looks like a real month, not a uniform draw. */
const CHANNEL_WEIGHTS: [LeadChannel, number][] = [
  ["Meta", 0.31], ["TikTok", 0.18], ["Finn", 0.14], ["Nettside", 0.13],
  ["Stand", 0.12], ["Indeed", 0.07], ["Nav", 0.05],
];

function pickChannel(r: number): LeadChannel {
  let acc = 0;
  for (const [c, w] of CHANNEL_WEIGHTS) {
    acc += w;
    if (r <= acc) return c;
  }
  return "Meta";
}

/** The demo's "today". Matches the rest of the fixtures. */
const NOW = new Date("2026-08-20T09:12:00.000Z").getTime();
const DAY = 86_400_000;

function build(i: number): Lead {
  const r = rng(i * 2654435761 + 7);
  const first = FIRST[Math.floor(r() * FIRST.length)];
  const last = LAST[Math.floor(r() * LAST.length)];
  const channel = pickChannel(r());
  const isStand = channel === "Stand";

  // Skewed towards recent: most of the inbox is this week's intake.
  const ageDays = Math.floor(Math.pow(r(), 2.2) * 90);
  const receivedAt = new Date(NOW - ageDays * DAY - Math.floor(r() * DAY)).toISOString();

  /*
   * Older leads have mostly been dealt with; the newest are untouched. Without
   * this the inbox is either all "Ny" (and the filters demonstrate nothing) or
   * uniformly mixed (which no real inbox is).
   */
  const settled = r();
  let status: LeadStatus = "ny";
  if (ageDays > 3) status = settled < 0.72 ? "sendt" : settled < 0.84 ? "forkastet" : "ny";
  if (ageDays > 21) status = settled < 0.9 ? "sendt" : "forkastet";

  const assigned = status === "sendt" || r() < 0.35;
  const phoneSeed = 90_000_000 + Math.floor(r() * 9_000_000);

  return {
    id: `l-${i}`,
    name: `${first} ${last}`,
    phone: `+47 ${String(phoneSeed).slice(0, 3)} ${String(phoneSeed).slice(3, 5)} ${String(phoneSeed).slice(5, 7)}`,
    email: `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[øæå]/g, "o") + `${i % 97}@email.no`,
    channel,
    campaign: CAMPAIGNS[Math.floor(r() * CAMPAIGNS.length)],
    receivedAt,
    promoter: isStand ? PROMOTERS[Math.floor(r() * PROMOTERS.length)] : null,
    assignedTo: assigned ? RECRUITERS[Math.floor(r() * RECRUITERS.length)] : null,
    status,
    consent: {
      contact: true,
      adAudience: r() < 0.58,
      at: receivedAt,
      text: isStand
        ? "Samtykket muntlig på stand til å bli kontaktet om stilling."
        : "Huket av for å bli kontaktet om stilling ved innsending av skjema.",
    },
    adId: channel === "Meta" || channel === "TikTok" || channel === "Finn" ? `ad-${1 + (i % 6)}` : null,
    note: null,
    candidateId: null,
    duplicateOf: [],
  };
}

let corpus: Lead[] | null = null;

/**
 * LEAD-07 — duplicates are found once, over the whole corpus, not per page.
 *
 * The generator deliberately produces collisions (the e-mail carries `i % 97`,
 * so the same name recurs with the same address) because a duplicate-merge
 * screen with nothing to merge demonstrates nothing.
 */
function linkDuplicates(rows: Lead[]) {
  const byKey = new Map<string, string[]>();
  for (const l of rows) {
    for (const key of [`p:${l.phone}`, `e:${l.email}`]) {
      const arr = byKey.get(key) ?? [];
      arr.push(l.id);
      byKey.set(key, arr);
    }
  }
  const linked = new Map<string, Set<string>>();
  for (const ids of byKey.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const set = linked.get(id) ?? new Set<string>();
      for (const other of ids) if (other !== id) set.add(other);
      linked.set(id, set);
    }
  }
  for (const l of rows) l.duplicateOf = [...(linked.get(l.id) ?? [])];
}

export function leadCorpus(): Lead[] {
  if (!corpus) {
    corpus = Array.from({ length: LEAD_COUNT }, (_, i) => build(i));
    linkDuplicates(corpus);
  }
  return corpus;
}

export const LEAD_PROMOTERS = PROMOTERS;
export const LEAD_RECRUITERS = RECRUITERS;
export const LEAD_CAMPAIGNS = CAMPAIGNS;
export { LEAD_CHANNELS };
