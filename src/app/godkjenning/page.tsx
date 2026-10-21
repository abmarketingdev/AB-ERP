"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, X, Clock, ShieldCheck, ArrowRight, Undo2, CalendarClock, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { Mascot } from "@/components/patterns/mascot";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApprovalQueue, useDecideApproval, type DecisionKind } from "@/lib/api/approval";
import { errorMessage } from "@/lib/api/client";
import { useAccess } from "@/lib/use-access";
import { IS_MOCK } from "@/lib/data-source";
import {
  CONTRACT_KIND_LABEL, POSITION_LEVEL_LABEL, WEEKDAY_LABEL, type ApprovalRequest,
} from "@/types/approval";
import { DeputyCard } from "@/components/patterns/deputy-card";

/**
 * GODK-01 … GODK-05 — the approval queue.
 *
 * This is the narrowest screen in the product and the most important: the SRS
 * diagram is titled "ingen starter onboarding uten Oles godkjenning", and this
 * is where that is true. One list, one decision, a comment, and nothing else to
 * do here.
 *
 * The nine GODK-01 fields arrive typed from the leader's form and are shown in one
 * fixed order, so Ole reads every request the same way. The server decides what
 * is overdue (GODK-05: N days waiting, or the start date X days away — both
 * configuration), enforces 2FA (IFK-04) and refuses a rejection without a reason.
 */

const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });
const pctFmt = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export default function Godkjenning() {
  const pending = useApprovalQueue("pending");
  const approved = useApprovalQueue("approved");
  const decide = useDecideApproval();
  const { can, needsStepUp } = useAccess();
  const reduce = useReducedMotion();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [justApproved, setJustApproved] = React.useState<string | null>(null);

  const queue = pending.data ?? [];
  // In mock mode there is no /access/me/ token, so the demo user may always decide.
  const mayDecide = IS_MOCK || can("approval.approve");
  const stepUp = !IS_MOCK && needsStepUp("approval.approve");

  async function run(req: ApprovalRequest, decision: DecisionKind) {
    setError(null);
    if (decision !== "godkjent" && !comment.trim()) {
      setError(decision === "avvist" ? "Skriv en begrunnelse før du avviser." : "Skriv hva lederen må endre.");
      return;
    }
    try {
      await decide.mutateAsync({ id: req.id, decision, comment: comment.trim() });
      if (decision === "godkjent") setJustApproved(req.candidate.name);
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
          lastUpdated={pending.dataUpdatedAt ? new Date(pending.dataUpdatedAt) : new Date()}
        />

        {/* The rule, stated where the decision is made. */}
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-[13px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--ab-accent-9)]" aria-hidden />
          Ingen kandidat kan gå videre til onboarding eller ansettelse uten at den er godkjent her.
          Avslag og «send tilbake» krever en begrunnelse, og alt havner i kandidatens historikk.
        </p>

        {stepUp && (
          <p role="status" className="flex flex-wrap items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[13px] text-warning-on-tint">
            <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
            Godkjenning krever tofaktor. Logg inn på nytt med engangskode for å godkjenne eller avvise.
            <Link href="/login?stepup=1&next=/godkjenning" className="underline">Logg inn med tofaktor</Link>
          </p>
        )}

        <AnimatePresence>
          {justApproved && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm"
              role="status"
            >
              <Mascot state="win-small" motion="once" size={40} />
              <span>
                <span className="font-medium">{justApproved}</span> er godkjent. Kontrakten sendes automatisk til signering.
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setJustApproved(null)}>Lukk</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {mayDecide && <DeputyCard />}

        <QueryBoundary
          query={pending}
          skeleton={<QueueSkeleton />}
          isEmpty={() => queue.length === 0}
          emptyTitle="Køen er tom"
          emptyDescription="Når en leder sender en kandidat til godkjenning, dukker den opp her."
          className="flex flex-col gap-6"
        >
          {() => (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {queue.map((req) => {
                  const open = openId === req.id;
                  return (
                    <motion.li key={req.id} layout={!reduce}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}>
                      <Card className={req.overdue ? "border-warning/40" : undefined}>
                        <CardContent className="flex flex-col gap-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={`/rekruttering/kandidater/${req.candidate.id}`}
                                  className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                  {req.candidate.name}
                                </Link>
                                <Badge variant="outline">{req.campaign.name}</Badge>
                                {req.round > 1 && <Badge variant="outline">Runde {req.round}</Badge>}
                                {req.waitingDays > 0 && (
                                  <Badge variant={req.overdue ? undefined : "outline"}
                                    className={req.overdue ? "gap-1 bg-warning/10 text-warning-on-tint" : "gap-1"}>
                                    <Clock className="size-3" aria-hidden /> Venter {req.waitingDays} {req.waitingDays === 1 ? "dag" : "dager"}
                                  </Badge>
                                )}
                                {req.daysToStart <= 3 && (
                                  <Badge className="gap-1 bg-danger/10 text-danger">
                                    <CalendarClock className="size-3" aria-hidden />
                                    {req.daysToStart <= 0 ? "Oppstart i dag" : `Oppstart om ${req.daysToStart} ${req.daysToStart === 1 ? "dag" : "dager"}`}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                                {req.candidate.phone} · sendt inn av {req.submittedBy.name}
                              </p>
                            </div>
                            {!open && mayDecide && (
                              <Button size="sm" disabled={stepUp} onClick={() => { setOpenId(req.id); setComment(""); setError(null); }}>
                                Behandle
                              </Button>
                            )}
                          </div>

                          <SubmittedData req={req} />

                          {req.interview && (
                            <p className="text-xs text-muted-foreground">
                              Intervju med {req.interview.leader ?? "leder"}
                              {req.interview.rating != null && ` · vurdering ${req.interview.rating}/5`}
                              {req.interview.recommend != null && ` · ${req.interview.recommend ? "anbefales" : "anbefales ikke"}`}
                              {req.interview.assessment && <span className="mt-1 block text-foreground/80">«{req.interview.assessment}»</span>}
                            </p>
                          )}

                          {open && (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`cmt-${req.id}`}>
                                  Kommentar <span className="text-muted-foreground">(påkrevd ved avslag og «send tilbake»)</span>
                                </Label>
                                <Textarea id={`cmt-${req.id}`} rows={3} value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  placeholder="Kort begrunnelse som blir stående i historikken" />
                              </div>
                              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" className="gap-1.5" disabled={decide.isPending} onClick={() => run(req, "godkjent")}>
                                  <Check className="size-4" /> Godkjenn
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5" disabled={decide.isPending}
                                  onClick={() => run(req, "sendt-tilbake")}>
                                  <Undo2 className="size-4" /> Send tilbake til leder
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5 text-danger" disabled={decide.isPending}
                                  onClick={() => run(req, "avvist")}>
                                  <X className="size-4" /> Avvis
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); setError(null); }}>Avbryt</Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </QueryBoundary>

        {/* What the decision led to — the proof that the gate is doing something. */}
        {(approved.data ?? []).length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Godkjent og videre i løpet</h2>
            <Card>
              <CardContent className="flex flex-col divide-y divide-border p-0">
                {(approved.data ?? []).slice(0, 20).map((r) => (
                  <Link key={r.id} href={`/rekruttering/kandidater/${r.candidate.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="font-medium">{r.candidate.name}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                    <Badge variant="outline">{STATUS_LABEL[r.candidate.status] ?? r.candidate.status}</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      oppstart {dayFmt.format(new Date(r.startDate))}
                      {r.decision?.asDeputy && " · godkjent av stedfortreder"}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </PermissionGate>
  );
}

/** GODK-01 — the nine fields, always in this order, so every request reads the same. */
function SubmittedData({ req }: { req: ApprovalRequest }) {
  const rows: [string, React.ReactNode][] = [
    ["E-post", req.email],
    ["Kontrakt", req.contractKinds.map((k) => CONTRACT_KIND_LABEL[k] ?? k).join(", ")],
    ["Oppstartsdato", dayFmt.format(new Date(req.startDate))],
    ["Team", req.team.name || "—"],
    ["Prosjekt", req.campaign.name || "—"],
    ["Nivå", POSITION_LEVEL_LABEL[req.positionLevel] ?? req.positionLevel],
    ["Arbeidsdager", req.workDays.map((d) => WEEKDAY_LABEL[d]).join(", ")],
    ["Stillingsprosent", `${pctFmt.format(req.positionPercentage)} %`],
    ["Student", req.isStudent ? "Ja" : "Nei"],
  ];
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 sm:block">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-right tabular-nums sm:text-left">{v}</dd>
          </div>
        ))}
      </dl>
      {req.note && <p className="mt-2 border-t border-border pt-2 text-sm">{req.note}</p>}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  godkjent: "Godkjent", onboarding: "Onboarding", ansatt: "Ansatt", "no-show": "Ikke møtt", trukket: "Trukket",
};

function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
    </div>
  );
}
