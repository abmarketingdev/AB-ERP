"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A date field that speaks nb-NO everywhere (IFK-10, 02-design-system «Norwegian formatting»).
 *
 * `<input type="date">` shows the browser's own format — mm/dd/yyyy on an English machine —
 * which is exactly the wrong date for a start date someone will sign a contract on. This
 * shows «4. november 2026», a Monday-first month grid with «man–søn», and is operated by
 * keyboard (arrows move a day / a week, PageUp/PageDown a month, Enter picks, Escape closes).
 *
 * The value is the ISO day string the API speaks (`2026-11-04`) or "".
 */
const longFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });
const dayLabelFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const WEEKDAYS = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parse(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d: Date, n: number) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; }
function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

export function DateField({
  id, value, onChange, min, placeholder = "Velg dato", invalid, describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Earliest selectable day (ISO). */
  min?: string;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parse(value);
  const minDate = min ? parse(min) : null;
  const [focus, setFocus] = React.useState<Date>(() => selected ?? minDate ?? startOfDay(new Date()));
  const gridRef = React.useRef<HTMLDivElement>(null);

  const disabled = (d: Date) => !!minDate && d < minDate;
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;   // Monday-first
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
  const today = iso(startOfDay(new Date()));

  React.useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${iso(focus)}"]`)?.focus();
  }, [open, focus]);

  function onKey(e: React.KeyboardEvent) {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1), PageDown: () => addMonths(focus, 1),
    };
    if (step[e.key]) { e.preventDefault(); setFocus(step[e.key]()); }
  }

  function pick(d: Date) {
    if (disabled(d)) return;
    onChange(iso(d));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setFocus(selected ?? minDate ?? startOfDay(new Date())); }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" aria-invalid={invalid} aria-describedby={describedBy}
          aria-haspopup="dialog"
          className={cn("h-9 w-full justify-start gap-2 font-normal tabular-nums", !selected && "text-muted-foreground",
                        invalid && "border-danger")}>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {selected ? longFmt.format(selected) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[18.5rem] p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Forrige måned"
            onClick={() => setFocus(addMonths(focus, -1))}><ChevronLeft className="size-4" /></Button>
          <p className="text-sm font-medium first-letter:uppercase" aria-live="polite">{monthFmt.format(focus)}</p>
          <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Neste måned"
            onClick={() => setFocus(addMonths(focus, 1))}><ChevronRight className="size-4" /></Button>
        </div>
        <div role="grid" aria-label={monthFmt.format(focus)} ref={gridRef} onKeyDown={onKey} className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" aria-label={w} className="py-1 text-center text-[11px] text-muted-foreground">{w}</span>
          ))}
          {days.map((d) => {
            const key = iso(d);
            const isSel = value === key;
            const inMonth = d.getMonth() === focus.getMonth();
            const off = disabled(d);
            return (
              <button key={key} type="button" role="gridcell" data-day={key}
                tabIndex={key === iso(focus) ? 0 : -1} disabled={off} aria-selected={isSel}
                aria-label={dayLabelFmt.format(d)} onClick={() => pick(d)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md text-sm tabular-nums outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  !inMonth && "text-muted-foreground/60",
                  off ? "cursor-not-allowed text-muted-foreground/40 line-through" : "hover:bg-muted",
                  key === today && !isSel && "font-medium underline underline-offset-4",
                  isSel && "bg-primary text-primary-foreground hover:bg-primary",
                )}>
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
