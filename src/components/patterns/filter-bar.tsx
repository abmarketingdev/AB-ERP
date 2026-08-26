"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Filters live in the URL, never in component state (FR-L-02).
 *
 * The point is shareability: a leader pastes a link into Slack and the recipient
 * sees the identical view. It also makes the browser back button behave the way
 * people expect, and survives a refresh for free.
 *
 * One row above everything it scopes — never per-chart filters, or the numbers
 * on a screen can disagree with each other.
 */

export type FilterDef = {
  key: string;
  label: string;
  /** The value meaning "no filter". Kept out of the URL when selected. */
  allValue: string;
  allLabel: string;
  options: { value: string; label: string }[];
  width?: string;
};

export function useFilterValue(key: string, fallback: string) {
  const params = useSearchParams();
  return params.get(key) ?? fallback;
}

export function FilterBar({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setFilter(key: string, value: string, allValue: string) {
    const next = new URLSearchParams(params.toString());
    if (value === allValue) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    // replace, not push — filter changes should not fill the back stack.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    filters.forEach((f) => next.delete(f.key));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const activeCount = filters.filter((f) => params.get(f.key)).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => {
        const value = params.get(f.key) ?? f.allValue;
        return (
          <Select key={f.key} value={value} onValueChange={(v) => setFilter(f.key, v, f.allValue)}>
            <SelectTrigger className={f.width ?? "w-48"} aria-label={f.label}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={f.allValue}>{f.allLabel}</SelectItem>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="gap-1.5 text-muted-foreground"
        >
          <X className="size-3.5" />
          Nullstill ({activeCount})
        </Button>
      )}
    </div>
  );
}

/** Plain-language summary of what the reader is currently looking at. */
export function FilterSummary({ parts }: { parts: string[] }) {
  return (
    <p className="font-mono text-[11px] text-muted-foreground">
      Viser: {parts.filter(Boolean).join(" · ")}
    </p>
  );
}
