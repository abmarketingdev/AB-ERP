"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X, Clock, ShieldCheck, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidates, useStages, useCandidateDecision } from "@/lib/api/recruitment";
import { errorMessage } from "@/lib/api/client";
import type { Candidate } from "@/types/recruitment";
import { DeputyCard } from "@/components/patterns/deputy-card";

/**
 * GODK-01 … GODK-05 — the approval queue.
 *
 * This is the narrowest screen in the product and the most important: the SRS
 * diagram is titled "ingen starter onboarding uten Oles godkjenning", and this
 * is where that is true. One list, one decision, a comment, and nothing else to
 * do here.
 *
 * GODK-01 says what the leader must send along — e-post, kontrakt, oppstartsdato,
 * team, prosjekt, junior/senior, arbeidsdager, stillingsprosent, student. Those
 * are captured as the fields of the "Til godkjenning" stage, so they arrive in
 * the candidate's history rather than in a separate form that can go missing.
 */

/** GODK-05 — a queue item older than this is overdue and gets chased. */
const PURRING_DAYS = 3;

const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });

export default function Godkjenning() {
  const stages = useStages();
  const candidates = useCandidates();
  const decide = useCandidateDecision();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const queue = React.useMemo(
    () => (candidates.data ?? []).filter((c) => c.stageId === "til-godkjenning"),
    [candidates.data],
  );
  const decided = React.useMemo(
    () => (candidates.data ?? []).filter((c) => c.stageId === "godkjent" || c.stageId === "onboarding" || c.stageId === "ansatt"),
    [candidates.data],
  );

  async function run(candidate: Candidate, decision: "godkjent" | "avvist") {
    setError(null);
    if (decision === "avvist" && !comment.trim()) {
      setError("Skriv en begrunnelse før du avviser.");
      return;
    }
    try {
      await decide.mutateAsync({ id: candidate.id, decision, comment: comment.trim() });
      setOpenId(null);
      setComment("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <PermissionGate permission="approval.view">
      <div className="flex flex-1 flex-col gap-6">
        <PageHeader
          title="Godkjenning"
          description={
            queue.length === 0
              ? "Ingen kandidater venter på deg"
              : `${queue.length} kandidat${queue.length === 1 ? "" : "er"} venter på godkjenning`
          }
          source="Rekrutteringslogg"
          lastUpdated={new Date()}
        />

        {/* The rule, stated where the decision is made. */}
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--ab-accent-9)]" aria-hidden />
          Ingen kandidat kan gå videre til onboarding eller ansettelse uten at den er godkjent her.
          Avslag krever en begrunnelse, og begge deler havner i kandidatens historikk.
        </p>

        <DeputyCard />

        <QueryBoundary
          query={candidates}
          skeleton={<QueueSkeleton />}
          isEmpty={() => queue.length === 0 && decided.length === 0}
          emptyTitle="Ingen kandidater i løpet ennå"
          emptyDescription="Når en leder sender en kandidat til godkjenning dukker den opp her."
          className="flex flex-col gap-6"
        >
          {() => (
            <>
              {queue.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Køen er tom. Ingenting venter på deg akkurat nå.
                  </CardContent>
                </Card>
              ) : (
                <ul className="flex flex-col gap-3">
                  {queue.map((c) => {
                    const submitted = c.history.filter((h) => h.stageId === "til-godkjenning").at(-1);
                    const open = openId === c.id;
                    const waitingDays = daysSince(submitted?.at);
                    const overdue = waitingDays !== null && waitingDays >= PURRING_DAYS;

                    return (
                      <li key={c.id}>
                        <Card className={overdue ? "border-warning/40" : undefined}>
                          <CardContent className="flex flex-col gap-4 py-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={`/rekruttering/kandidater/${c.id}`}
                                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {c.name}
                                  </Link>
                                  <Badge variant="outline">{c.campaign}</Badge>
                                  {overdue && (
                                    <Badge className="gap-1 bg-warning/10 text-warning-on-tint">
                                      <Clock className="size-3" aria-hidden />
                                      Venter {waitingDays} dager
                                    </Badge>
                                  )}
                                </div>
                                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                                  {c.phone} · {c.email} · sendt inn av {c.owner}
                                </p>
                              </div>
                              {!open && (
                                <Button size="sm" onClick={() => { setOpenId(c.id); setComment(""); setError(null); }}>
                                  Behandle
                                </Button>
                              )}
                            </div>

                            {/* GODK-01 — exactly what the leader submitted, verbatim. */}
                            {submitted && (
                              <div className="rounded-lg border border-border bg-muted/30 p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Sendt til godkjenning {submitted.at}
                                </p>
                                <p className="mt-1 text-sm">{submitted.detail}</p>
                              </div>
                            )}

                            {open && (
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <Label htmlFor={`cmt-${c.id}`}>
                                    Kommentar <span className="text-muted-foreground">(påkrevd ved avslag)</span>
                                  </Label>
                                  <Textarea
                                    id={`cmt-${c.id}`}
                                    rows={3}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    placeholder="Kort begrunnelse som blir stående i historikken"
                                  />
                                </div>
                                {error && <p className="text-sm text-danger">{error}</p>}
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" className="gap-1.5" disabled={decide.isPending}
                                    onClick={() => run(c, "godkjent")}>
                                    <Check className="size-4" /> Godkjenn
                                  </Button>
                                  <Button size="sm" variant="outline" className="gap-1.5 text-danger" disabled={decide.isPending}
                                    onClick={() => run(c, "avvist")}>
                                    <X className="size-4" /> Avvis
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); setError(null); }}>
                                    Avbryt
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* What the decision led to — the proof that the gate is doing something. */}
              {decided.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-medium text-muted-foreground">Godkjent og videre i løpet</h2>
                  <Card>
                    <CardContent className="flex flex-col divide-y divide-border p-0">
                      {decided.map((c) => {
                        const stage = (stages.data ?? []).find((s) => s.id === c.stageId);
                        const doneCount = c.onboarding.filter((t) => t.done).length;
                        return (
                          <Link
                            key={c.id}
                            href={`/rekruttering/kandidater/${c.id}`}
                            className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="font-medium">{c.name}</span>
                            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                            <Badge variant="outline">{stage?.label ?? c.stageId}</Badge>
                            {c.onboarding.length > 0 && (
                              <span className="text-xs tabular-nums text-muted-foreground">
                                Onboarding {doneCount}/{c.onboarding.length}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </CardContent>
                  </Card>
                </section>
              )}
            </>
          )}
        </QueryBoundary>
      </div>
    </PermissionGate>
  );
}

/** Parses the Norwegian stamp the mock writes ("12. aug 2026, 09:14"). */
function daysSince(stamp?: string): number | null {
  if (!stamp) return null;
  const months = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
  const m = stamp.match(/(\d{1,2})\.\s*([a-zæøå]+)\s*(\d{4})/i);
  if (!m) return null;
  const monthIdx = months.indexOf(m[2].slice(0, 3).toLowerCase());
  if (monthIdx < 0) return null;
  const then = new Date(Number(m[3]), monthIdx, Number(m[1]));
  // The fixtures are anchored to the demo's "today", not the wall clock.
  const now = new Date("2026-08-20T09:12:00.000Z");
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
    </div>
  );
}
