"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/patterns/segmented";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { useCompliance } from "@/lib/api/tasks";
import { SlackPreview } from "@/components/patterns/slack-preview";

/**
 * OPPG-02 — "Admin ser etterlevelse per leder: fullførte og forfalte oppgaver."
 * §8.1 l.755 — "Admin ser hvilke ledere som har forfalte oppgaver": sorted worst
 * first, so the answer is the top of the list.
 *
 * Open tasks are shown but left out of the rate. A leader with ten tasks in
 * front of them has not failed at anything yet, and counting those would make
 * the measure punish having work rather than not doing it. Completed-late still
 * counts as done — the requirement asks for completed and overdue — but the late
 * count is shown beside it rather than hidden inside the percentage. Cancelled
 * tasks (the interview was called off) count neither way.
 */

const pctFmt = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 0 });
type Range = "30" | "90" | "alle";

function sinceDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function AdminOppgaverPage() {
  const [range, setRange] = React.useState<Range>("30");
  const compliance = useCompliance(range === "alle" ? {} : { from: sinceDays(Number(range)) });
  const rows = compliance.data ?? [];
  const totalOverdue = rows.reduce((n, r) => n + r.overdue, 0);
  const withOverdue = rows.filter((r) => r.overdue > 0).length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Etterlevelse"
        description={`${withOverdue} av ${rows.length} ledere har forfalte oppgaver · ${totalOverdue} forfalte totalt`}
        source="Lederoppgaver (frist i perioden)"
        lastUpdated={compliance.dataUpdatedAt ? new Date(compliance.dataUpdatedAt) : new Date()}
        actions={
          <Segmented ariaLabel="Periode" layoutId="compliance-range" value={range} onChange={setRange}
            options={[{ value: "30", label: "30 dager" }, { value: "90", label: "90 dager" }, { value: "alle", label: "Alle" }]} />
        }
      />

      <QueryBoundary
        query={compliance}
        skeleton={<Skeleton className="h-64 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen oppgaver i perioden"
        emptyDescription="Etterlevelse vises når systemet har laget oppgaver til lederne med frist i perioden."
      >
        {(list) => (
          <Card>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {list.map((r) => (
                <div key={r.leaderId} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                  <span className="w-44 shrink-0 font-medium">{r.leader}</span>
                  <div className="flex min-w-[12rem] flex-1 items-center gap-3">
                    <Progress value={(r.rate ?? 0) * 100} className="h-1.5 flex-1"
                      aria-label={`Etterlevelse ${r.rate === null ? "ikke målt" : pctFmt.format(r.rate)}`} />
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                      {r.rate === null ? "—" : pctFmt.format(r.rate)}
                    </span>
                  </div>
                  <span className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                    <Badge variant="outline">{r.onTime} i tide</Badge>
                    {r.late > 0 && <Badge variant="outline" className="border-warning/40 text-warning-on-tint">{r.late} for sent</Badge>}
                    <Badge variant="outline">{r.open} åpne</Badge>
                    {r.overdue > 0 ? (
                      <Badge className="gap-1 bg-danger/10 text-danger">
                        <AlertTriangle className="size-3" aria-hidden /> {r.overdue} forfalt
                      </Badge>
                    ) : (
                      <Badge variant="outline">0 forfalt</Badge>
                    )}
                    {r.cancelled > 0 && <span>{r.cancelled} kansellert</span>}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      <SlackPreview kind="tasks" />

      <p className="text-xs text-muted-foreground">
        Prosenten er fullførte (også de som ble gjort etter fristen) av fullførte pluss forfalte. Åpne oppgaver
        teller ikke med — de er ikke forsømt ennå. Kansellerte oppgaver teller verken for eller mot.
      </p>
    </div>
  );
}

export default function AdminOppgaver() {
  return (
    <PermissionGate permission="tasks.view">
      <AdminOppgaverPage />
    </PermissionGate>
  );
}
