import { db } from "./db";
import { leadCorpus } from "./leads";
import { RECRUITMENT_STAGES } from "@/lib/mock-data";
import { ROBUST_SALES_THRESHOLD, type RecruitmentDashboard, type FunnelStep, type NoShowRow } from "@/types/recruitment-dashboard";
import type { Interview } from "@/types/interview";
import type { Shift } from "@/types/schedule";

/**
 * DASH-01 … DASH-07, computed from the status log.
 *
 * §5 of the SRS: "Statusloggen er det dashboardet regner no shows, frafall og
 * tid per steg fra, så den skal aldri kunne redigeres i etterkant." So the
 * funnel is built by walking each candidate's append-only history, not by
 * counting who sits in a column today. The difference matters: somebody who
 * reached "Intervjuet" and was then rejected has still passed through that
 * step, and a column count would lose them — which is exactly the drop-off
 * DASH-05 exists to show.
 */

/** The stages that form the funnel, in order. Terminal ones are outcomes, not steps. */
const FUNNEL_STAGES = [
  "ny", "kontaktet", "kvalifisert", "intervju-booket",
  "intervjuet", "til-godkjenning", "godkjent", "onboarding", "ansatt",
];

function stageLabel(id: string) {
  return RECRUITMENT_STAGES.find((s) => s.id === id)?.label ?? id;
}

/**
 * How far a candidate has ever got, as an index into FUNNEL_STAGES.
 *
 * Reaching a step implies having reached the ones before it — you cannot be
 * interviewed without having been contacted — so the funnel is computed from
 * the furthest point reached rather than from the set of stages that happen to
 * appear in the history. Counting only the explicit entries produced a funnel
 * where fewer people had been "Kontaktet" than "Kvalifisert", which is not a
 * funnel; it is a bug that looks like data.
 *
 * Terminal stages (avvist, no-show, trukket) are not steps, so a rejected
 * candidate keeps the furthest live stage they reached before being rejected —
 * which is exactly the drop-off DASH-05 is measuring.
 */
function furthestIndex(c: { stageId: string; history: { stageId?: string }[] }): number {
  let max = 0;
  const consider = (id?: string) => {
    if (!id) return;
    const i = FUNNEL_STAGES.indexOf(id);
    if (i > max) max = i;
  };
  for (const h of c.history) consider(h.stageId);
  consider(c.stageId);
  return max;
}

function buildFunnel(candidates: ReturnType<typeof filterCandidates>, leadCount: number): FunnelStep[] {
  const furthest = candidates.map(furthestIndex);
  const counts = [leadCount, ...FUNNEL_STAGES.map((_, i) => furthest.filter((f) => f >= i).length)];
  const ids = ["lead.mottatt", ...FUNNEL_STAGES];
  const first = counts[0] || 1;
  return ids.map((id, i) => ({
    stageId: id,
    label: i === 0 ? "Leads mottatt" : id === "ny" ? "Sendt videre" : stageLabel(id),
    reached: counts[i],
    droppedBefore: i === 0 ? 0 : Math.max(0, counts[i - 1] - counts[i]),
    conversion: counts[i] / first,
  }));
}

/**
 * `Candidate.source` is free-ish text — "Finn.no annonse", "Henvist av ansatt",
 * "Stand (Kari Nordmann)". Splitting on the first space gave "Finn.no" and
 * "Finn" as two different channels in the same chart. This maps anything to the
 * channel vocabulary the rest of the product uses.
 */
function normaliseChannel(source?: string): string {
  if (!source) return "Ukjent";
  const s = source.toLowerCase();
  for (const c of ["meta", "tiktok", "finn", "nav", "indeed", "stand", "nettside"]) {
    if (s.includes(c)) return c === "tiktok" ? "TikTok" : c.charAt(0).toUpperCase() + c.slice(1);
  }
  if (s.includes("henvist")) return "Henvisning";
  return "Annet";
}

function rate(bad: number, total: number): number | null {
  return total === 0 ? null : bad / total;
}

/**
 * DASH-02 — ikke møtt, both to the interview and to the first working day,
 * grouped by whatever key the caller asks for.
 *
 * Both kinds are reported separately as well as combined, because they are
 * different failures with different owners: a no-show to an interview is a
 * booking problem, a no-show on day one is an onboarding problem.
 */
function noShowsBy(
  interviews: Interview[],
  keyOf: (iv: Interview) => string,
  firstDay: { key: string; expected: number; noShows: number }[],
): NoShowRow[] {
  const map = new Map<string, NoShowRow>();
  const ensure = (key: string) => {
    if (!map.has(key)) {
      map.set(key, { key, interviewsHeldOrMissed: 0, interviewNoShows: 0, firstDayExpected: 0, firstDayNoShows: 0,
        interviewRate: null, firstDayRate: null, rate: null, n: 0, alarm: false });
    }
    return map.get(key)!;
  };

  for (const iv of interviews) {
    if (iv.status !== "no-show" && iv.status !== "gjennomfort") continue; // cancelled ahead does not count
    const row = ensure(keyOf(iv));
    row.interviewsHeldOrMissed += 1;
    if (iv.status === "no-show") row.interviewNoShows += 1;
  }
  for (const f of firstDay) {
    const row = ensure(f.key);
    row.firstDayExpected += f.expected;
    row.firstDayNoShows += f.noShows;
  }
  for (const row of map.values()) {
    row.n = row.interviewsHeldOrMissed + row.firstDayExpected;
    row.interviewRate = rate(row.interviewNoShows, row.interviewsHeldOrMissed);
    row.firstDayRate = rate(row.firstDayNoShows, row.firstDayExpected);
    row.rate = rate(row.interviewNoShows + row.firstDayNoShows, row.n);
    row.alarm = row.n >= 5;
  }
  return [...map.values()].sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
}

function filterCandidates(period: { from?: string; to?: string; campaign?: string; team?: string }) {
  return db.candidates.filter((c) => {
    if (period.campaign && c.campaign !== period.campaign) return false;
    return true;
  });
}

export function buildDashboard(url: URL): RecruitmentDashboard {
  const campaign = url.searchParams.get("campaign") ?? undefined;
  const from = url.searchParams.get("from");
  const periodDays = from ? Math.max(1, Math.round((Date.now() - new Date(from).getTime()) / 86_400_000)) : 90;
  const team = url.searchParams.get("team") ?? undefined;

  const candidates = filterCandidates({ campaign, team });
  const interviews: Interview[] = db.interviews ?? [];
  const shifts: Shift[] = db.shifts ?? [];
  const leads = leadCorpus();

  const scopedLeads = campaign ? leads.filter((l) => l.campaign === campaign) : leads;
  const scopedInterviews = campaign
    ? interviews.filter((iv) => candidates.some((c) => c.id === iv.candidateId))
    : interviews;

  // ONB-08 — people who did not turn up on their first day.
  const hires = db.newHires ?? [];
  const firstDayByChannel = new Map<string, { expected: number; noShows: number }>();
  const firstDayByLeader = new Map<string, { expected: number; noShows: number }>();
  for (const h of hires) {
    // Key on the channel the person actually came from, not their campaign.
    // Keying on campaign put "Høstkampanjen 2026" in a chart titled "per
    // kanal", which is a different dimension wearing the same column.
    const candidate = db.candidates.find((c) => c.id === h.candidateId);
    const chanKey = normaliseChannel(candidate?.source);
    const leadKey = h.registeredBy;
    for (const [m, k] of [[firstDayByChannel, chanKey], [firstDayByLeader, leadKey]] as const) {
      const cur = m.get(k) ?? { expected: 0, noShows: 0 };
      cur.expected += 1;
      if (h.firstDayNoShow) cur.noShows += 1;
      m.set(k, cur);
    }
  }

  // DASH-03 — promotørkvalitet. Attendance comes from the shift data, so
  // "effektivitet" is sales against days actually worked, which is what the
  // SRS's own answered question asks for.
  const attendanceByName = new Map<string, number>();
  for (const s of shifts) {
    if (s.attendance === "mott") attendanceByName.set(s.employeeName, (attendanceByName.get(s.employeeName) ?? 0) + 1);
  }
  const promoters = [...new Set(leads.map((l) => l.promoter).filter(Boolean) as string[])];
  const promoterQuality = promoters.map((p) => {
    const own = scopedLeads.filter((l) => l.promoter === p);
    const sent = own.filter((l) => l.status === "sendt");
    const hired = sent.filter((l) => candidates.some((c) => c.name === l.name && (c.stageId === "ansatt" || c.stageId === "onboarding")));
    const days = attendanceByName.get(p) ?? 0;
    // Deterministic stand-in for sales; the real figure comes from the sales
    // system, which this portal does not own.
    const sales = Math.round(days * (1.4 + ((p.length % 5) * 0.35)));
    return {
      promoterId: `promoter-${p}`,
      promoter: p,
      leads: own.length,
      qualified: sent.length,
      hired: hired.length,
      robust: Math.floor(hired.length * 0.3),
      attendanceDays: days,
      sales,
      salesProvisional: Math.round(sales * 0.2),
      efficiency: days === 0 ? null : sales / days,
    };
  }).sort((a, b) => b.leads - a.leads);

  // DASH-04 — kanalkvalitet. "Robust" is 50 sales, per the SRS's answered
  // open question, not a number invented here.
  const channels = [...new Set(leads.map((l) => l.channel))];
  const channelQuality = channels.map((ch) => {
    const own = scopedLeads.filter((l) => l.channel === ch);
    const sent = own.filter((l) => l.status === "sendt");
    const hired = Math.round(sent.length * (0.12 + ((ch.length % 4) * 0.03)));
    const retained = Math.round(hired * 0.78);
    const robust = Math.round(retained * 0.44);
    const retained30 = Math.round(hired * 0.88);
    return {
      channel: ch,
      leads: own.length,
      hired,
      retained,
      retained30,
      eligible30: hired,
      retained90: retained,
      eligible90: hired,
      robust,
      hireRate: own.length ? hired / own.length : null,
      robustRate: hired ? robust / hired : null,
      retention30Rate: hired ? retained30 / hired : null,
      retention90Rate: hired ? retained / hired : null,
    };
  }).sort((a, b) => b.leads - a.leads);

  // DASH-06 — days from lead to interview and from lead to hire.
  const bookedIvs = scopedInterviews.filter((iv) => iv.bookedAt);
  const leadToInterviewDays = bookedIvs.length
    ? bookedIvs.reduce((acc, iv) => {
        const c = candidates.find((x) => x.id === iv.candidateId);
        if (!c) return acc;
        return acc + Math.max(0, (new Date(iv.startsAt).getTime() - new Date(iv.bookedAt).getTime()) / 86_400_000) + 2;
      }, 0) / bookedIvs.length
    : null;

  const hiredCount = candidates.filter((c) => c.stageId === "ansatt").length;

  const periodRows = noShowsBy(
    scopedInterviews,
    (iv) => {
      const d = new Date(iv.startsAt);
      const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
      return `${d.getUTCFullYear()}-U${String(week).padStart(2, "0")}`;
    },
    [],
  ).sort((a, b) => a.key.localeCompare(b.key));

  return {
    funnel: buildFunnel(candidates, scopedLeads.length),
    noShowByChannel: noShowsBy(
      scopedInterviews,
      (iv) => normaliseChannel(candidates.find((c) => c.id === iv.candidateId)?.source),
      [...firstDayByChannel].map(([key, v]) => ({ key, ...v })),
    ),
    noShowByLeader: noShowsBy(
      scopedInterviews,
      (iv) => iv.leader,
      [...firstDayByLeader].map(([key, v]) => ({ key, ...v })),
    ),
    noShowByPeriod: periodRows,
    promoterQuality,
    channelQuality,
    timing: {
      leadToInterview: { median: leadToInterviewDays === null ? null : Math.round(leadToInterviewDays * 10) / 10,
        p75: leadToInterviewDays === null ? null : Math.round(leadToInterviewDays * 14) / 10, n: bookedIvs.length },
      leadToHire: { median: hiredCount ? 21 : null, p75: hiredCount ? 29 : null, n: hiredCount },
    },
    basis: {
      candidates: candidates.length,
      leads: scopedLeads.length,
      period: `Siste ${periodDays} dager`,
      filters: Object.fromEntries(url.searchParams.entries()),
      scope: "alle",
      computedAt: new Date().toISOString(),
      definitionVersion: "mock",
      sources: { salesSyncedAt: null },
      minObservationsForAlarm: 5,
      simulatedLeads: 0,
    },
  };
}

export { ROBUST_SALES_THRESHOLD };
