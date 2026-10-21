"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CalendarX, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicInterview, useCancelPublicInterview } from "@/lib/api/interviews";
import { Mascot } from "@/components/patterns/mascot";
import { mascotFor } from "@/lib/use-mascot";
import { ConfirmStep } from "@/components/patterns/confirm-step";
import { errorMessage } from "@/lib/api/client";

/**
 * BOOK-05 / BOOK-06 / BOOK-07 — lenken i påminnelsen.
 *
 * The point of this page is that it is easier to move an interview than to not
 * turn up, because the SRS's stated goal for the whole booking module is fewer
 * no-shows. So rebooking is offered *first* and cancelling is the quieter
 * option — a page that leads with "Avbestill" gets more cancellations than one
 * that leads with "Finn et annet tidspunkt".
 *
 * Public and unauthenticated: the token is the credential. It is per booking
 * chain and unguessable, and it grants exactly one thing — moving or cancelling
 * that one interview. After a move the same link shows the new time, so an old
 * SMS never points at a stale booking. Cancelling twice is harmless (idempotent).
 */

const fullFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });

export default function PublicInterview() {
  const { token } = useParams<{ token: string }>();
  const interview = usePublicInterview(token);
  const cancel = useCancelPublicInterview(token);
  const [done, setDone] = React.useState<"avlyst" | "flyttet" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(rebookTo?: string) {
    setError(null);
    try {
      await cancel.mutateAsync({ rebookTo });
      setDone(rebookTo ? "flyttet" : "avlyst");
    } catch (err) {
      // 409 slot_taken: someone took that time a moment ago; the list refreshes with fresh alternatives.
      setError(errorMessage(err));
      interview.refetch();
    }
  }

  return (
    <div className="light min-h-screen bg-background">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10 sm:py-16">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">AB Marketing</p>
          <h1 className="text-2xl font-medium tracking-tight">Intervjuet ditt</h1>
        </header>

        {interview.isPending ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : interview.isError ? (
          <Card>
            <CardContent className="py-10 text-center">
              <span className="flex justify-center"><Mascot {...mascotFor("empty")} size={72} label="Fant ikke intervjuet" /></span>
              <p className="mt-3 text-base font-medium">Vi fant ikke dette intervjuet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lenken kan være feil eller utløpt. Svar på SMS-en du fikk fra oss, eller kontakt den som booket intervjuet.
              </p>
            </CardContent>
          </Card>
        ) : done ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              {done === "flyttet" && <Mascot {...mascotFor("approved")} size={72} label="Intervjuet er flyttet" />}
              <div>
                <p className="text-base font-medium">
                  {done === "flyttet" ? "Intervjuet er flyttet" : "Intervjuet er avbestilt"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {done === "flyttet"
                    ? `Nytt tidspunkt: ${interview.data ? fullFmt.format(new Date(interview.data.startsAt)) : ""}. Du får en SMS med det nye tidspunktet. Vi sees!`
                    : "Takk for at du sa ifra. Lederen har fått beskjed. Vil du ha en ny tid, kan du svare på SMS-en eller kontakte oss."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : interview.data && !interview.data.canChange ? (
          <Card>
            <CardContent className="flex flex-col gap-2 py-8 text-center">
              <p className="text-base font-medium">
                {{ avlyst: "Intervjuet er avbestilt", passert: "Intervjuet er passert", gjennomfort: "Intervjuet er gjennomført",
                   "no-show": "Intervjuet er passert", ombooket: "Intervjuet er flyttet", booket: "Intervjuet kan ikke endres her" }[interview.data.status]}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">{fullFmt.format(new Date(interview.data.startsAt))} · {interview.data.location}</p>
              <p className="text-sm text-muted-foreground">Trenger du hjelp, kontakt den som booket intervjuet.</p>
            </CardContent>
          </Card>
        ) : interview.data ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-2 py-5">
                <p className="text-lg tabular-nums">{fullFmt.format(new Date(interview.data.startsAt))}</p>
                <p className="text-sm text-muted-foreground">{interview.data.location}</p>
                <p className="text-sm text-muted-foreground">Du møter {interview.data.leader}</p>
              </CardContent>
            </Card>

            {/* Rebooking first — it is the outcome everybody prefers. */}
            <Card>
              <CardContent className="flex flex-col gap-3 py-5">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                  Passer det ikke? Velg et annet tidspunkt
                </h2>
                {interview.data.alternatives.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ingen ledige tider akkurat nå. Avbestill, så tar vi kontakt for en ny tid.</p>
                )}
                <ul className="flex flex-col gap-2">
                  {interview.data.alternatives.map((a) => (
                    <li key={a}>
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-start text-base tabular-nums"
                        disabled={cancel.isPending}
                        onClick={() => run(a)}
                      >
                        {fullFmt.format(new Date(a))}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-3 py-5">
                <h2 className="flex items-center gap-2 text-sm font-medium">
                  <CalendarX className="size-4 text-muted-foreground" aria-hidden />
                  Eller avbestill
                </h2>
                <ConfirmStep
                  trigger="Jeg kan ikke komme"
                  consequence="Da sletter vi tidspunktet, og lederen får beskjed. Du kan få en ny tid senere."
                  confirmLabel="Ja, avbestill"
                  tone="neutral"
                  pending={cancel.isPending}
                  onConfirm={() => run()}
                />
              </CardContent>
            </Card>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </>
        ) : null}
      </div>
    </div>
  );
}
