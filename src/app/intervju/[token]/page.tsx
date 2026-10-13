"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Check, CalendarX, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicInterview, useCancelPublicInterview } from "@/lib/api/srs";
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
 * and unguessable, and it grants exactly one thing — moving or cancelling that
 * one interview.
 */

const fullFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });

export default function PublicInterview() {
  const { token } = useParams<{ token: string }>();
  const interview = usePublicInterview(token);
  const cancel = useCancelPublicInterview(token);
  const [done, setDone] = React.useState<"avlyst" | "flyttet" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  async function run(rebookTo?: string) {
    setError(null);
    try {
      await cancel.mutateAsync({ rebookTo });
      setDone(rebookTo ? "flyttet" : "avlyst");
    } catch (err) {
      setError(errorMessage(err));
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
              <p className="text-base font-medium">Vi fant ikke dette intervjuet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Lenken kan være utløpt. Ring oss på 23 96 00 00, så hjelper vi deg.
              </p>
            </CardContent>
          </Card>
        ) : done ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="size-6" aria-hidden />
              </span>
              <div>
                <p className="text-base font-medium">
                  {done === "flyttet" ? "Intervjuet er flyttet" : "Intervjuet er avbestilt"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {done === "flyttet"
                    ? "Du får en SMS med det nye tidspunktet. Vi sees!"
                    : "Vi har gitt beskjed til lederen din kontaktperson. Vil du avtale en ny tid, ring oss på 23 96 00 00."}
                </p>
              </div>
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
                {confirming ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Er du sikker? Da sletter vi tidspunktet, og lederen får beskjed.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-11 text-danger" disabled={cancel.isPending} onClick={() => run()}>
                        Ja, avbestill
                      </Button>
                      <Button variant="ghost" className="h-11" onClick={() => setConfirming(false)}>
                        Nei, behold
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="h-11 w-fit text-muted-foreground" onClick={() => setConfirming(true)}>
                    Jeg kan ikke komme
                  </Button>
                )}
              </CardContent>
            </Card>

            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        ) : null}
      </div>
    </div>
  );
}
