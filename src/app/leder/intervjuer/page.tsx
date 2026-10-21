"use client";

import * as React from "react";
import { MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { mascotFor } from "@/lib/use-mascot";
import { formatPhone, phoneHref } from "@/lib/format";
import { Mascot } from "@/components/patterns/mascot";
import { SelectableButton } from "@/components/patterns/selectable-button";
import { useInterviews, useInterviewOutcome } from "@/lib/api/interviews";
import { errorMessage } from "@/lib/api/client";
import { INTERVIEW_STATUS_LABEL, outcomeSchema, type Interview } from "@/types/interview";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * BOOK-08 / BOOK-09 — lederens egne intervjuer, og skjemaet etterpå.
 *
 * The server scopes the list to the signed-in leader (BOOK-09, IFK-03); this page
 * never asks for anyone else's. A leader looking at a colleague's list is one
 * misclick from recording an outcome on the wrong interview.
 *
 * Attendance and assessment are one submission, not two (master decision 6:
 * assessment required, rating and recommendation optional). They are answered at
 * the same moment, by the same person, and splitting them produces a half-filled
 * record the no-show report then has to guess about.
 *
 * Leaders do this from a phone, right after the interview (IFK-08), so the form
 * is a bottom sheet with thumb-sized answers.
 */

const OSLO = "Europe/Oslo";
const fullFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO });


function LederIntervjuerPage() {
  const interviews = useInterviews({ scope: "mine" });
  const [now] = React.useState(() => Date.now());

  const mine = interviews.data ?? [];
  const started = (iv: Interview) => new Date(iv.startsAt).getTime() <= now;
  // What the leader still owes an answer on — the list OPPG-01's task points at.
  const awaiting = mine.filter((iv) => iv.status === "booket" && started(iv)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = mine.filter((iv) => iv.status === "booket" && !started(iv)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const done = mine.filter((iv) => iv.attended !== null).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 20);
  const today = dayKey.format(new Date(now));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Mine intervjuer"
        description={`${upcoming.length} kommende · ${awaiting.length} venter på registrering`}
        source="Rekrutteringssystemet"
        lastUpdated={interviews.dataUpdatedAt ? new Date(interviews.dataUpdatedAt) : undefined}
      />

      <QueryBoundary
        query={interviews}
        skeleton={<div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Du har ingen intervjuer"
        emptyDescription="Rekrutterer booker intervjuer på deg, og de dukker opp her med tid, sted og kandidatens telefon."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            {awaiting.length > 0 ? (
              <Section title="Venter på registrering">
                {awaiting.map((iv) => <li key={iv.id}><InterviewRow iv={iv} awaiting /></li>)}
              </Section>
            ) : (mine.some((iv) => iv.attended !== null) && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm" role="status">
                <Mascot {...mascotFor("allClear")} size={56} label="Alt er registrert" />
                Alt er registrert. Ingen intervjuer venter på oppmøte.
              </div>
            ))}
            {upcoming.length > 0 && (
              <Section title="Kommende">
                {upcoming.map((iv) => <li key={iv.id}><InterviewRow iv={iv} today={dayKey.format(new Date(iv.startsAt)) === today} /></li>)}
              </Section>
            )}
            {done.length > 0 && (
              <Section title="Registrert">
                {done.map((iv) => (
                  <li key={iv.id}>
                    <Card>
                      <CardContent className="flex flex-col gap-1.5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{iv.candidateName}</span>
                          <Badge className={iv.attended ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}>
                            {INTERVIEW_STATUS_LABEL[iv.status]}
                          </Badge>
                          {iv.rating ? <span className="text-xs text-muted-foreground">{iv.rating}/5</span> : null}
                          <span className="text-xs tabular-nums text-muted-foreground">{fullFmt.format(new Date(iv.startsAt))}</span>
                        </div>
                        {iv.assessment && <p className="text-sm">{iv.assessment}</p>}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </Section>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function InterviewRow({ iv, awaiting, today }: { iv: Interview; awaiting?: boolean; today?: boolean }) {
  const [open, setOpen] = React.useState(false);
  // A new key per opening: the form starts empty every time, never with a half-answer from before.
  const [opening, setOpening] = React.useState(0);
  return (
    <Card className={awaiting ? "border-warning/40" : today ? "border-[var(--ab-accent-7)]" : undefined}>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{iv.candidateName}</span>
            {awaiting && <Badge className="bg-warning/10 text-warning-on-tint">Venter på registrering</Badge>}
            {today && !awaiting && <Badge className="bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]">I dag</Badge>}
          </div>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">{fullFmt.format(new Date(iv.startsAt))}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="size-3" aria-hidden />{iv.location}</span>
            {iv.candidatePhone && (
              <a href={phoneHref(iv.candidatePhone)} className="flex min-h-9 items-center gap-1 underline-offset-2 hover:underline">
                <Phone className="size-3" aria-hidden />{formatPhone(iv.candidatePhone)}
              </a>
            )}
          </p>
        </div>
        {awaiting && (
          <Button className="min-h-11 w-full sm:w-auto" onClick={() => { setOpening((n) => n + 1); setOpen(true); }}>Registrer oppmøte</Button>
        )}
      </CardContent>
      {awaiting && <OutcomeSheet key={opening} iv={iv} open={open} onOpenChange={setOpen} />}
    </Card>
  );
}

function OutcomeSheet({ iv, open, onOpenChange }: { iv: Interview; open: boolean; onOpenChange: (o: boolean) => void }) {
  const outcome = useInterviewOutcome();
  const [attended, setAttended] = React.useState<boolean | null>(null);
  const [assessment, setAssessment] = React.useState("");
  const [rating, setRating] = React.useState<number | null>(null);
  const [recommend, setRecommend] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setError(null);
    if (attended === null) { setError("Velg om kandidaten møtte."); return; }
    const parsed = outcomeSchema.safeParse({ attended, assessment, rating, recommend: attended ? recommend : null });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Sjekk skjemaet."); return; }
    try {
      await outcome.mutateAsync({ id: iv.id, ...parsed.data });
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Oppmøte: ${iv.candidateName}`}
      description={fullFmt.format(new Date(iv.startsAt))}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button disabled={outcome.isPending} onClick={submit}>{outcome.isPending ? "Lagrer …" : "Lagre oppmøte"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Møtte kandidaten? <span className="text-danger" aria-hidden>*</span></legend>
          <div role="radiogroup" aria-label="Møtte kandidaten?" className="grid grid-cols-2 gap-2">
            <SelectableButton role="radio" selected={attended === true} className="min-h-12" onClick={() => setAttended(true)}>Møtte</SelectableButton>
            <SelectableButton role="radio" selected={attended === false} className="min-h-12" onClick={() => setAttended(false)}>Møtte ikke</SelectableButton>
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`as-${iv.id}`}>{attended === false ? "Hva skjedde?" : "Vurdering"} <span className="text-danger" aria-hidden>*</span></Label>
          <Textarea id={`as-${iv.id}`} rows={4} value={assessment} onChange={(e) => setAssessment(e.target.value)} required
            placeholder={attended === false ? "F.eks. svarte ikke på telefon" : "Kort vurdering av kandidaten"} className="text-base" />
        </div>

        {attended === true && (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Helhetsinntrykk <span className="font-normal text-muted-foreground">(valgfritt)</span></legend>
              <div role="radiogroup" aria-label="Helhetsinntrykk" className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectableButton key={n} role="radio" selected={rating === n} className="min-w-11 tabular-nums"
                    aria-label={`${n} av 5`} onClick={() => setRating(rating === n ? null : n)}>
                    {n}
                  </SelectableButton>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Anbefales videre til godkjenning? <span className="font-normal text-muted-foreground">(valgfritt)</span></legend>
              <div role="radiogroup" aria-label="Anbefales videre til godkjenning?" className="grid grid-cols-2 gap-2">
                <SelectableButton role="radio" selected={recommend === true} onClick={() => setRecommend(recommend === true ? null : true)}>Ja</SelectableButton>
                <SelectableButton role="radio" selected={recommend === false} onClick={() => setRecommend(recommend === false ? null : false)}>Nei</SelectableButton>
              </div>
            </fieldset>
          </>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </ResponsiveSheet>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function LederIntervjuer() {
  return (
    <PermissionGate permission="interviews.view">
      <LederIntervjuerPage />
    </PermissionGate>
  );
}
