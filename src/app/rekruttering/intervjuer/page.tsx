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

  const all = interviews.data ?? [];
  const upcoming = all.filter((iv) => iv.status === "booket").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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

      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <h2 className="text-sm font-medium">Book nytt intervju</h2>
          <BookingForm candidateId={preselected} />
        </CardContent>
      </Card>

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
