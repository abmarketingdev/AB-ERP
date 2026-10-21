"use client";

import * as React from "react";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth,
  isValid, parse, startOfMonth, startOfWeek,
} from "date-fns";
import { nb } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { usePhone } from "@/lib/use-media-query";

/**
 * The shared nb-NO date picker (08-DESIGN-REVIEW §5). Shows and accepts «dd.mm.åååå»
 * whatever the browser's language — a native <input type="date"> renders mm/dd/yyyy on an
 * English laptop, which is how a 03.04 follow-up becomes 4 March.
 *
 *     <DatePicker id="frist" value={frist} onChange={setFrist} min="2026-10-21" />
 *     <DatePicker id="tid" value={tid} onChange={setTid} withTime />
 *
 * value: "YYYY-MM-DD" | "" — or with `withTime`, "YYYY-MM-DDTHH:mm" (local Oslo time, the
 * same shape as datetime-local; convert to an offset ISO string in the API layer if needed).
 *
 * Built on date-fns (already a dependency) rather than a calendar library: one less
 * package across five branches, and full control of the keyboard grid. Weeks start on
 * Monday (ISO, as in Norway). Desktop: popover; phone: bottom sheet (IFK-08).
 */
export interface DatePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  withTime?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** "sm" = 36 px high and narrower, to sit in a filter row next to dropdowns. */
  size?: "default" | "sm";
}

const ISO = "yyyy-MM-dd";
const SHOWN = "dd.MM.yyyy";

function fromIso(s: string | undefined): Date | null {
  if (!s) return null;
  const d = parse(s.slice(0, 10), ISO, new Date());
  return isValid(d) ? d : null;
}

export function DatePicker({
  id, value, onChange, min, max, withTime = false, disabled, size = "default", ...aria
}: DatePickerProps) {
  const sm = size === "sm";
  const phone = usePhone();
  const [open, setOpen] = React.useState(false);
  const selected = fromIso(value);
  const time = withTime && value.length >= 16 ? value.slice(11, 16) : "";
  const minD = fromIso(min);
  const maxD = fromIso(max);
  const [text, setText] = React.useState(selected ? format(selected, SHOWN) : "");
  const [timeText, setTimeText] = React.useState(time);
  // Keep the typed text in step when the value changes from outside — adjusted during
  // render (React's "storing information from previous renders"), not in an effect.
  const [seen, setSeen] = React.useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(selected ? format(selected, SHOWN) : "");
    setTimeText(time);
  }

  function emit(day: Date | null, hhmm: string) {
    if (!day) return onChange("");
    const d = format(day, ISO);
    onChange(withTime ? `${d}T${/^\d{2}:\d{2}$/.test(hhmm) ? hhmm : "09:00"}` : d);
  }

  function commitText() {
    if (!text.trim()) return emit(null, timeText);
    // Accept 3.4.2026, 03.04.2026, 03042026 and 3/4/26 — people type dates many ways.
    const cleaned = text.trim().replace(/[/\-\s]/g, ".");
    // Pick the format from the year's length: "yyyy" would happily read "26" as year 0026.
    const fmt = /^\d{8}$/.test(cleaned) ? "ddMMyyyy" : /\.\d{2}$/.test(cleaned) ? "d.M.yy" : "d.M.yyyy";
    const parsed = parse(cleaned, fmt, new Date());
    const d = isValid(parsed) && parsed.getFullYear() >= 1900 ? parsed : null;
    if (d && !(minD && isBefore(d, minD)) && !(maxD && isAfter(d, maxD))) emit(d, timeText);
    else setText(selected ? format(selected, SHOWN) : "");   // invalid: revert, never guess
  }

  const calendar = (
    <MonthGrid
      selected={selected}
      min={minD}
      max={maxD}
      onPick={(d) => { emit(d, timeText); setOpen(false); }}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Input
          id={id}
          value={text}
          disabled={disabled}
          inputMode="numeric"
          placeholder="dd.mm.åååå"
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitText(); } }}
          className={`tabular-nums ${sm ? "h-9 w-[8.75rem] pr-9 text-sm" : "h-11 w-[11.5rem] pr-11"}`}
          {...aria}
        />
        {phone ? (
          <>
            <CalendarButton small={sm} disabled={disabled} onClick={() => setOpen(true)} />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetHeader className="px-0 text-left"><SheetTitle>Velg dato</SheetTitle></SheetHeader>
                {calendar}
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
            <PopoverPrimitive.Trigger asChild>
              <CalendarButton small={sm} disabled={disabled} />
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content align="start" sideOffset={6}
                className="z-50 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
                {calendar}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        )}
      </div>
      {withTime && (
        <Input
          id={`${id}-time`}
          aria-label="Klokkeslett (tt:mm)"
          value={timeText}
          disabled={disabled}
          inputMode="numeric"
          placeholder="tt:mm"
          onChange={(e) => setTimeText(e.target.value)}
          onBlur={() => {
            const m = /^(\d{1,2})[:.]?(\d{2})$/.exec(timeText.trim());
            const hhmm = m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
            setTimeText(hhmm || time);
            if (hhmm && selected) emit(selected, hhmm);
          }}
          className={`tabular-nums ${sm ? "h-9 w-[4.75rem] text-sm" : "h-11 w-[5.5rem]"}`}
        />
      )}
    </div>
  );
}

const CalendarButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { small?: boolean }>(
  function CalendarButton({ small, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Åpne kalender"
        className={`absolute right-0 top-0 flex items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${small ? "size-9" : "size-11"}`}
        {...props}
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
    );
  },
);

/** A month as a keyboard grid: arrows move a day/week, PageUp/Down a month, Home/End the week. */
function MonthGrid({ selected, min, max, onPick, rangeFrom = null, rangeTo = null }: {
  selected: Date | null; min: Date | null; max: Date | null; onPick: (d: Date) => void;
  /** Range mode: days between the ends are tinted, the ends filled. */
  rangeFrom?: Date | null; rangeTo?: Date | null;
}) {
  const [focus, setFocus] = React.useState<Date>(selected ?? min ?? new Date());
  const [month, setMonth] = React.useState<Date>(startOfMonth(focus));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const today = new Date();

  const days: Date[] = [];
  for (let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    !isAfter(d, endOfWeek(endOfMonth(month), { weekStartsOn: 1 })); d = addDays(d, 1)) days.push(d);

  const blocked = (d: Date) => (min && isBefore(d, min)) || (max && isAfter(d, max));

  React.useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${format(focus, ISO)}"]`)?.focus();
  }, [focus]);

  function move(next: Date) {
    setFocus(next);
    if (!isSameMonth(next, month)) setMonth(startOfMonth(next));
  }

  function onKey(e: React.KeyboardEvent) {
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1), PageDown: () => addMonths(focus, 1),
      Home: () => startOfWeek(focus, { weekStartsOn: 1 }), End: () => endOfWeek(focus, { weekStartsOn: 1 }),
    };
    if (map[e.key]) { e.preventDefault(); move(map[e.key]()); }
  }

  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(today, { weekStartsOn: 1 }), i), "EEEEEE", { locale: nb }));

  return (
    <div className="w-[17.5rem]">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Vis forrige måned" className="size-11 sm:size-9"
          onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="size-4" /></Button>
        <p className="text-sm font-medium capitalize" aria-live="polite">{format(month, "LLLL yyyy", { locale: nb })}</p>
        <Button variant="ghost" size="icon" aria-label="Vis neste måned" className="size-11 sm:size-9"
          onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground" aria-hidden>
        {weekdays.map((w) => <span key={w} className="py-1 capitalize">{w}</span>)}
      </div>
      <div ref={gridRef} role="grid" aria-label={format(month, "LLLL yyyy", { locale: nb })} onKeyDown={onKey}
        className="grid grid-cols-7 gap-0.5">
        {days.map((d) => {
          const inRange = rangeFrom && rangeTo && !isBefore(d, rangeFrom) && !isAfter(d, rangeTo);
          const isEnd = (rangeFrom && isSameDay(d, rangeFrom)) || (rangeTo && isSameDay(d, rangeTo));
          const isSel = (selected && isSameDay(d, selected)) || isEnd;
          const off = blocked(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              data-day={format(d, ISO)}
              role="gridcell"
              tabIndex={isSameDay(d, focus) ? 0 : -1}
              aria-selected={Boolean(isSel || inRange)}
              aria-label={format(d, "EEEE d. MMMM yyyy", { locale: nb })}
              aria-current={isSameDay(d, today) ? "date" : undefined}
              disabled={Boolean(off)}
              onClick={() => onPick(d)}
              className={[
                "flex h-11 items-center justify-center rounded-md text-sm tabular-nums transition-colors sm:h-9",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
                isSel ? "bg-[var(--ab-accent-9)] font-medium text-white"
                  : inRange ? "bg-[var(--ab-accent-9)]/12 text-foreground"
                  : isSameMonth(d, month) ? "text-foreground hover:bg-muted" : "text-muted-foreground/60 hover:bg-muted",
                !isSel && isSameDay(d, today) ? "ring-1 ring-inset ring-[var(--ab-accent-9)]/50" : "",
              ].join(" ")}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}


/**
 * A period in ONE field («12.10.–21.10.2026») for filter rows (inbox, dashboard, interview
 * list). Click a start day, then an end day (an earlier end swaps them). Presets cover the
 * periods people actually ask for. value/onChange use "YYYY-MM-DD" | "" for each end.
 */
export function DateRangePicker({
  id, from, to, onChange, min, max, size = "default", disabled, placeholder = "Velg periode", ...aria
}: {
  id: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  min?: string;
  max?: string;
  size?: "default" | "sm";
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const phone = usePhone();
  const [open, setOpen] = React.useState(false);
  const [pendingFrom, setPendingFrom] = React.useState<Date | null>(null);
  const f = fromIso(from);
  const t = fromIso(to);
  const sm = size === "sm";

  const label = f && t
    ? f.getFullYear() === t.getFullYear()
      ? `${format(f, "dd.MM.")}–${format(t, "dd.MM.yyyy")}`
      : `${format(f, SHOWN)}–${format(t, SHOWN)}`
    : f ? `fra ${format(f, SHOWN)}` : "";

  function set(a: Date | null, b: Date | null) {
    onChange({ from: a ? format(a, ISO) : "", to: b ? format(b, ISO) : "" });
  }
  function pick(d: Date) {
    if (!pendingFrom) { setPendingFrom(d); return; }
    const [a, b] = isBefore(d, pendingFrom) ? [d, pendingFrom] : [pendingFrom, d];
    set(a, b);
    setPendingFrom(null);
    setOpen(false);
  }
  const now = new Date();
  const presets: [string, Date, Date][] = [
    ["Denne uken", startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })],
    ["Siste 7 dager", addDays(now, -6), now],
    ["Denne måneden", startOfMonth(now), endOfMonth(now)],
    ["Forrige måned", startOfMonth(addMonths(now, -1)), endOfMonth(addMonths(now, -1))],
  ];

  const body = (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-muted-foreground" aria-live="polite">
        {pendingFrom ? `Fra ${format(pendingFrom, SHOWN)} — velg sluttdato` : "Velg startdato"}
      </p>
      <MonthGrid selected={pendingFrom} min={fromIso(min)} max={fromIso(max)} onPick={pick}
        rangeFrom={pendingFrom ? null : f} rangeTo={pendingFrom ? null : t} />
      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
        {presets.map(([name, a, b]) => (
          <Button key={name} variant="outline" size="sm" className="min-h-11 sm:min-h-8"
            onClick={() => { set(a, b); setPendingFrom(null); setOpen(false); }}>{name}</Button>
        ))}
        {(f || t) && (
          <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-8"
            onClick={() => { set(null, null); setPendingFrom(null); setOpen(false); }}>Nullstill</Button>
        )}
      </div>
    </div>
  );

  const trigger = (
    <button
      id={id}
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      {...aria}
      onClick={phone ? () => setOpen(true) : undefined}
      className={`inline-flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left tabular-nums transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${sm ? "h-9 min-w-[10.5rem] text-sm" : "h-11 min-w-[13rem]"}`}
    >
      <span className={label ? "text-foreground" : "text-muted-foreground"}>{label || placeholder}</span>
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );

  if (phone) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPendingFrom(null); }}>
          <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader className="px-0 text-left"><SheetTitle>Velg periode</SheetTitle></SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPendingFrom(null); }}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="start" sideOffset={6}
          className="z-50 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          {body}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
