"use client";

import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNewHires } from "@/lib/api/onboarding";
import { CONTRACT_STATUS_LABEL, CHECKLIST_LABEL, type NewHire } from "@/types/onboarding";

/**
 * ONB-05 — listen over nyansatte, med framdrift.
 *
 * Sorted by how close the start date is rather than by name, because the thing
 * this list is for is noticing that somebody starts on Monday and has not
 * signed anything. ONB-03 says they cannot start before the contract is signed,
 * so that combination is flagged rather than left to be spotted.
 */

const days = (n: number) => `${n} ${n === 1 ? "dag" : "dager"}`;
const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
const TODAY = new Date();

function daysUntil(d: string) {
  return Math.round((new Date(d).getTime() - TODAY.getTime()) / 86_400_000);
}

const STATUS_BADGE: Partial<Record<NewHire["status"], { label: string; tone: string }>> = {
  pending_handover: { label: "Overføres til HR", tone: "bg-muted text-muted-foreground" },
  ready: { label: "Klar til fullføring", tone: "bg-success/10 text-success" },
  completed: { label: "Fullført", tone: "bg-success/10 text-success" },
  no_show: { label: "Ikke møtt", tone: "bg-danger/10 text-danger" },
  cancelled: { label: "Avbrutt", tone: "bg-muted text-muted-foreground" },
};

export default function Onboarding() {
  const hires = useNewHires();
  const list = [...(hires.data ?? [])].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Onboarding"
        description={`${list.filter((h) => h.status === "in_progress" || h.status === "ready" || h.status === "pending_handover").length} pågående`}
        source="Godkjente kandidater"
        lastUpdated={new Date()}
      />

      <QueryBoundary
        query={hires}
        skeleton={<div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen i onboarding"
        emptyDescription="Når Ole godkjenner en kandidat, starter onboardingen her."
        className="flex flex-col gap-3"
      >
        {() => <>{list.map((h) => <HireRow key={h.id} hire={h} />)}</>}
      </QueryBoundary>
    </div>
  );
}

function HireRow({ hire: h }: { hire: NewHire }) {
  const done = h.checklist.filter((c) => c.done).length;
  const pct = Math.round((done / h.checklist.length) * 100);
  const until = daysUntil(h.startDate);
  // ONB-03 — starting without a signed contract is not allowed, so a start date
  // approaching with an unsigned contract is the one thing worth shouting about.
  const open = h.status !== "completed" && h.status !== "no_show" && h.status !== "cancelled";
  const blocked = open && h.contract.status !== "signert" && until <= 7;
  const badge = STATUS_BADGE[h.status];
  // A finished or stopped onboarding has no «next» step to point at.
  const next = open ? h.checklist.find((c) => !c.done) : undefined;

  return (
    <Link
      href={`/onboarding/${h.id}`}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className={blocked ? "border-danger/40 transition-colors hover:bg-muted/30" : "transition-colors hover:bg-muted/30"}>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{h.name}</span>
              <Badge variant="outline">{h.team}</Badge>
              <Badge variant="outline">{h.campaign}</Badge>
              {badge && <Badge className={badge.tone}>{badge.label}</Badge>}
              {h.hrSync?.state === "failed" && <Badge className="bg-warning/10 text-warning-on-tint">HR-synk feilet</Badge>}
              <Badge className={h.contract.status === "signert" ? "bg-success/10 text-success" : "bg-warning/10 text-warning-on-tint"}>
                Kontrakt: {CONTRACT_STATUS_LABEL[h.contract.status]}
              </Badge>
              {h.contract.remindersSent > 0 && h.contract.status !== "signert" && (
                <Badge variant="outline" className="text-[10px]">{h.contract.remindersSent} purring{h.contract.remindersSent === 1 ? "" : "er"}</Badge>
              )}
            </div>
            <span className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground">
              Starter {dayFmt.format(new Date(h.startDate))}
              {until === 0 ? " (i dag)" : until > 0 ? ` (om ${days(until)})` : ` (for ${days(-until)} siden)`}
              <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </div>

          {blocked && (
            <p className="flex items-center gap-2 text-[13px] text-danger">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Kontrakten er ikke signert, og oppstart er {until <= 0 ? "i dag" : `om ${days(until)}`}. Den ansatte kan ikke starte før den er signert.
            </p>
          )}

          <div className="flex items-center gap-3">
            <Progress value={pct} className="h-1.5 flex-1" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {done}/{h.checklist.length}
              {next && ` · neste: ${CHECKLIST_LABEL[next.key]}`}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
