"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterviews, useInterviewOutcome } from "@/lib/api/srs";
import { useSession } from "@/lib/permissions";
import { errorMessage } from "@/lib/api/client";
import { INTERVIEW_STATUS_LABEL, type Interview } from "@/types/interview";

/**
 * BOOK-08 / BOOK-09 — lederens egne intervjuer, og skjemaet etterpå.
 *
 * Scoped to the signed-in leader rather than showing everybody's: BOOK-09 says
 * "Leder ser sine kommende intervjuer", and a leader looking at a colleague's
 * list is one misclick from recording an outcome on the wrong interview.
 *
 * Attendance and assessment are one submission, not two. They are answered at
 * the same moment, by the same person, and splitting them produces a half-filled
 * record that the no-show report then has to guess about.
 */

const fullFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });
const DEMO_NOW = new Date("2026-08-20T09:12:00.000Z");

export default function LederIntervjuer() {
  const session = useSession();
  // Falls back to a seeded leader so the screen is not empty for the sales
  // chief, who has no interviews of their own in the fixtures.
  const leader = session?.role === "Salgssjef" ? "Ola Nordmann" : (session?.name ?? "Ola Nordmann");
  const interviews = useInterviews(leader);

  const mine = interviews.data ?? [];
  const upcoming = mine.filter((iv) => iv.status === "booket").sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  // What the leader still owes an answer on: it has happened, and nothing was
  // recorded. This is the list OPPG-01 generates its tasks from.
  const awaiting = mine.filter((iv) => iv.status === "booket" && new Date(iv.startsAt) < DEMO_NOW);
  const done = mine.filter((iv) => iv.attended !== null).sort((a, b) => (a.startsAt > b.startsAt ? -1 : 1));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Mine intervjuer"
        description={`${upcoming.length} kommende · ${awaiting.length} venter på registrering`}
        source="Rekrutteringslogg"
        lastUpdated={new Date()}
      />

      <QueryBoundary
        query={interviews}
        skeleton={<div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Du har ingen intervjuer"
        emptyDescription="Rekrutterer booker intervjuer på deg, og de dukker opp her."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Kommende</h2>
                <ul className="flex flex-col gap-2">
                  {upcoming.map((iv) => <li key={iv.id}><OutcomeCard interview={iv} /></li>)}
                </ul>
              </section>
            )}
            {done.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Registrert</h2>
                <ul className="flex flex-col gap-2">
                  {done.map((iv) => (
                    <li key={iv.id}>
                      <Card>
                        <CardContent className="flex flex-col gap-2 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{iv.candidateName}</span>
                            <Badge className={iv.attended ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}>
                              {INTERVIEW_STATUS_LABEL[iv.status]}
                            </Badge>
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {fullFmt.format(new Date(iv.startsAt))}
                            </span>
                          </div>
                          {iv.assessment && <p className="text-sm">{iv.assessment}</p>}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function OutcomeCard({ interview: iv }: { interview: Interview }) {
  const outcome = useInterviewOutcome();
  const [open, setOpen] = React.useState(false);
  const [assessment, setAssessment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const isPast = new Date(iv.startsAt) < DEMO_NOW;

  async function submit(attended: boolean) {
    setError(null);
    if (!assessment.trim()) {
      setError(attended ? "Skriv en kort vurdering." : "Skriv hva som skjedde.");
      return;
    }
    try {
      await outcome.mutateAsync({ id: iv.id, attended, assessment: assessment.trim() });
      setOpen(false);
      setAssessment("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card className={isPast ? "border-warning/40" : undefined}>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{iv.candidateName}</span>
              {isPast && <Badge className="bg-warning/10 text-warning-on-tint">Venter på registrering</Badge>}
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {fullFmt.format(new Date(iv.startsAt))} · {iv.location} · {iv.candidatePhone}
            </p>
          </div>
          {!open && (
            <Button size="sm" variant={isPast ? "default" : "outline"} onClick={() => setOpen(true)}>
              Registrer oppmøte
            </Button>
          )}
        </div>

        {open && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`as-${iv.id}`}>Vurdering</Label>
              <Textarea id={`as-${iv.id}`} rows={3} value={assessment}
                onChange={(e) => setAssessment(e.target.value)}
                placeholder="Kort vurdering av kandidaten, eller hva som skjedde hvis de ikke møtte" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" disabled={outcome.isPending} onClick={() => submit(true)}>
                <Check className="size-4" /> Møtte
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-danger" disabled={outcome.isPending} onClick={() => submit(false)}>
                <X className="size-4" /> Møtte ikke
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setError(null); }}>Avbryt</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
