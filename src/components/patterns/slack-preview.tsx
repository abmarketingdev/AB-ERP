"use client";

import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBehindPlan } from "@/lib/api/staffing";
import { useCompliance } from "@/lib/api/tasks";

/**
 * BEM-05 og OPPG-03 — automatisk varsling på Slack.
 *
 * Both are "Bør" in the SRS, and both are the same mechanism: a message the
 * system writes and Slack delivers. Showing the text rather than a "sent" tick
 * is the same decision as for the interview SMS — the wording is the part
 * somebody can object to *before* it starts going out to real people, and a
 * message that reads as an accusation will quietly cost more than the feature
 * is worth.
 *
 * The absence reminder text comes from the server (`staffing/behind-plan/`).
 * The overdue line is composed here from the compliance counts, worded as the
 * server's `oppgaver_forfalt` template, which lists the task titles as well.
 */
export function SlackPreview({ kind }: { kind: "absence" | "tasks" }) {
  return kind === "absence" ? <AbsencePreview /> : <TasksPreview />;
}

function AbsencePreview() {
  const q = useBehindPlan();
  if (q.isPending) return <Skeleton className="h-28 w-full rounded-lg" />;
  const rows = (q.data ?? []).map((r) => ({ to: r.name, body: r.body }));
  return <Preview title="Påminnelser som sendes på Slack" lead="Ansatte som ligger bak planlagt oppmøte får denne meldingen automatisk, én gang i uken. Du får et sammendrag." rows={rows} />;
}

function TasksPreview() {
  const q = useCompliance();
  if (q.isPending) return <Skeleton className="h-28 w-full rounded-lg" />;
  const rows = (q.data ?? []).filter((r) => r.overdue > 0).map((r) => ({
    to: r.leader,
    body: `Hei ${r.leader.split(" ")[0]}! Du har ${r.overdue === 1 ? "1 forfalt oppgave" : `${r.overdue} forfalte oppgaver`} i portalen.`,
  }));
  return <Preview title="Varsel om forfalte oppgaver" lead="Ledere med forfalte oppgaver får én samlet melding per dag." rows={rows} />;
}

function Preview({ title, lead, rows }: { title: string; lead: string; rows: { to: string; body: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
            {title}
          </h2>
          <Badge variant="outline" className="text-[10px]">forhåndsvisning</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{lead}</p>
        <ul className="flex flex-col gap-2">
          {rows.map((m, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] uppercase">slack</Badge>
                <span>{m.to}</span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
