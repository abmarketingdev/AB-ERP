"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { KpiTile } from "@/components/patterns/kpi-tile";
import { BulletBar } from "@/components/charts/bullet-bar";
import { Roy } from "@/components/patterns/roy";
import { Segmented } from "@/components/patterns/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderKpis, useTeamRollups } from "@/lib/api/leader";
import { useScope } from "@/lib/scope";
import { formatNumber, formatPercent } from "@/lib/format";
import type { TeamRollupRow } from "@/types/leader";

/**
 * The sales chief's overview — FR-L-01 across every team in scope.
 *
 * This screen exists because comparing teams is the one question a team lead
 * cannot ask, and it is the sales chief's whole job. Three decisions:
 *
 * **It sorts by what needs attention, not by who is winning.** Default order is
 * distance behind expected pace. A chief opening this at 08:00 needs to know
 * where to spend the day, and "best first" answers a different question — one
 * that turns a management tool into a league table with named leads on it.
 *
 * **Sales and courses are separate columns and never combine into a score.**
 * Team Øst is on plan and badly behind on courses; Team Sør is the reverse
 * shape. A single composite number would hide both. There is deliberately no
 * ranking column, no index, no letter grade.
 *
 * **Each row is a doorway, not a verdict.** "Se teamet" narrows the whole portal
 * to that team — the same screens a team lead uses, which is doc 01's "one
 * portal, two scopes" made literal rather than asserted.
 */

type Sort = "attention" | "size" | "name";

export default function LederTeam() {
  const now = new Date();
  const kpis = useLeaderKpis();
  const teams = useTeamRollups();
  const { setTeam } = useScope();
  const router = useRouter();
  const [sort, setSort] = React.useState<Sort>("attention");
  const [openId, setOpenId] = React.useState<string | null>(null);

  function openTeam(id: string) {
    setTeam(id);
    router.push(`/leder/teamresultater?team=${id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Team"
        description="Alle team i regionen, side om side"
        period="August 2026"
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      <QueryBoundary
        query={kpis}
        skeleton={<Skeleton className="h-36 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen tall for regionen"
        emptyDescription="Tallene kommer fra siste godkjente import."
      >
        {(list) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((k) => (
              <KpiTile key={k.key} kpi={k} />
            ))}
          </div>
        )}
      </QueryBoundary>

      <QueryBoundary
        query={teams}
        skeleton={<Skeleton className="h-96 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen team i din tilgang"
        emptyDescription="Ta kontakt med administrator hvis dette ser feil ut."
        className="flex flex-col gap-4"
      >
        {(rows) => {
          const sorted = [...rows].sort(SORTS[sort]);
          const behind = rows.filter((t) => t.donors < t.expected);

          return (
            <>
              <Guide behind={behind.length} total={rows.length} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-medium text-foreground">
                  {sort === "attention" ? "Sortert etter avstand fra forventet takt" : "Alle team"}
                </h2>
                <Segmented
                  value={sort}
                  onChange={setSort}
                  ariaLabel="Sorter team"
                  layoutId="team-sort"
                  options={[
                    { value: "attention", label: "Trenger oppfølging" },
                    { value: "size", label: "Størrelse" },
                    { value: "name", label: "Navn" },
                  ]}
                />
              </div>

              <ul className="flex flex-col gap-3">
                {sorted.map((t) => (
                  <li key={t.id}>
                    <TeamRow
                      team={t}
                      expanded={openId === t.id}
                      onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                      onOpen={() => openTeam(t.id)}
                    />
                  </li>
                ))}
              </ul>

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Region Vest · {rows.length} team ·{" "}
                {formatNumber(rows.reduce((n, t) => n + t.headcount, 0))} personer · tallene er kun
                godkjente salg · ingen rangering og ingen samlescore
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

const SORTS: Record<Sort, (a: TeamRollupRow, b: TeamRollupRow) => number> = {
  // Furthest behind expected pace, measured as a share of the target so a big
  // team is not permanently top just for being big.
  attention: (a, b) => (a.donors - a.expected) / a.target - (b.donors - b.expected) / b.target,
  size: (a, b) => b.headcount - a.headcount,
  name: (a, b) => a.name.localeCompare(b.name, "nb-NO"),
};

/**
 * Røy appears here and not on the rows below.
 *
 * This card is about how to read a screen; the rows are about named team leads
 * and their people. A character alongside "Team Sør is 103 behind" would be
 * commenting on Petter Ruud's month, which is exactly the placement the
 * research argued against. Guidance is fair game; judgement is not.
 */
function Guide({ behind, total }: { behind: number; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-secondary/30 px-5 py-4">
      <Roy state="thinking" size={44} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-foreground">
          {behind === 0
            ? `Alle ${total} team ligger på eller over forventet takt.`
            : `${behind} av ${total} team ligger under forventet takt akkurat nå.`}
        </p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Salg og kurs står i hver sin kolonne og slås aldri sammen til én score — et team kan
          ligge godt an på salg og likevel ha et kursetterslep. Åpne et team for å se
          enkeltpersonene.
        </p>
      </div>
    </div>
  );
}

function TeamRow({
  team,
  expanded,
  onToggle,
  onOpen,
}: {
  team: TeamRollupRow;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const diff = team.donors - team.expected;
  const projected = Math.round((team.donors / 20) * 31);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 px-5 pb-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] text-foreground">{team.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {team.region} · {team.lead} · {team.headcount} personer
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpen}>
              Se teamet
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={`Vis detaljer for ${team.name}`}
              className="min-h-11 min-w-11 rounded-lg border border-border p-1.5 text-muted-foreground sm:min-h-8 sm:min-w-8 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        </div>

        <BulletBar
          label={`${team.name} — aktive givere`}
          current={team.donors}
          target={team.target}
          expected={team.expected}
          projected={projected}
          unit="givere"
        />

        {/* Sales and quality on one line, in words. No colour carries meaning
            that the sentence does not already carry. */}
        <p className="text-[13px] text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">{formatNumber(team.donors)}</span>{" "}
          av {formatNumber(team.target)} givere ·{" "}
          {diff === 0 ? (
            "på forventet takt"
          ) : (
            <>
              <span className="font-mono tabular-nums text-foreground">
                {formatNumber(Math.abs(diff))}
              </span>{" "}
              {diff < 0 ? "under" : "over"} forventet takt
            </>
          )}
        </p>
      </div>

      {expanded && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
          <Cell label="Dører per dag" value={formatNumber(team.doorsPerDay)} />
          <Cell label="Ja-prosent" value={formatPercent(team.yesRate / 100, 1)} />
          <Cell label="Andel godkjent" value={formatPercent(team.approvedShare / 100, 1)} />
          <Cell label="Rekrutterte" value={formatNumber(team.recruited)} />
          <Cell
            label="Under terskel"
            value={`${team.belowThreshold} av ${team.headcount}`}
            tone={team.belowThreshold > team.headcount / 2 ? "text-danger" : undefined}
          />
          <Cell
            label="Manglende kurs"
            value={String(team.coursesMissing)}
            tone={team.coursesMissing > team.headcount ? "text-warning" : undefined}
          />
        </dl>
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 font-mono text-[15px] tabular-nums ${tone ?? "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}
