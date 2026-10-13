import { db, persistDb } from "./db";
import { leadCorpus } from "./leads";
import type { Lead, LeadList } from "@/types/lead";

export const PAGE_SIZE = 50;

/**
 * The corpus with this session's changes applied.
 *
 * Rebuilt per request on purpose: the overlay is tiny and the corpus is already
 * in memory, so this costs about a millisecond, and caching it would mean every
 * mutation needs an invalidation that is easy to forget. The timing is reported
 * to the UI (IFK-07), so if this ever stops being cheap it shows up on screen
 * rather than in a bug report.
 */
function materialise(): Lead[] {
  const base = leadCorpus();
  const overrides = db.leadOverrides;
  const extra = db.leadExtra;
  if (!Object.keys(overrides).length && !extra.length) return base;
  const merged = base.map((l) => (overrides[l.id] ? { ...l, ...overrides[l.id] } : l));
  return extra.length ? [...extra, ...merged] : merged;
}

export function leadById(id: string): Lead | undefined {
  return materialise().find((l) => l.id === id);
}

export function leadsByIds(ids: string[]): Lead[] {
  const want = new Set(ids);
  return materialise().filter((l) => want.has(l.id));
}

export function queryLeads(url: URL): LeadList {
  const t0 = performance.now();
  const p = url.searchParams;
  const channel = p.get("channel");
  const status = p.get("status");
  const promoter = p.get("promoter");
  const assignedTo = p.get("assignedTo");
  const from = p.get("from");
  const to = p.get("to");
  const q = (p.get("q") ?? "").trim().toLowerCase();
  const onlyDuplicates = p.get("duplicates") === "1";
  const page = Math.max(1, Number(p.get("page") ?? 1));

  let rows = materialise();

  if (channel) rows = rows.filter((l) => l.channel === channel);
  if (status) rows = rows.filter((l) => l.status === status);
  if (promoter) rows = rows.filter((l) => l.promoter === promoter);
  if (assignedTo) {
    rows = assignedTo === "__none__"
      ? rows.filter((l) => l.assignedTo === null)
      : rows.filter((l) => l.assignedTo === assignedTo);
  }
  if (from) rows = rows.filter((l) => l.receivedAt >= from);
  if (to) rows = rows.filter((l) => l.receivedAt <= `${to}T23:59:59.999Z`);
  if (onlyDuplicates) rows = rows.filter((l) => l.duplicateOf.length > 0);
  if (q) {
    rows = rows.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")),
    );
  }

  // Newest first. The inbox is worked from the top.
  rows = [...rows].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  return { rows: rows.slice(start, start + PAGE_SIZE), total, tookMs: Math.round(performance.now() - t0) };
}

/** Every mutation goes through here so nothing forgets to persist. */
export function patchLead(id: string, patch: Partial<Lead>) {
  const extraIdx = db.leadExtra.findIndex((l) => l.id === id);
  if (extraIdx >= 0) {
    db.leadExtra[extraIdx] = { ...db.leadExtra[extraIdx], ...patch };
  } else {
    db.leadOverrides[id] = { ...db.leadOverrides[id], ...patch };
  }
  persistDb();
}

/** Counts for the filter chips, over the whole corpus rather than the page. */
export function leadCounts() {
  const rows = materialise();
  const byStatus: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  let duplicates = 0;
  for (const l of rows) {
    byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    byChannel[l.channel] = (byChannel[l.channel] ?? 0) + 1;
    if (l.duplicateOf.length) duplicates += 1;
  }
  return { total: rows.length, byStatus, byChannel, duplicates };
}
