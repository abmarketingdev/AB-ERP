"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { BookingForm } from "@/components/booking/booking-form";
import { InterviewCard, InterviewRow } from "@/components/booking/interview-card";
import { useInterviews } from "@/lib/api/interviews";
import { useAccess } from "@/lib/use-access";
import Link from "next/link";
import type { Interview } from "@/types/interview";

/**
 * BOOK-01 … BOOK-07 — bookingskjermen.
 *
 * The SRS's stated goal is fewer no-shows (l.270), which makes the messages part
 * of the feature rather than plumbing: BOOK-03 says what the SMS must contain,
 * and BOOK-05 says the reminder carries a cancellation link. So every message is
 * shown in full on the booking, with whether it was delivered — not summarised
 * as "SMS sendt".
 *
 * `?kandidat=<id>` preselects a candidate: the kanban links here when a card is
 * dropped on «Intervju booket» (agreed with A2).
 */
function IntervjuerPage() {
  const params = useSearchParams();
  const preselected = params.get("kandidat") ?? undefined;
  const interviews = useInterviews();
  // Leaders reach this page through interviews_own.read but cannot book (booking.write);
  // showing them the form only produced «Kunne ikke hente lederne».
  const access = useAccess();
  const canBook = access.can("booking.write");

  const all = interviews.data ?? [];
  const [now] = React.useState(() => Date.now());
  const isPast = (iv: Interview) => new Date(iv.startsAt).getTime() <= now;
  const upcoming = all.filter((iv) => iv.status === "booket" && !isPast(iv)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // Happened, but the leader has not recorded the outcome yet (BOOK-08) — not «kommende».
  const awaiting = all.filter((iv) => iv.status === "booket" && isPast(iv)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // A rebooked row is history of the booking that replaced it; showing it as its own
  // card would list the same interview twice.
  const past = all.filter((iv) => iv.status !== "booket" && iv.status !== "ombooket")
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Intervjuer"
        description={`${upcoming.length} kommende intervjuer`}
        source="Lederkalender, SMS og e-post"
        lastUpdated={interviews.dataUpdatedAt ? new Date(interviews.dataUpdatedAt) : undefined}
      />

      {canBook ? (
        <Card>
          <CardContent className="flex flex-col gap-5 py-5">
            <h2 className="text-sm font-medium">Book nytt intervju</h2>
            <BookingForm candidateId={preselected} />
          </CardContent>
        </Card>
      ) : access.isSuccess ? (
        <p className="text-sm text-muted-foreground">
          Intervjuer bookes av rekrutterer. Registrer oppmøte etter intervjuet under{" "}
          <Link href="/leder/intervjuer" className="font-medium text-foreground underline underline-offset-4">Mine intervjuer</Link>.
        </p>
      ) : null}

      <QueryBoundary
        query={interviews}
        skeleton={<Skeleton className="h-48 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen intervjuer ennå"
        emptyDescription="Book det første intervjuet over. Kandidat og leder får SMS og kalenderinvitasjon."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            {awaiting.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Venter på oppmøte fra leder</h2>
                <Card className="border-warning/40"><ul className="divide-y divide-border">{awaiting.map((iv) => <InterviewRow key={iv.id} interview={iv} />)}</ul></Card>
              </section>
            )}
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Kommende</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen kommende intervjuer.</p>
              ) : (
                <Card><ul className="divide-y divide-border">{upcoming.map((iv) => <InterviewRow key={iv.id} interview={iv} />)}</ul></Card>
              )}
            </section>
            <Section title="Tidligere" items={past} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Section({ title, items, empty }: { title: string; items: Interview[]; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((iv) => <li key={iv.id}><InterviewCard interview={iv} /></li>)}
        </ul>
      )}
    </section>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Intervjuer() {
  return (
    <PermissionGate permission="interviews.view">
      <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
        <IntervjuerPage />
      </React.Suspense>
    </PermissionGate>
  );
}
