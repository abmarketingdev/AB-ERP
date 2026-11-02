"use client";

import * as React from "react";
import { CalendarClock, ChevronLeft, ChevronRight, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendarWeek, useSyncCalendar } from "@/lib/api/interviews";
import { errorMessage } from "@/lib/api/client";
import type { CalendarWeek as Week } from "@/types/interview";
import { todayOslo } from "./week-slot-picker";

/**
 * A person's week from the Google Calendar sync (2026-11-02).
 *
 * Own calendar («Min kalender»): every event with its title, plus our interviews.
 * Someone else's (a recruiter booking for another leader): only «Opptatt» blocks and
 * the interviews the viewer may see — never the titles of the leader's own meetings.
 *
 * Read-only on purpose: the time is picked in WeekSlotPicker, by a person. This
 * component never books anything.
 */

const OSLO = "Europe/Oslo";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO, year: "numeric", month: "2-digit", day: "2-digit" });
const dayHead = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, hour: "2-digit", minute: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: OSLO, hour: "2-digit", minute: "2-digit", hour12: false });

const DEFAULT_FROM = 8;
const DEFAULT_TO = 18;
const HOUR_PX = 44;

type Item = {
  key: string; kind: "event" | "free" | "busy" | "interview";
  startsAt: string; endsAt: string; title: string; location?: string;
};

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(ymd: string) {
  const d = new Date(`${ymd}T12:00:00Z`);
  return addDays(ymd, -((d.getUTCDay() + 6) % 7));
}
const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
/** Minutes after midnight, Oslo time. */
function minutesOf(iso: string) {
  const [h, m] = hmFmt.format(new Date(iso)).split(":").map(Number);
  return (h % 24) * 60 + m;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function itemsOf(week: Week): { timed: Item[]; allDay: Item[] } {
  const timed: Item[] = [];
  const allDay: Item[] = [];
  for (const e of week.events) {
    const it: Item = { key: `e-${e.id}-${e.startsAt}`, kind: e.busy ? "event" : "free", startsAt: e.startsAt,
      endsAt: e.endsAt, title: e.title, location: e.location };
    (e.allDay ? allDay : timed).push(it);
  }
  if (!week.own) {
    for (const b of week.busy) {
      const long = new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime() >= 20 * 3600_000;
      (long ? allDay : timed).push({ key: `b-${b.startsAt}`, kind: "busy", startsAt: b.startsAt, endsAt: b.endsAt, title: "Opptatt" });
    }
  }
  for (const iv of week.interviews) {
    timed.push({ key: `i-${iv.id ?? iv.startsAt}`, kind: "interview", startsAt: iv.startsAt, endsAt: iv.endsAt,
      title: iv.title, location: iv.location });
  }
  return { timed, allDay };
}

const KIND_CLASS: Record<Item["kind"], string> = {
  event: "border-border bg-muted text-foreground",
  free: "border-dashed border-border bg-background text-muted-foreground",
  busy: "border-border text-muted-foreground bg-[repeating-linear-gradient(135deg,var(--color-muted)_0_6px,transparent_6px_12px)]",
  interview: "border-[var(--ab-accent-9)] bg-[var(--ab-accent-3)] text-foreground",
};

export function CalendarWeek({ leaderId, leaderName, compact }: {
  /** Empty = my own calendar. */
  leaderId?: string; leaderName?: string; compact?: boolean;
}) {
  const [week, setWeek] = React.useState(() => mondayOf(todayOslo()));
  const days = 7;
  const q = useCalendarWeek(leaderId ?? "", week, days);
  const sync = useSyncCalendar();
  const data = q.data;

  const dayList = React.useMemo(() => Array.from({ length: days }, (_, i) => addDays(week, i)), [week]);
  const { timed, allDay } = React.useMemo(() => (data ? itemsOf(data) : { timed: [], allDay: [] }), [data]);
  // Weekends only when something is on them.
  const shownDays = dayList.filter((d, i) => i < 5 || timed.some((t) => dayKey(t.startsAt) === d)
    || allDay.some((t) => dayKey(t.startsAt) <= d && dayKey(t.endsAt) > d));
  // Hours: 08–18, widened to whatever is on the calendar this week.
  const fromH = Math.min(DEFAULT_FROM, ...timed.map((t) => Math.floor(minutesOf(t.startsAt) / 60)));
  const toH = Math.max(DEFAULT_TO, ...timed.map((t) => {
    const end = dayKey(t.endsAt) !== dayKey(t.startsAt) ? 24 * 60 : minutesOf(t.endsAt);
    return Math.ceil(end / 60);
  }));
  const hours = Array.from({ length: Math.max(1, toH - fromH) }, (_, i) => fromH + i);
  const isThisWeek = week <= mondayOf(todayOslo());
  const whose = leaderId ? (leaderName ? `${leaderName}s kalender` : "Lederens kalender") : "Kalenderen din";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-9" aria-label="Forrige uke" disabled={isThisWeek}
            onClick={() => setWeek((w) => addDays(w, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-[10rem] text-center text-sm font-medium tabular-nums">
            {cap(dayHead.format(new Date(`${week}T12:00:00Z`)))} – {dayHead.format(new Date(`${addDays(week, 6)}T12:00:00Z`))}
          </p>
          <Button size="icon" variant="ghost" className="size-9" aria-label="Neste uke" onClick={() => setWeek((w) => addDays(w, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <SyncBadge week={data} whose={whose} />}
          {data && data.backend !== "ics" && (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={sync.isPending}
              onClick={() => sync.mutate({ leaderId: leaderId || undefined })}>
              <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} aria-hidden />
              Synk nå
            </Button>
          )}
        </div>
      </div>

      {data && !data.own && (
        <p className="text-xs text-muted-foreground">
          Du ser bare når {leaderName ?? "lederen"} er opptatt, ikke hva avtalene gjelder. Velg selv et ledig tidspunkt — ingenting bookes automatisk.
        </p>
      )}

      {q.isPending ? (
        <Skeleton className={compact ? "h-56" : "h-96"} />
      ) : q.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-sm">
          <p>Kunne ikke hente kalenderen. {errorMessage(q.error)}</p>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Prøv igjen</Button>
        </div>
      ) : (
        <>
          {/* Phone: a list per day */}
          <div className="flex flex-col gap-3 sm:hidden">
            {shownDays.map((d) => {
              const list = [...allDay.filter((t) => dayKey(t.startsAt) <= d && dayKey(t.endsAt) > d),
                ...timed.filter((t) => dayKey(t.startsAt) === d).sort(byTime)];
              return (
                <div key={d} className="rounded-lg border border-border">
                  <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">{cap(dayHead.format(new Date(`${d}T12:00:00Z`)))}</p>
                  {list.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Ingenting i kalenderen</p>
                  ) : (
                    <ul className="flex flex-col gap-1 p-1.5">
                      {list.map((t) => (
                        <li key={t.key} className={`rounded-md border px-2.5 py-1.5 text-sm ${KIND_CLASS[t.kind]}`}>
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {allDay.includes(t) ? "Hele dagen" : `${timeFmt.format(new Date(t.startsAt))}–${timeFmt.format(new Date(t.endsAt))}`}
                          </span>{" "}
                          <span className="font-medium">{t.title}</span>
                          {t.location ? <span className="block truncate text-xs text-muted-foreground">{t.location}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: a time grid */}
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <div className="grid min-w-[40rem]" style={{ gridTemplateColumns: `3rem repeat(${shownDays.length}, minmax(6.5rem, 1fr))` }}>
              <div className="border-b border-border" />
              {shownDays.map((d) => (
                <div key={d} className={`border-b border-l border-border px-2 py-1.5 text-xs ${d === todayOslo() ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {cap(dayHead.format(new Date(`${d}T12:00:00Z`)))}
                  <div className="mt-1 flex flex-col gap-0.5">
                    {allDay.filter((t) => dayKey(t.startsAt) <= d && dayKey(t.endsAt) > d).map((t) => (
                      <span key={t.key} title={t.title} className={`truncate rounded border px-1.5 py-0.5 text-[11px] font-normal ${KIND_CLASS[t.kind]}`}>{t.title}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="relative" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, i) => (
                  <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10.5px] tabular-nums text-muted-foreground" style={{ top: i * HOUR_PX }}>
                    {i === 0 ? "" : `${String(h).padStart(2, "0")}`}
                  </span>
                ))}
              </div>
              {shownDays.map((d) => (
                <div key={d} className="relative border-l border-border" style={{ height: hours.length * HOUR_PX }}>
                  {hours.map((h, i) => (
                    <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR_PX }} />
                  ))}
                  {layout(timed.filter((t) => dayKey(t.startsAt) === d)).map(({ item: t, col, cols }) => {
                    const s = minutesOf(t.startsAt) - fromH * 60;
                    const e = (dayKey(t.endsAt) !== d ? 24 * 60 : minutesOf(t.endsAt)) - fromH * 60;
                    const top = (s / 60) * HOUR_PX;
                    const height = Math.max(18, ((e - s) / 60) * HOUR_PX - 2);
                    return (
                      <div key={t.key}
                        title={`${timeFmt.format(new Date(t.startsAt))}–${timeFmt.format(new Date(t.endsAt))} ${t.title}${t.location ? ` · ${t.location}` : ""}`}
                        className={`absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-[11.5px] leading-tight ${KIND_CLASS[t.kind]}`}
                        style={{ top, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}>
                        <span className="tabular-nums text-[10.5px] text-muted-foreground">{timeFmt.format(new Date(t.startsAt))}</span>{" "}
                        <span className="font-medium">{t.title}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <Legend own={!!data?.own} />
        </>
      )}
    </div>
  );
}

const ms = (iso: string) => new Date(iso).getTime();
const byTime = (a: Item, b: Item) => ms(a.startsAt) - ms(b.startsAt) || ms(b.endsAt) - ms(a.endsAt);

/** Side-by-side columns for overlapping items (simple greedy lanes). */
function layout(items: Item[]) {
  const sorted = [...items].sort(byTime);
  const out: { item: Item; col: number; cols: number }[] = [];
  let group: { item: Item; col: number }[] = [];
  let groupEnd = "";
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => out.push({ ...g, cols }));
    group = [];
  };
  for (const it of sorted) {
    // Compare as instants, not strings: offsets may differ (Z vs +01:00).
    if (group.length && new Date(it.startsAt) >= new Date(groupEnd)) flush();
    const lanes = new Set(group.filter((g) => new Date(g.item.endsAt) > new Date(it.startsAt)).map((g) => g.col));
    let col = 0;
    while (lanes.has(col)) col++;
    group.push({ item: it, col });
    if (group.length === 1 || new Date(it.endsAt) > new Date(groupEnd)) groupEnd = it.endsAt;
  }
  if (group.length) flush();
  return out;
}

function Legend({ own }: { own: boolean }) {
  const chip = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5"><span className={`inline-block size-3 rounded-sm border ${cls}`} />{label}</span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {chip(KIND_CLASS.interview, "Intervju")}
      {own ? chip(KIND_CLASS.event, "Avtale i Google Kalender") : chip(KIND_CLASS.busy, "Opptatt")}
      {own && chip(KIND_CLASS.free, "Vist som ledig")}
    </div>
  );
}

function SyncBadge({ week, whose }: { week: Week; whose: string }) {
  if (week.backend === "ics") {
    return <Badge variant="outline" className="gap-1 text-muted-foreground"><CalendarClock className="size-3" aria-hidden />Ingen kalenderkobling · erklærte tider</Badge>;
  }
  if (week.error) {
    return (
      <Badge variant="outline" className="max-w-full gap-1 border-warning/40 text-warning-on-tint" role="status" title={week.error}>
        <CloudOff className="size-3 shrink-0" aria-hidden /><span className="truncate">Kalender ikke koblet · {week.error}</span>
      </Badge>
    );
  }
  if (!week.syncedAt) {
    return <Badge variant="outline" className="gap-1 text-muted-foreground" role="status"><RefreshCw className="size-3 animate-spin" aria-hidden />Henter {whose.toLowerCase()} …</Badge>;
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CalendarClock className="size-3" aria-hidden />
      Google Kalender · synket kl. {timeFmt.format(new Date(week.syncedAt))}{week.stale ? " · oppdaterer …" : ""}
    </Badge>
  );
}
