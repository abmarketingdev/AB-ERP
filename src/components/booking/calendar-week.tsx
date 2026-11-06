"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, CloudOff, EyeOff, MapPin, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCalendarWeek, useSyncCalendar } from "@/lib/api/interviews";
import { errorMessage } from "@/lib/api/client";
import type { CalendarWeek as Week } from "@/types/interview";
import { todayOslo } from "./week-slot-picker";
import { CalendarConnectNotice, isUnreachable, otherCalendarProblem } from "./calendar-connect";

/**
 * A person's calendar from the Google Calendar sync (2026-11-02), drawn the way Google
 * Calendar draws it (client 2026-11-03): «I dag» + arrows + month title, big day numbers
 * with today in a blue circle, the whole day on a scrollable grid with a red «now» line,
 * solid coloured events that open a detail card, Dag/Uke views, and a schedule list on
 * phones.
 *
 * Own calendar («Min kalender»): every event with its title, plus our interviews.
 * Someone else's (a recruiter booking for another leader): only «Opptatt» blocks and the
 * interviews the viewer may see — never the titles of the leader's own meetings.
 *
 * Read-only on purpose: the time is picked in WeekSlotPicker, by a person. This
 * component never books anything.
 */

const OSLO = "Europe/Oslo";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, hour: "2-digit", minute: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: OSLO, hour: "2-digit", minute: "2-digit", hour12: false });
// Calendar dates are noon-UTC instants of an Oslo day, so formatting them in UTC is exact.
const wdShort = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", weekday: "short" });
const dayNum = { format: (d: Date) => String(d.getUTCDate()) };
const monthYear = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", month: "short" });
const longDay = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const longDayYear = new Intl.DateTimeFormat("nb-NO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });

const offsetFmt = new Intl.DateTimeFormat("en-GB", { timeZone: OSLO, timeZoneName: "shortOffset" });
/** «GMT+1» in winter, «GMT+2» in summer, for the day shown. */
const gmtLabel = (ymd: string) => offsetFmt.formatToParts(noon(ymd)).find((p) => p.type === "timeZoneName")?.value ?? "";

const HOUR_PX = 48;
const DAY_PX = HOUR_PX * 24;

type Kind = "event" | "free" | "busy" | "interview";
type Item = { key: string; kind: Kind; startsAt: string; endsAt: string; title: string; location?: string };
type View = "week" | "day";

/** Google Calendar's own palette: Peacock for synced events, Basil for interviews,
 *  Graphite for someone else's «Opptatt». Same hues in dark mode, a touch softer. */
const KIND: Record<Kind, { block: string; dot: string; label: string }> = {
  event: { block: "bg-[#039be5] text-white dark:bg-[#039be5]/85", dot: "bg-[#039be5]", label: "Google Kalender" },
  free: {
    block: "border border-[#039be5] bg-card text-[#0277bd] dark:text-[#4fc3f7]",
    dot: "border border-[#039be5] bg-card", label: "Vist som ledig",
  },
  busy: { block: "bg-[#616161] text-white dark:bg-[#757575]", dot: "bg-[#616161]", label: "Opptatt" },
  interview: { block: "bg-[#0b8043] text-white dark:bg-[#0b8043]/90", dot: "bg-[#0b8043]", label: "Intervju" },
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
const noon = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
/** Minutes after midnight, Oslo time. */
function minutesOf(iso: string) {
  const [h, m] = hmFmt.format(new Date(iso)).split(":").map(Number);
  return (h % 24) * 60 + m;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const range = (t: Item) => `${timeFmt.format(new Date(t.startsAt))}–${timeFmt.format(new Date(t.endsAt))}`;
const nowMinutes = () => minutesOf(new Date().toISOString());

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

const onDay = (t: Item, d: string) => dayKey(t.startsAt) <= d && dayKey(t.endsAt) > d;

/** Ticks once a minute so the red «now» line and «past» shading stay current. */
function useNow() {
  const [now, setNow] = React.useState(() => ({ day: todayOslo(), min: nowMinutes() }));
  React.useEffect(() => {
    const id = window.setInterval(() => setNow({ day: todayOslo(), min: nowMinutes() }), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function CalendarWeek({ leaderId, leaderName, compact }: {
  /** Empty = my own calendar. */
  leaderId?: string; leaderName?: string; compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const now = useNow();
  const [view, setView] = React.useState<View>("week");
  const [anchor, setAnchor] = React.useState(() => todayOslo());
  const [dir, setDir] = React.useState(0);
  const week = mondayOf(anchor);
  const q = useCalendarWeek(leaderId ?? "", week, 7);
  const sync = useSyncCalendar();
  const data = q.data;

  const shownDays = React.useMemo(
    () => (view === "day" ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(week, i))),
    [view, anchor, week]);
  const { timed, allDay } = React.useMemo(() => (data ? itemsOf(data) : { timed: [], allDay: [] }), [data]);

  // The sync keeps today and forward, so earlier days would only look empty.
  const atStart = view === "day" ? anchor <= now.day : week <= mondayOf(now.day);
  const step = (n: number) => {
    setDir(n);
    setAnchor((a) => addDays(view === "day" ? a : mondayOf(a), n * (view === "day" ? 1 : 7)));
  };
  const goToday = () => { setDir(anchor > now.day ? -1 : 1); setAnchor(now.day); };

  const first = shownDays[0];
  const last = shownDays[shownDays.length - 1];
  const title = view === "day"
    ? cap(longDayYear.format(noon(first)))
    : first.slice(0, 7) === last.slice(0, 7)
      ? cap(monthYear.format(noon(first)))
      : `${cap(monthShort.format(noon(first)))} – ${monthShort.format(noon(last))} ${last.slice(0, 4)}`;
  const whose = leaderId ? (leaderName ? `${leaderName}s kalender` : "Lederens kalender") : "Kalenderen din";
  const slideKey = `${view}-${view === "day" ? anchor : week}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar, Google-style: I dag · ‹ › · title …… status · Synk nå · Dag/Uke */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-9 rounded-full px-4 max-sm:px-3" onClick={goToday}
            disabled={view === "day" ? anchor === now.day : week === mondayOf(now.day)}>
            I dag
          </Button>
          <Button size="icon" variant="ghost" className="size-9 rounded-full" aria-label={view === "day" ? "Forrige dag" : "Forrige uke"}
            disabled={atStart} onClick={() => step(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-9 rounded-full" aria-label={view === "day" ? "Neste dag" : "Neste uke"}
            onClick={() => step(1)}>
            <ChevronRight className="size-5" />
          </Button>
          <h2 className={`truncate pl-1 font-normal tracking-tight text-foreground ${compact ? "text-base" : "text-[22px] max-sm:text-[17px]"}`} aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <SyncBadge week={data} whose={whose} name={leaderName} />}
          {data && data.backend !== "ics" && !(isUnreachable(data) && data.reason !== "not_in_workspace") && (
            <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-full" disabled={sync.isPending}
              onClick={() => sync.mutate({ leaderId: leaderId || undefined })}>
              <RefreshCw className={`size-3.5 ${sync.isPending || data.stale ? "animate-spin" : ""}`} aria-hidden />
              Synk nå
            </Button>
          )}
          {!compact && (
            <div role="radiogroup" aria-label="Visning" className="hidden h-9 items-center rounded-full border border-border p-0.5 sm:flex">
              {(["day", "week"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={view === v}
                  onClick={() => { setDir(0); setView(v); }}
                  className={`relative h-full rounded-full px-3.5 text-[13px] font-medium transition-colors ${view === v ? "text-[#0b57d0] dark:text-[#a8c7fa]" : "text-muted-foreground hover:text-foreground"}`}>
                  {view === v && (
                    <motion.span layoutId={`cal-view-${leaderId ?? "me"}`} className="absolute inset-0 rounded-full bg-[#d3e3fd] dark:bg-[#0b57d0]/40"
                      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />
                  )}
                  <span className="relative">{v === "day" ? "Dag" : "Uke"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {data && <CalendarConnectNotice week={data} />}

      {data && !data.own && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="mt-px size-3.5 shrink-0" aria-hidden />
          Du ser bare når {leaderName ?? "lederen"} er opptatt, ikke hva avtalene gjelder. Velg selv et ledig tidspunkt — ingenting bookes automatisk.
        </p>
      )}

      {q.isPending ? (
        <Skeleton className={compact ? "h-[360px] rounded-xl" : "h-[600px] rounded-xl"} />
      ) : q.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-border p-4 text-sm">
          <p>Kunne ikke hente kalenderen. {errorMessage(q.error)}</p>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Prøv igjen</Button>
        </div>
      ) : (
        <>
          <Schedule days={shownDays} timed={timed} allDay={allDay} now={now} />
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={slideKey} custom={dir} className="hidden sm:block"
              variants={{
                enter: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * 32 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: reduced ? 0 : d * -32 }),
              }}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0, 0, 1] }}>
              <Grid days={shownDays} timed={timed} allDay={allDay} now={now} compact={!!compact} single={view === "day"} />
            </motion.div>
          </AnimatePresence>
          <Legend own={!!data?.own} />
        </>
      )}
    </div>
  );
}

/* ───────────────────────── desktop: the time grid ───────────────────────── */

function Grid({ days, timed, allDay, now, compact, single }: {
  days: string[]; timed: Item[]; allDay: Item[]; now: { day: string; min: number }; compact: boolean; single: boolean;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const cols = `3.5rem repeat(${days.length}, minmax(${single ? "12rem" : "5.75rem"}, 1fr))`;
  const anyAllDay = days.some((d) => allDay.some((t) => onDay(t, d)));

  // Open at the working day (or earlier if something starts earlier), like Google does.
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const starts = timed.filter((t) => days.includes(dayKey(t.startsAt))).map((t) => minutesOf(t.startsAt));
    const firstMin = Math.min(8 * 60, ...starts);
    el.scrollTop = Math.max(0, (firstMin / 60) * HOUR_PX - HOUR_PX / 2);
    // Only when the shown days change, not on every background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <div className={single ? "" : "min-w-[46rem]"}>
          {/* Day headers */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
            <div className="flex items-end justify-end pb-1 pr-2 text-[10px] text-muted-foreground">{gmtLabel(days[0])}</div>
            {days.map((d) => {
              const today = d === now.day;
              const past = d < now.day;
              return (
                <div key={d} className={`flex flex-col items-center gap-0.5 pb-2 pt-2 ${single ? "items-start pl-3" : ""}`}>
                  <span className={`text-[11px] font-medium uppercase tracking-wide ${today ? "text-[#0b57d0] dark:text-[#a8c7fa]" : "text-muted-foreground"}`}>
                    {wdShort.format(noon(d)).replace(".", "")}
                  </span>
                  <span className={`flex items-center justify-center rounded-full tabular-nums transition-colors ${compact ? "size-8 text-lg" : "size-11 text-[26px]"} ${
                    today ? "bg-[#0b57d0] text-white dark:bg-[#a8c7fa] dark:text-[#062e6f]" : past ? "text-muted-foreground" : "text-foreground"}`}>
                    {dayNum.format(noon(d))}
                  </span>
                </div>
              );
            })}
          </div>

          {/* All-day row */}
          {anyAllDay && (
            <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
              <div className="flex items-center justify-end pr-2 text-[10px] text-muted-foreground">Hele dagen</div>
              {days.map((d) => (
                <div key={d} className="flex min-h-7 flex-col gap-0.5 border-l border-border px-0.5 py-1">
                  {allDay.filter((t) => onDay(t, d)).map((t) => (
                    <EventPopover key={t.key} item={t}>
                      <button type="button" className={`truncate rounded px-1.5 py-0.5 text-left text-[12px] font-medium transition-shadow hover:shadow-md ${KIND[t.kind].block}`}>
                        {t.title}
                      </button>
                    </EventPopover>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* 24 h, scrollable */}
          <div ref={scroller} className={`relative overflow-y-auto overscroll-contain ${compact ? "h-[360px]" : "h-[min(640px,calc(100dvh-20rem))] min-h-[420px]"}`}>
            <div className="grid" style={{ gridTemplateColumns: cols, height: DAY_PX }}>
              <div className="relative">
                {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-muted-foreground" style={{ top: h * HOUR_PX }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>
              {days.map((d) => (
                <DayColumn key={d} day={d} items={timed.filter((t) => dayKey(t.startsAt) === d)} now={now} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, items, now }: { day: string; items: Item[]; now: { day: string; min: number } }) {
  const today = day === now.day;
  return (
    <div className="relative border-l border-border">
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className="absolute inset-x-0 border-t border-border/70" style={{ top: h * HOUR_PX }}>
          {/* Google's short tick into the gutter */}
          <span className="absolute -left-2 top-[-1px] w-2 border-t border-border/70" />
        </div>
      ))}
      {layout(items).map(({ item: t, col, cols }, i) => {
        const s = minutesOf(t.startsAt);
        const e = dayKey(t.endsAt) !== day ? 24 * 60 : minutesOf(t.endsAt);
        const top = (s / 60) * HOUR_PX;
        const height = Math.max(20, ((e - s) / 60) * HOUR_PX - 2);
        const past = day < now.day || (today && e <= now.min);
        const short = height < 38;
        return (
          <EventPopover key={t.key} item={t}>
            <motion.button type="button"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: past ? 0.6 : 1, scale: 1 }}
              transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.015 }}
              className={`group absolute overflow-hidden rounded-[6px] px-1.5 text-left leading-tight outline-none ring-card transition-[box-shadow,filter] hover:z-20 hover:shadow-lg hover:brightness-105 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-[#0b57d0] data-[state=open]:z-20 data-[state=open]:shadow-xl ${
                cols > 1 ? "ring-1" : ""} ${short ? "py-0" : "py-1"} ${KIND[t.kind].block}`}
              style={{ top: top + 1, height, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - ${cols > 1 ? 2 : 10}px)`, zIndex: 1 + col }}
              aria-label={`${t.title}, ${range(t)}${t.location ? `, ${t.location}` : ""}`}>
              {short ? (
                <span className="block truncate text-[11.5px]" style={{ lineHeight: `${height}px` }}>
                  <span className="font-medium">{t.title}</span>, {timeFmt.format(new Date(t.startsAt))}
                </span>
              ) : (
                <>
                  <span className="line-clamp-2 text-[12px] font-medium">{t.title}</span>
                  <span className="block truncate text-[11px] opacity-90 tabular-nums">{range(t)}</span>
                  {t.location && height >= 64 && <span className="block truncate text-[11px] opacity-90">{t.location}</span>}
                </>
              )}
            </motion.button>
          </EventPopover>
        );
      })}
      {today && (
        <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: (now.min / 60) * HOUR_PX }} aria-hidden>
          <div className="relative border-t-2 border-[#ea4335]">
            <span className="absolute -left-[6px] -top-[7px] size-3 rounded-full bg-[#ea4335]" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Google's event card: colour square, big title, when, where, which calendar. */
function EventPopover({ item: t, children }: { item: Item; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const allDayish = new Date(t.endsAt).getTime() - new Date(t.startsAt).getTime() >= 20 * 3600_000;
  const startDay = dayKey(t.startsAt);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} collisionPadding={12}
        className="w-80 gap-0 rounded-2xl p-0 shadow-2xl ring-1 ring-foreground/10">
        <div className="flex justify-end px-2 pt-2">
          <Button size="icon" variant="ghost" className="size-8 rounded-full" aria-label="Lukk" onClick={() => setOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-3 px-5 pb-5">
          <div className="flex gap-4">
            <span className={`mt-1.5 size-3.5 shrink-0 rounded ${KIND[t.kind].dot}`} aria-hidden />
            <div className="min-w-0">
              <p className="break-words text-[20px] leading-snug text-foreground">{t.title}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {cap(longDay.format(noon(startDay)))}
                {allDayish ? " · Hele dagen" : ` · ${range(t)}`}
              </p>
            </div>
          </div>
          {t.location && (
            <div className="flex gap-4 text-[13px] text-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 break-words">{t.location}</span>
            </div>
          )}
          <div className="flex gap-4 text-[13px] text-muted-foreground">
            {t.kind === "busy" ? <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <CalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            <span>
              {t.kind === "busy" ? "Opptatt — detaljene vises bare for lederen selv"
                : t.kind === "interview" ? "Intervju booket i rekrutteringsportalen"
                : t.kind === "free" ? "Google Kalender · vist som ledig, blokkerer ikke booking"
                : "Google Kalender"}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────── phone: Google's schedule list ───────────────────── */

function Schedule({ days, timed, allDay, now }: {
  days: string[]; timed: Item[]; allDay: Item[]; now: { day: string; min: number };
}) {
  const rows = days
    .map((d) => ({
      d,
      list: [...allDay.filter((t) => onDay(t, d)), ...timed.filter((t) => dayKey(t.startsAt) === d).sort(byTime)],
    }))
    .filter((r) => r.list.length || r.d === now.day);
  return (
    <div className="flex flex-col sm:hidden">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ingenting i kalenderen denne uken
        </p>
      )}
      {rows.map(({ d, list }) => {
        const today = d === now.day;
        return (
          <div key={d} className="flex gap-3 border-b border-border/70 py-2.5 last:border-b-0">
            <div className="flex w-11 shrink-0 flex-col items-center">
              <span className={`text-[11px] font-medium uppercase ${today ? "text-[#0b57d0] dark:text-[#a8c7fa]" : "text-muted-foreground"}`}>
                {wdShort.format(noon(d)).replace(".", "")}
              </span>
              <span className={`flex size-9 items-center justify-center rounded-full text-xl tabular-nums ${today ? "bg-[#0b57d0] text-white dark:bg-[#a8c7fa] dark:text-[#062e6f]" : "text-foreground"}`}>
                {dayNum.format(noon(d))}
              </span>
            </div>
            <ul className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
              {list.length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">Ingenting i kalenderen</li>
              ) : list.map((t) => {
                const whole = allDay.includes(t);
                return (
                  <li key={t.key}>
                    <EventPopover item={t}>
                      <button type="button" className={`w-full rounded-lg px-3 py-2 text-left ${KIND[t.kind].block}`}>
                        <span className="block truncate text-[14px] font-medium">{t.title}</span>
                        <span className="block truncate text-[12px] opacity-90 tabular-nums">
                          {whole ? "Hele dagen" : range(t)}{t.location ? ` · ${t.location}` : ""}
                        </span>
                      </button>
                    </EventPopover>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
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
  const kinds: Kind[] = own ? ["event", "interview", "free"] : ["busy", "interview"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-full ${KIND[k].dot}`} />{KIND[k].label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3 rounded bg-[#ea4335]" />Nå
      </span>
      <span className="flex items-center gap-1.5"><Clock className="size-3" aria-hidden />Klikk på en avtale for detaljer</span>
    </div>
  );
}

function SyncBadge({ week, whose, name }: { week: Week; whose: string; name?: string }) {
  if (isUnreachable(week)) {
    const line = week.own ? "Kalender ikke koblet" : `Kalender ikke koblet · ${otherCalendarProblem(week.reason, name)}`;
    return (
      <Badge variant="outline" className="h-7 max-w-full gap-1 rounded-full border-warning/40 text-warning-on-tint" role="status">
        <CloudOff className="size-3 shrink-0" aria-hidden /><span className="truncate">{line}</span>
      </Badge>
    );
  }
  if (week.backend === "ics") {
    return <Badge variant="outline" className="h-7 gap-1 rounded-full text-muted-foreground"><CalendarClock className="size-3" aria-hidden />Ingen kalenderkobling · erklærte tider</Badge>;
  }
  if (week.error) {
    return (
      <Badge variant="outline" className="h-7 max-w-full gap-1 rounded-full border-warning/40 text-warning-on-tint" role="status" title={week.error}>
        <CloudOff className="size-3 shrink-0" aria-hidden /><span className="truncate">Kalender ikke koblet · {week.error}</span>
      </Badge>
    );
  }
  if (!week.syncedAt) {
    return <Badge variant="outline" className="h-7 gap-1 rounded-full text-muted-foreground" role="status"><RefreshCw className="size-3 animate-spin" aria-hidden />Henter {whose.toLowerCase()} …</Badge>;
  }
  return (
    <Badge variant="outline" className="h-7 gap-1.5 rounded-full text-muted-foreground">
      <span className={`size-1.5 rounded-full ${week.stale ? "animate-pulse bg-[#f9ab00]" : "bg-[#1e8e3e]"}`} aria-hidden />
      Google Kalender · synket kl. {timeFmt.format(new Date(week.syncedAt))}{week.stale ? " · oppdaterer …" : ""}
    </Badge>
  );
}
