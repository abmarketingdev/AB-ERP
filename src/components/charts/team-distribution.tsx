"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatNumber, formatPercent } from "@/lib/format";
import { SparkLine } from "@/components/charts/spark-line";
import type { TeamMember, Threshold } from "@/types/leader";
import { DUR, EASE_ENTER, stagger } from "@/lib/motion";

/**
 * The team as a distribution against its threshold — a bullet-bar per person.
 *
 * This answers the question a leader actually arrives with ("who is below, and
 * by how much?") in one glance, where a sorted table answers it only after
 * reading every row. Stephen Few's argument for bullet bars over gauges applies
 * here: ten of them fit in the space one gauge would take, and unlike a gauge
 * they compare down a column.
 *
 * Colour is not the signal — the bar crossing the threshold marker is. Below-
 * threshold rows additionally carry a label, never a hue alone.
 */
export function TeamDistribution({
  members,
  threshold,
  onSelect,
  selectedId,
}: {
  members: TeamMember[];
  threshold?: Threshold;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}) {
  const reduced = useReducedMotion();
  const max = Math.max(...members.map((m) => m.doors), threshold?.value ?? 0) * 1.12;
  const sorted = [...members].sort((a, b) => b.doors - a.doors);
  const thresholdPct = threshold ? (threshold.value / max) * 100 : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-1 pt-4">
        <p className="text-[13px] font-medium text-foreground">Dører per dag, mot terskel</p>
        {threshold && (
          <p className="font-mono text-[10.5px] text-muted-foreground">
            Terskel {formatNumber(threshold.value)} {threshold.unit} · eid av {threshold.owner}
          </p>
        )}
      </div>

      <div className="relative px-5 pb-4 pt-3">
        {/* The threshold rule runs the full height so every bar is read against it. */}
        {thresholdPct !== null && (
          <div
            className="pointer-events-none absolute inset-y-3 z-10 w-px bg-foreground/45"
            style={{ left: `calc(${thresholdPct}% * (100% - 168px) / 100% + 148px)` }}
            aria-hidden
          />
        )}

        <ul className="flex flex-col gap-1">
          {sorted.map((m, i) => {
            const pct = (m.doors / max) * 100;
            const below = m.belowThreshold;
            const selected = selectedId === m.id;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onSelect?.(m.id)}
                  aria-pressed={selected}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8 ${
                    selected ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="flex w-[128px] shrink-0 items-center gap-1.5">
                    {below && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />}
                    {/* A person's name is the one label that must never be unreadable —
                        the row is about them, and "Kristoffer Bjørnstad-Sæ…" is
                        not a name. */}
                    <span className="truncate text-[12.5px] text-foreground" title={m.name}>
                      {m.name}
                    </span>
                  </span>

                  <span className="relative h-5 flex-1 rounded-[3px] bg-secondary/50">
                    <motion.span
                      className={`absolute inset-y-0 left-0 rounded-[3px] ${
                        below ? "bg-warning/45" : "bg-[var(--ab-accent-9)]/45"
                      }`}
                      initial={reduced ? false : { width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: DUR.slow, delay: stagger(i), ease: EASE_ENTER }}
                    />
                  </span>

                  <span className="w-9 shrink-0 text-right font-mono text-[12px] tabular-nums text-foreground">
                    {formatNumber(m.doors)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground">
        Prikk og merking viser hvem som ligger under terskel · klikk en rad for detaljer
      </p>
    </div>
  );
}

/** Inline detail for one person, opened from either view. */
export function MemberDetail({ member, threshold }: { member: TeamMember; threshold?: Threshold }) {
  const gap = threshold ? member.doors - threshold.value : null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div>
          <p className="text-[14px] text-foreground">{member.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {member.team} · {member.campaign}
          </p>
        </div>
        <SparkLine
          points={member.spark}
          width={140}
          height={34}
          className="text-muted-foreground"
          ariaLabel={`${member.name}, utvikling over ${member.spark.length} dager`}
        />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 pb-4 sm:grid-cols-4">
        <Stat label="Dører per dag" value={formatNumber(member.doors)} />
        <Stat label="Ja" value={formatNumber(member.yes)} />
        <Stat label="Ja-prosent" value={formatPercent(member.yesRate / 100, 1)} />
        <Stat label="Aktive givere" value={formatNumber(member.activeDonors)} />
      </dl>
      {threshold && (
        <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground">
          {gap !== null && gap < 0
            ? `${Math.abs(gap)} under terskel på ${threshold.value} ${threshold.unit} · eid av ${threshold.owner}`
            : `${gap} over terskel på ${threshold.value} ${threshold.unit} · eid av ${threshold.owner}`}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-[18px] leading-none tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
