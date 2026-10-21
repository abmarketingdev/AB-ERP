"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Mail, Phone, FileText, ClipboardCheck, UserMinus, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { Mascot } from "@/components/patterns/mascot";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  useAdvanceStage,
  useCandidate,
  useStages,
  useCloseCandidate,
  useMinimiseCandidate,
} from "@/lib/api/recruitment";
import { errorMessage } from "@/lib/api/client";
import type { Candidate, CandidateHistoryEntry, RecruitmentStage } from "@/types/recruitment";
import { STAGE_BADGE, CONTRACT_LABEL, CONTRACT_BADGE, TERMINAL_STAGE_IDS } from "@/lib/recruitment";
import { AdvanceStageDialog } from "@/components/patterns/advance-stage-dialog";
import { CandidateTags } from "@/components/patterns/candidate-tags";
import { CandidateNotes } from "@/components/patterns/candidate-notes";
import { ChannelMark, channelOf } from "@/components/patterns/channel-mark";
import { formatPhone } from "@/lib/format";

/**
 * FR-R-10 — ending a candidate process.
 *
 * Access and retention are two clocks, and the screen keeps them apart because
 * conflating them is the usual mistake. Access stops the moment the process
 * ends. Retention runs on for an agreed period, because the company may need to
 * show why someone was not hired — and then the contact details actually get
 * deleted, which is a separate, recorded event rather than something that
 * quietly happens.
 *
 * The panel therefore states what is kept, what goes, on what basis and when.
 * "We keep it for a while" is not something a candidate can act on or challenge.
 */
function CloseForm({
  name,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");
  return (
    <section className="rounded-xl border border-border bg-secondary/40 px-5 py-4">
      <p className="text-[13.5px] text-foreground">Avslutte prosessen for {name}?</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Tilgangen fjernes med én gang. Opplysningene beholdes i {RETENTION_MONTHS_UI} måneder for å
        kunne dokumentere begrunnelsen, og slettes deretter.
      </p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Begrunnelse (påkrevd — vises i kandidatens historikk)"
        aria-label="Begrunnelse"
        className="mt-2.5 min-h-16 text-sm"
        autoFocus
      />
      {error && (
        <p className="mt-2 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" variant="destructive" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>
          {pending ? "Avslutter…" : "Avslutt prosessen"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </section>
  );
}

const RETENTION_MONTHS_UI = 6;

function RetentionPanel({
  closure,
  pending,
  onMinimise,
}: {
  closure: NonNullable<Candidate["closure"]>;
  pending: boolean;
  onMinimise: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] text-foreground">
            <ShieldOff className="size-4 text-muted-foreground" aria-hidden />
            Prosessen er avsluttet
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {closure.endedAt} · tilgang fjernet {closure.accessRevokedAt}
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{closure.reason}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            closure.minimised
              ? "border-border text-muted-foreground"
              : "border-warning/35 bg-warning/10 text-warning"
          }`}
        >
          {closure.minimised ? "Opplysninger slettet" : `Oppbevares til ${closure.retentionUntil}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            {closure.minimised ? "Beholdt" : "Beholdes"}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {closure.retained.map((r) => (
              <li key={r} className="text-[12.5px] text-foreground">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            {closure.minimised ? "Slettet" : `Slettes ${closure.retentionUntil}`}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {closure.removed.map((r) => (
              <li
                key={r}
                className={`text-[12.5px] ${closure.minimised ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
        {closure.basis}
      </p>

      {!closure.minimised && (
        <div className="border-t border-border px-5 py-3.5">
          <Button size="sm" variant="outline" disabled={pending} onClick={onMinimise}>
            {pending ? "Sletter…" : "Slett opplysningene nå"}
          </Button>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Normalt skjer dette automatisk {closure.retentionUntil}. Sletting kan ikke angres og
            logges i revisjonsloggen.
          </p>
        </div>
      )}
    </section>
  );
}

export default function CandidateDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const stages = useStages();
  const candidate = useCandidate(params.id);
  const advance = useAdvanceStage();
  const closeCandidate = useCloseCandidate();
  const minimise = useMinimiseCandidate();
  const [advanceOpen, setAdvanceOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [closeError, setCloseError] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  // The picker chooses the stage; the shared AdvanceStageDialog captures what that
  // stage needs (reason codes, automatic rejection) — the same form the board uses.
  const [picked, setPicked] = React.useState<string | null>(null);
  function advanceTo(nextStageId: string) {
    setFailed(null);
    setAdvanceOpen(false);
    setPicked(nextStageId);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit gap-1.5 text-muted-foreground" onClick={() => router.push("/rekruttering/kandidater")}>
        <ArrowLeft className="size-4" /> Tilbake til kandidater
      </Button>

      <QueryBoundary
        query={stages}
        skeleton={<Skeleton className="h-64 rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen steg er definert"
      >
        {(stageList) => (
          <QueryBoundary query={candidate} skeleton={<Skeleton className="h-64 rounded-lg" />}>
            {(c) => {
              const stage = stageList.find((s) => s.id === c.stageId);
              const currentIndex = stageList.findIndex((s) => s.id === c.stageId);
              const pipelineStages = stageList.filter((s) => !s.terminal);
              const isTerminal = !!stage?.terminal;

              return (
                <div className="flex flex-1 flex-col gap-6">
                  <PageHeader
                    title={c.name}
                    description={
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <ChannelMark channel={channelOf(c.source)} />
                        {c.source} · {c.campaign} · Søkte {c.appliedDate}
                      </span>
                    }
                    source="Rekrutteringslogg"
                    actions={
                      !isTerminal ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" className="gap-1.5" onClick={() => setAdvanceOpen(true)}>
                            Flytt til neste steg <ArrowRight className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => setClosing(true)}
                          >
                            <UserMinus className="size-3.5" aria-hidden />
                            Avslutt prosessen
                          </Button>
                        </div>
                      ) : undefined
                    }
                  />

                  {/* FR-R-10 — closing the process, and what it does to the data. */}
                  {closing && !c.closure && (
                    <CloseForm
                      name={c.name}
                      pending={closeCandidate.isPending}
                      error={closeError}
                      onCancel={() => setClosing(false)}
                      onConfirm={(reason) => {
                        setCloseError(null);
                        closeCandidate.mutate(
                          { id: c.id, reason },
                          {
                            onSuccess: () => setClosing(false),
                            onError: (e: unknown) => setCloseError(errorMessage(e)),
                          },
                        );
                      }}
                    />
                  )}

                  {c.closure && (
                    <RetentionPanel
                      closure={c.closure}
                      pending={minimise.isPending}
                      onMinimise={() => minimise.mutate({ id: c.id })}
                    />
                  )}

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                      <CardContent className="space-y-4 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={STAGE_BADGE[c.stageId]}>{stage?.label}</Badge>
                          <Badge className={CONTRACT_BADGE[c.contract]} variant="secondary">
                            <FileText className="mr-1 size-3" /> Kontrakt: {CONTRACT_LABEL[c.contract]}
                          </Badge>
                          {c.nextActivity?.overdue && <Badge className="bg-danger/10 text-danger">Oppfølging forsinket</Badge>}
                        </div>

                        {!isTerminal && (
                          <div>
                            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>Steg {currentIndex + 1} av {pipelineStages.length}</span>
                              <span>{stage?.label}</span>
                            </div>
                            <div className="flex gap-1">
                              {pipelineStages.map((s, i) => (
                                <motion.div
                                  key={s.id}
                                  className="h-1.5 flex-1 rounded-full"
                                  initial={{ opacity: 0.4 }}
                                  animate={{ opacity: 1 }}
                                  style={{ background: i <= currentIndex ? "var(--ab-accent-9)" : "var(--muted)" }}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Phone className="size-3.5" /> {formatPhone(c.phone)}</span>
                          <span className="flex items-center gap-1.5"><Mail className="size-3.5" /> {c.email}</span>
                          <span>Eier: <span className="text-foreground">{c.owner}</span></span>
                        </div>

                        {c.nextActivity ? (
                          <div className={`rounded-md px-3 py-2 text-sm ${c.nextActivity.overdue ? "bg-danger/10 text-danger" : "bg-[var(--ab-accent-3)]/40 text-[var(--ab-accent-12)]"}`}>
                            Neste aktivitet: {c.nextActivity.label} — frist {c.nextActivity.date}
                          </div>
                        ) : (
                          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Ingen planlagt neste aktivitet.</div>
                        )}
                      </CardContent>
                    </Card>

                    <OnboardingCard candidate={c} stage={stage} />
                  </div>

                  <CandidateTags candidate={c} />

                  <CandidateNotes candidate={c} />

                  <HistoryTimeline history={c.history} />

                  <StagePickerDialog
                    open={advanceOpen}
                    onOpenChange={setAdvanceOpen}
                    stages={stageList}
                    currentStageId={c.stageId}
                    pending={advance.isPending}
                    error={failed}
                    onAdvance={advanceTo}
                  />
                  <AdvanceStageDialog
                    candidate={picked ? c : null}
                    stage={stageList.find((st) => st.id === picked) ?? null}
                    onClose={() => setPicked(null)}
                  />
                </div>
              );
            }}
          </QueryBoundary>
        )}
      </QueryBoundary>
    </div>
  );
}

function OnboardingCard({ candidate, stage }: { candidate: Candidate; stage: RecruitmentStage | undefined }) {
  // Onboarding has no write endpoint yet, so ticking a box is presentation only.
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const isHired = stage?.terminal === "hired" || candidate.onboarding.length > 0;

  if (!isHired) {
    return (
      <Card>
        <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
          <ClipboardCheck className="size-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Onboarding-sjekkliste vises når kandidaten er ansatt.</p>
        </CardContent>
      </Card>
    );
  }

  const tasks = candidate.onboarding.map((t) => ({ ...t, done: checked[t.id] ?? t.done }));
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;

  function toggle(id: string, next: boolean) {
    setChecked((prev) => ({ ...prev, [id]: next }));
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/*
             * Someone was hired. It is the one unambiguously good event in this
             * product that costs nobody anything — no ranking, no shortfall,
             * nobody being measured — so it is the right place for the pack's
             * "team og mål" pose. It plays once and stops.
             */}
            <Mascot state="win-small" pose="teamwork" size={56} />
            <p className="text-sm font-medium text-foreground">Onboarding</p>
          </div>
          <span className="text-xs text-muted-foreground">{done} / {total}</span>
        </div>
        <Progress value={total ? (done / total) * 100 : 0} />
        <div className="space-y-2 pt-1">
          {tasks.map((task) => (
            <label key={task.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox checked={task.done} onCheckedChange={() => toggle(task.id, !task.done)} className="mt-0.5" />
              <span className={task.done ? "text-muted-foreground line-through" : "text-foreground"}>{task.task}</span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryTimeline({ history }: { history: CandidateHistoryEntry[] }) {
  const ordered = [...history].reverse();
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">Historikk</h2>
      <p className="-mt-2 text-xs text-muted-foreground">Append-only — tidligere oppføringer kan ikke redigeres eller slettes.</p>
      <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
        {ordered.map((entry, i) => (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className="relative"
          >
            <span className="absolute -left-[26px] top-1 size-2.5 rounded-full border-2 border-background bg-[var(--ab-accent-9)]" />
            <p className="text-xs text-muted-foreground">{entry.at} · {entry.actor}</p>
            <p className="mt-0.5 text-sm text-foreground">{entry.detail}</p>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

function StagePickerDialog({
  open,
  onOpenChange,
  stages,
  currentStageId,
  pending,
  error,
  onAdvance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: RecruitmentStage[];
  currentStageId: string;
  pending: boolean;
  error: string | null;
  onAdvance: (stageId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flytt til neste steg</DialogTitle>
          <DialogDescription>Stegets minimumsinformasjon registreres og legges til i historikken — ingenting overskrives.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the step and its fields start clean each time. */}
        <AdvanceStageForm
          stages={stages}
          currentStageId={currentStageId}
          pending={pending}
          error={error}
          onAdvance={onAdvance}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AdvanceStageForm({
  stages,
  currentStageId,
  pending,
  error,
  onAdvance,
  onClose,
}: {
  stages: RecruitmentStage[];
  currentStageId: string;
  pending: boolean;
  error: string | null;
  onAdvance: (stageId: string) => void;
  onClose: () => void;
}) {
  /*
   * GODK-03 — only the moves the SERVER allows a recruiter (manualTargets). Booking
   * and approval are their own flows, named here instead of offered as options, so
   * the approval gate cannot be stepped around from this page either.
   */
  const current = stages.find((s) => s.id === currentStageId);
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  const allowed = current?.manualTargets
    ?? stages.filter((s, i) => i !== currentIdx && (i === currentIdx + 1 || TERMINAL_STAGE_IDS.includes(s.id))).map((s) => s.id);
  const options = stages.filter((s) => allowed.includes(s.id));
  const [target, setTarget] = React.useState(options[0]?.id ?? "");

  return (
    <>
      <div className="space-y-4">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <div className="space-y-1.5">
          <Label>Nytt steg</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentStageId === "kvalifisert" && (
          <p className="text-xs text-muted-foreground">«Intervju booket» settes når intervjuet bookes under Intervjuer.</p>
        )}
        {currentStageId === "intervjuet" && (
          <p className="text-xs text-muted-foreground">«Til godkjenning» sendes med godkjenningsskjemaet (leder fyller det ut).</p>
        )}
        {options.length === 0 && (
          <p className="text-sm text-muted-foreground">Ingen flytting er tilgjengelig herfra — neste steg skjer i booking, godkjenning eller onboarding.</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Avbryt</Button>
        <Button disabled={!target || pending} className="gap-1.5" onClick={() => onAdvance(target)}>
          <Check className="size-4" /> Fortsett
        </Button>
      </DialogFooter>
    </>
  );
}
