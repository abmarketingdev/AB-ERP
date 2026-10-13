"use client";

import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompliance } from "@/lib/api/srs";

/**
 * OPPG-02 — "Admin ser etterlevelse per leder: fullførte og forfalte oppgaver."
 *
 * Open tasks are shown but left out of the rate. A leader with ten tasks in
 * front of them has not failed at anything yet, and counting those would make
 * the measure punish having work rather than not doing it — at which point the
 * sensible response is to stop generating tasks, which is the opposite of what
 * OPPG-01 is for.
 */

const pctFmt = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 0 });

export default function AdminOppgaver() {
  const compliance = useCompliance();
  const rows = compliance.data ?? [];
  const totalOverdue = rows.reduce((n, r) => n + r.overdue, 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Etterlevelse"
        description={`${rows.length} ledere · ${totalOverdue} forfalte oppgaver totalt`}
        source="Lederoppgaver"
        lastUpdated={new Date()}
      />

      <QueryBoundary
        query={compliance}
        skeleton={<Skeleton className="h-64 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen oppgaver registrert"
        emptyDescription="Etterlevelse vises når systemet har laget oppgaver til lederne."
      >
        {(list) => (
          <Card>
            <CardContent className="flex flex-col divide-y divide-border p-0">
              {list.map((r) => (
                <div key={r.leader} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                  <span className="w-40 shrink-0 font-medium">{r.leader}</span>
                  <div className="flex min-w-[12rem] flex-1 items-center gap-3">
                    <Progress value={(r.rate ?? 0) * 100} className="h-1.5 flex-1" />
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                      {r.rate === null ? "—" : pctFmt.format(r.rate)}
                    </span>
                  </div>
                  <span className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                    <Badge variant="outline">{r.completed} fullført</Badge>
                    <Badge variant="outline">{r.open} åpne</Badge>
                    {r.overdue > 0 ? (
                      <Badge className="gap-1 bg-danger/10 text-danger">
                        <AlertTriangle className="size-3" aria-hidden /> {r.overdue} forfalt
                      </Badge>
                    ) : (
                      <Badge variant="outline">0 forfalt</Badge>
                    )}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      <p className="text-xs text-muted-foreground">
        Prosenten er fullførte av fullførte pluss forfalte. Åpne oppgaver teller ikke med — de er
        ikke forsømt ennå.
      </p>
    </div>
  );
}
