"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * A date field that always reads and writes «dd.mm.åååå», whatever language the
 * browser runs in. `<input type="date">` follows the browser locale, so on an
 * English Chrome a recruiter sees «mm/dd/yyyy» — wrong for a Norwegian product
 * (IFK-10, 02-design-system «nb-NO throughout»).
 *
 * Type the date, or pick it in the month grid. The value is ISO (YYYY-MM-DD) or "".
 */

const OSLO = "Europe/Oslo";
const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const isoToNb = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "");

/** «24.12.2026», «24.12.26», «24/12/2026», «24-12-2026» → ISO, or null when it is not a real date. */
export function parseNb(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return toIso(y, mo, d);
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OSLO }).format(new Date());
}

export function NbDateField({ id, value, onChange, min, ariaDescribedBy }: {
  id: string; value: string; onChange: (iso: string) => void; min?: string; ariaDescribedBy?: string;
}) {
  const [text, setText] = React.useState(isoToNb(value));
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const shown = value || min || todayIso();
  const [cursor, setCursor] = React.useState({ y: Number(shown.slice(0, 4)), m: Number(shown.slice(5, 7)) });

  // Keep the typed text in step when the value changes from outside (picker, reset).
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(isoToNb(value));
  }

  function commit(raw: string) {
    if (!raw.trim()) { setError(null); onChange(""); return; }
    const iso = parseNb(raw);
    if (!iso) { setError("Skriv datoen som dd.mm.åååå"); return; }
    if (min && iso < min) { setError(`Velg ${isoToNb(min)} eller senere`); return; }
    setError(null);
    onChange(iso);
  }

  const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const step = (n: number) => setCursor(({ y, m }) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          inputMode="numeric"
          placeholder="dd.mm.åååå"
          autoComplete="off"
          value={text}
          aria-invalid={Boolean(error)}
          aria-describedby={[ariaDescribedBy, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined}
          className="w-[9.5rem] tabular-nums"
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(text); } }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-9" aria-label="Velg dato i kalender">
              <CalendarDays className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[17.5rem] p-3" align="start">
            <div className="mb-2 flex items-center justify-between">
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Forrige måned" onClick={() => step(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <p className="text-sm font-medium" aria-live="polite">{monthFmt.format(first)}</p>
              <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Neste måned" onClick={() => step(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs" role="grid">
              {WEEKDAYS.map((w) => <span key={w} className="py-1 text-muted-foreground" aria-hidden>{w}</span>)}
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} />;
                const iso = toIso(cursor.y, cursor.m, d);
                const disabled = Boolean(min && iso < min);
                const selected = iso === value;
                const isToday = iso === todayIso();
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={longFmt.format(new Date(`${iso}T00:00:00Z`))}
                    onClick={() => { onChange(iso); setError(null); setOpen(false); }}
                    className={`h-9 rounded-md tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? "bg-[var(--ab-accent-9)] text-[var(--primary-foreground)]"
                        : disabled ? "cursor-not-allowed text-muted-foreground/40"
                          : "hover:bg-secondary"} ${isToday && !selected ? "font-medium underline underline-offset-4" : ""}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && <p id={`${id}-err`} className="text-sm text-danger">{error}</p>}
    </div>
  );
}
