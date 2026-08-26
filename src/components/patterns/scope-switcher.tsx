"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScope, TEAM_NAMES } from "@/lib/scope";
import { useHasPermission } from "@/lib/permissions";

/**
 * Narrowing the whole portal to one team.
 *
 * Renders only when the session is entitled to more than one team, so a team
 * lead never sees a control with a single option in it — a switcher that cannot
 * switch just raises the question of what is being hidden.
 *
 * It sits in the sidebar above the menu rather than on each page, because it
 * changes what *every* screen means, not what one screen shows. Every scoped
 * query carries the selection in its key, so switching is a refetch and never a
 * stale render of one team's numbers under another team's name.
 */
export function ScopeSwitcher() {
  const { canSwitch, allowed, teamId, label, setTeam } = useScope();
  // An administrator is entitled to every team but none of their screens are
  // team-scoped, so the control would be inert there. Gate on the permission
  // that actually consumes scope rather than on breadth of entitlement.
  const scopedScreens = useHasPermission("leader.view");
  if (!canSwitch || !scopedScreens) return null;

  return (
    <div className="px-3 pt-1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-secondary/40 px-3 py-2 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                Viser
              </span>
              <span className="block truncate text-[13px] text-foreground">{label}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-1.5">
          <Option
            label="Alle team"
            hint={`${allowed.length} team`}
            selected={teamId === null}
            onSelect={() => setTeam(null)}
          />
          <div className="my-1 h-px bg-border" />
          {allowed.map((id) => (
            <Option
              key={id}
              label={TEAM_NAMES[id] ?? id}
              selected={teamId === id}
              onSelect={() => setTeam(id)}
            />
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Option({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Check
          className={`size-3.5 shrink-0 ${selected ? "text-[var(--ab-accent-11)]" : "opacity-0"}`}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
      {hint && <span className="font-mono text-[10.5px] text-muted-foreground">{hint}</span>}
    </button>
  );
}
