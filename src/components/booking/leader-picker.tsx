"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Leader picker with a search field (client 2026-11-08): the list opens as before,
 * and typing narrows it («l» → Lars, Lasse, Lukas …). Matches on name and team,
 * ignoring case and accents. Arrow keys move, Enter picks, Esc closes.
 */

export interface PickerLeader { id: string; name: string; teams?: string[]; suffix?: string }

function fold(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function LeaderPicker({ leaders, value, onChange, disabled, placeholder = "Velg leder", id, className, ariaLabel }: {
  leaders: PickerLeader[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const label = (l: PickerLeader) => `${l.name}${l.teams?.length ? ` · ${l.teams.join(", ")}` : ""}${l.suffix ?? ""}`;
  const chosen = leaders.find((l) => l.id === value);
  const needle = fold(q.trim());
  const shown = needle ? leaders.filter((l) => fold(label(l)).includes(needle)) : leaders;

  const listId = React.useId();
  const setOpenReset = (o: boolean) => {
    setOpen(o);
    if (o) {
      setQ("");
      setActive(Math.max(0, leaders.findIndex((l) => l.id === value)));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, shown.length]);

  const pick = (l: PickerLeader) => { onChange(l.id); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpenReset}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          className={cn(
            "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors outline-none select-none",
            "min-h-11 sm:min-h-6 sm:h-8 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            !chosen && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{chosen ? label(chosen) : placeholder}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" onKeyDown={onKey}>
        <div className="flex items-center gap-2 border-b border-border px-2.5">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="Søk på navn eller team …"
            aria-label="Søk etter leder"
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div ref={listRef} id={listId} role="listbox" aria-label="Ledere" className="max-h-72 overflow-y-auto p-1">
          {shown.length === 0 && <div className="px-2.5 py-3 text-sm text-muted-foreground">Ingen treff på «{q}».</div>}
          {shown.map((l, i) => {
            const selected = l.id === value;
            return (
              <div
                key={l.id}
                role="option"
                aria-selected={selected}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(l)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm sm:py-1.5",
                  i === active && "bg-accent text-accent-foreground",
                )}
              >
                <span className="truncate">{label(l)}</span>
                {selected && <Check className="size-4 shrink-0" aria-hidden />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
