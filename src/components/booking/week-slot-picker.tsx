"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { SelectableButton } from "@/components/patterns/selectable-button";
import { CalendarClock, ChevronLeft, ChevronRight, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useSlots } from "@/lib/api/interviews";
import { errorMessage } from "@/lib/api/client";
import type { Slot } from "@/types/interview";

/**
 * BOOK-01 — «ser lederens ledige tider i en kalendervisning».
 *
 * A week, not a list: the recruiter is usually on the phone with the candidate
 * and needs to say «tirsdag eller torsdag?», which is a question about days.
 * Every slot that is not free stays visible with the reason (Cal.com-style
 * striking, but explained — «Opptatt i kalenderen», «Opptatt: annet intervju»),
 * because an unexplained gap reads as a bug or as a lie.
 *
 * Desktop: one column per day. Phone (IFK-08, leaders book too): a day strip
 * and that day's times as big buttons.
 *
 * When the leader's calendar has not answered (stale), what we have is shown
 * and the header says so — the partial state, never a blocked screen.
 */

const OSLO = "Europe/Oslo";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO, year: "numeric", month: "2-digit", day: "2-digit" });
const dayHead = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "short", day: "numeric", month: "short" });
const dayLong = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, hour: "2-digit", minute: "2-digit" });
const syncFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, hour: "2-digit", minute: "2-digit" });

const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
/** «Man. 19. okt.» — only the first letter up; CSS `capitalize` would also give «Okt.». */
const head = (iso: string) => { const s = dayHead.format(new Date(iso)); return s.charAt(0).toUpperCase() + s.slice(1); };

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(ymd: string) {
  const d = new Date(`${ymd}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  return addDays(ymd, -wd);
}
export function todayOslo() {
  return dayKeyFmt.format(new Date());
}

export function WeekSlotPicker({
  leaderId, value, onChange, leaderName,
}: { leaderId: string; value: string | null; onChange: (startsAt: string) => void; leaderName?: string }) {
  const reduce = useReducedMotion();
  const [week, setWeek] = React.useState(() => mondayOf(todayOslo()));
  const slots = useSlots(leaderId, week, 7);
  // The picked phone day belongs to one week and leader; switching either falls back to the first free day.
  const scope = `${week}|${leaderId}`;
  const [picked, setPicked] = React.useState<{ scope: string; day: string } | null>(null);
  const mobileDay = picked?.scope === scope ? picked.day : null;
  const setMobileDay = (day: string) => setPicked({ scope, day });

  // The server already leaves out passed times; this guard makes sure a stale response or
  // a page left open over lunch can never offer one. Minimum notice is the server's rule.
  const [now] = React.useState(() => Date.now());
  const days = React.useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const raw of slots.data?.slots ?? []) {
      const s: Slot = new Date(raw.startsAt).getTime() <= now
        ? { ...raw, available: false, reason: "Tidspunktet er passert" }
        : raw;
      const k = dayKey(s.startsAt);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [slots.data, now]);

  const freeCount = (slots.data?.slots ?? []).filter((s) => s.available).length;
  const shownDay = mobileDay ?? days.find(([, s]) => s.some((x) => x.available))?.[0] ?? days[0]?.[0];
  const isThisWeek = week <= mondayOf(todayOslo());
  const rangeFrom = days[0]?.[0] ?? week;
  const rangeTo = days[days.length - 1]?.[0] ?? addDays(week, 6);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-9" aria-label="Forrige uke" disabled={isThisWeek}
            onClick={() => setWeek((w) => addDays(w, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-[11rem] text-center text-sm font-medium tabular-nums">
            {/* The server starts at today, not at Monday, so the label follows the days actually shown. */}
            Uke {isoWeek(rangeFrom) === isoWeek(rangeTo) ? isoWeek(rangeFrom) : `${isoWeek(rangeFrom)}–${isoWeek(rangeTo)}`} · {dayHead.format(new Date(`${rangeFrom}T12:00:00Z`))} – {dayHead.format(new Date(`${rangeTo}T12:00:00Z`))}
          </p>
          <Button size="icon" variant="ghost" className="size-9" aria-label="Neste uke"
            onClick={() => setWeek((w) => addDays(w, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {slots.data && <SourceBadge source={slots.data.source} stale={slots.data.stale} syncedAt={slots.data.calendarSyncedAt} />}
      </div>

      {slots.isPending ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : slots.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-sm">
          <p>Kunne ikke hente ledige tider. {errorMessage(slots.error)}</p>
          <Button size="sm" variant="outline" onClick={() => slots.refetch()}>Prøv igjen</Button>
        </div>
      ) : days.length === 0 || freeCount === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {days.length === 0
            ? `${leaderName ?? "Lederen"} har ingen intervjutider denne uken.`
            : `Alt er opptatt hos ${leaderName ?? "lederen"} denne uken.`}{" "}
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setWeek((w) => addDays(w, 7))}>
            Se neste uke
          </button>
        </div>
      ) : (
        <>
          {/* Phone: day strip + that day's times */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Velg dag">
              {days.map(([k, s]) => {
                const free = s.filter((x) => x.available).length;
                const active = k === shownDay;
                return (
                  <button key={k} type="button" role="tab" aria-selected={active} onClick={() => setMobileDay(k)}
                    className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-lg border px-2 py-2 text-xs transition-colors ${
                      active ? "border-[var(--ab-accent-9)] bg-[var(--ab-accent-3)]" : "border-border"}`}>
                    <span>{head(s[0].startsAt)}</span>
                    <span className="tabular-nums text-muted-foreground">{free} ledig{free === 1 ? "" : "e"}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(days.find(([k]) => k === shownDay)?.[1] ?? []).map((s) => (
                <SlotButton key={s.startsAt} slot={s} active={value === s.startsAt} onPick={onChange} reduce={!!reduce} big />
              ))}
            </div>
          </div>

          {/* Desktop: the week as columns */}
          <div className="hidden gap-2 overflow-x-auto pb-1 sm:grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(7.5rem, 1fr))` }}>
            {days.map(([k, s]) => (
              <div key={k} className="rounded-lg border border-border">
                <p className="border-b border-border px-2.5 py-2 text-xs text-muted-foreground" title={dayLong.format(new Date(s[0].startsAt))}>
                  {head(s[0].startsAt)}
                </p>
                <ul className="flex flex-col gap-1 p-1.5">
                  {s.map((slot) => (
                    <li key={slot.startsAt}>
                      <SlotButton slot={slot} active={value === slot.startsAt} onPick={onChange} reduce={!!reduce} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A slot is A1's SelectableButton (accent border + ✓ + aria-pressed). A taken slot stays
 *  visible, disabled, with its reason written under the time — never an unexplained gap. */
function SlotButton({ slot, active, onPick, big }: {
  slot: Slot; active: boolean; onPick: (s: string) => void; reduce?: boolean; big?: boolean;
}) {
  const label = timeFmt.format(new Date(slot.startsAt));
  if (!slot.available) {
    return (
      <div className={`flex flex-col rounded-lg px-2 text-muted-foreground ${big ? "min-h-11 justify-center py-1.5 text-sm" : "py-1 text-[12.5px]"}`}
        aria-label={`${label}: ${slot.reason}`}>
        <span className="tabular-nums line-through">{label}</span>
        <span className="text-[10.5px] leading-tight">{slot.reason}</span>
      </div>
    );
  }
  return (
    <SelectableButton
      selected={active}
      onClick={() => onPick(slot.startsAt)}
      aria-label={`${dayLong.format(new Date(slot.startsAt))} kl. ${label}`}
      className={`w-full justify-start tabular-nums ${big ? "" : "min-h-9 px-2 text-[12.5px] sm:min-h-8"}`}
    >
      {label}
    </SelectableButton>
  );
}

function SourceBadge({ source, stale, syncedAt }: { source: "kalender" | "erklært"; stale: boolean; syncedAt: string | null }) {
  if (stale) {
    return (
      <Badge variant="outline" className="gap-1 border-warning/40 text-warning-on-tint" role="status">
        <CloudOff className="size-3" aria-hidden />
        {source === "kalender" && syncedAt
          ? `Kalenderen svarer ikke · viser data fra kl. ${syncFmt.format(new Date(syncedAt))}`
          : "Henter lederens kalender … viser erklærte tider"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <CalendarClock className="size-3" aria-hidden />
      {source === "kalender" ? "Fra lederens kalender" : "Lederens erklærte tider"}
    </Badge>
  );
}

function isoWeek(ymd: string) {
  const d = new Date(`${ymd}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
