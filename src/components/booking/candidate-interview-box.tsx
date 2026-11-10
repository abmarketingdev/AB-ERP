"use client";

import * as React from "react";
import { AlertTriangle, CalendarCheck, CalendarClock, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterviews, useSetReminder } from "@/lib/api/interviews";
import { CancelStep, KommerIkkeStep, MessageList, RebookDialog, STATUS_TONE } from "./interview-card";
import { CandidateBookingButton, bookingModeFor, useCanBook } from "./candidate-booking";
import { CALENDAR_STATE_LABEL, INTERVIEW_STATUS_LABEL, type CalendarState, type Interview } from "@/types/interview";

/**
 * C2 (client 10.11): the candidate's interview on the card itself — the box on the right,
 * which until now only said «Onboarding-sjekkliste vises når kandidaten er ansatt». When,
 * where, with whom, status, reminder, calendar, and the same actions as «Intervjuer»
 * (Ombook · Avlys · Kommer ikke), built from the same components so the rules stay in one
 * place. No interview: say so, with «Book intervju» for those who may.
 */

const OSLO = "Europe/Oslo";
const fullFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, day: "2-digit", month: "2-digit", year: "numeric" });
const CAL_TONE: Record<CalendarState, string> = {
  venter: "text-warning-on-tint", synket: "text-success", feilet: "text-danger", avlyst: "text-muted-foreground",
};

/** The interview to show: the open booking, else the most recent one. */
function pick(rows: Interview[]): Interview | undefined {
  const open = rows.filter((iv) => iv.status === "booket").sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  if (open[0]) return open[0];
  // A rebooked row is history of the booking that replaced it.
  return rows.filter((iv) => iv.status !== "ombooket").sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
}

export function CandidateInterviewBox({ candidateId, stageId, readOnly = false }: { candidateId: string; stageId: string; readOnly?: boolean }) {
  const interviews = useInterviews({ candidate: candidateId });
  // C4: a follower sees the interview but has no buttons.
  const canBook = useCanBook() && !readOnly;
  const setReminder = useSetReminder();
  const [rebookOpen, setRebookOpen] = React.useState(false);
  const [now] = React.useState(() => Date.now());

  const rows = interviews.data ?? [];
  const iv = pick(rows);
  const earlier = rows.filter((r) => r.id !== iv?.id && r.status !== "ombooket")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const mayBook = canBook && bookingModeFor(stageId) === "book";

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3 py-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Intervju
          </p>
          {iv && <Badge className={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABEL[iv.status]}</Badge>}
        </div>

        {interviews.isPending && interviews.fetchStatus !== "idle" ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : interviews.isError ? (
          <p role="alert" className="text-sm text-danger">Kunne ikke hente intervjuet. Last siden på nytt.</p>
        ) : !iv ? (
          <div className="flex flex-1 flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Ingen intervju booket ennå.</p>
            {mayBook ? (
              <CandidateBookingButton candidateId={candidateId} stageId={stageId} />
            ) : (
              <p className="text-xs text-muted-foreground">
                {canBook ? "Kan bookes fra «Ny», «Kontaktet» eller «Kvalifisert»." : "Intervjuer bookes av rekrutterer."}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium tabular-nums">{fullFmt.format(new Date(iv.startsAt))}</p>
              <p className="text-muted-foreground">{iv.location}</p>
              <p className="text-xs text-muted-foreground">
                Leder {iv.leader.name} · booket av {iv.bookedBy}
                {iv.cancelledBy && <> · avlyst av {iv.cancelledBy === "kandidat" ? "kandidaten via lenken" : iv.cancelledBy}</>}
              </p>
              {iv.status !== "ombooket" && (
                <p className={`flex items-center gap-1 text-xs ${CAL_TONE[iv.calendarState]}`}>
                  {iv.calendarState === "feilet" ? <AlertTriangle className="size-3" aria-hidden /> : <CalendarCheck className="size-3" aria-hidden />}
                  {CALENDAR_STATE_LABEL[iv.calendarState]}
                </p>
              )}
            </div>

            {iv.attended !== null && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p>
                  <span className="font-medium">{iv.attended ? "Møtte" : "Møtte ikke"}.</span>
                  {iv.rating ? <span className="ml-1 text-muted-foreground">Vurdering {iv.rating}/5.</span> : null}
                  {iv.recommend !== null ? <span className="ml-1 text-muted-foreground">{iv.recommend ? "Anbefales videre." : "Anbefales ikke videre."}</span> : null}
                </p>
                {iv.assessment && <p className="mt-1 whitespace-pre-wrap">{iv.assessment}</p>}
              </div>
            )}

            {iv.status === "booket" && (
              <>
                {new Date(iv.startsAt).getTime() <= now && iv.attended === null && (
                  <p className="text-xs text-muted-foreground">Tiden har vært: lederen registrerer oppmøte under «Mine intervjuer».</p>
                )}
                {canBook && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRebookOpen(true)}>
                      <RotateCcw className="size-3.5" /> Ombook
                    </Button>
                    <CancelStep iv={iv} />
                    <KommerIkkeStep iv={iv} size="sm" />
                  </div>
                )}
                <label className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={iv.reminderEnabled} disabled={!canBook || setReminder.isPending}
                    onCheckedChange={(v) => setReminder.mutate({ id: iv.id, reminderEnabled: v })} aria-label="Påminnelse dagen før" />
                  Påminnelse dagen før{iv.reminderSentAt ? " (sendt)" : ""}
                </label>
              </>
            )}
            {iv.status !== "booket" && mayBook && <CandidateBookingButton candidateId={candidateId} stageId={stageId} />}

            <MessageList iv={iv} />

            {earlier.length > 0 && (
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                <p className="mb-1 font-medium">Tidligere</p>
                <ul className="flex flex-col gap-0.5">
                  {earlier.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="tabular-nums">{shortFmt.format(new Date(r.startsAt))} · {r.leader.name}</span>
                      <span>{INTERVIEW_STATUS_LABEL[r.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <RebookDialog iv={iv} open={rebookOpen} onOpenChange={setRebookOpen} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
