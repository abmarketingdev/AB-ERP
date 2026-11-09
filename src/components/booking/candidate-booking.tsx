"use client";

import * as React from "react";
import { CalendarPlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookInterviewDialog } from "./book-interview-dialog";
import { KommerIkkeStep, RebookDialog } from "./interview-card";
import { useInterviews } from "@/lib/api/interviews";
import { useAccess } from "@/lib/use-access";

/**
 * R2 (client 09.11): «Book intervju» straight from the candidate's card — the board card and
 * the candidate page — and «Ombook» once an interview is booked. The same dialogs as on
 * «Intervjuer», so booking rules (free slots, own-only for a sales leader) stay in one place.
 */

/** Steps an interview can be booked from (the server's booking edges into «Intervju booket»). */
export const BOOKABLE_FROM = ["ny", "kontaktet", "kvalifisert"];

export type BookingMode = "book" | "rebook";

/** Which booking action this stage offers, or null. */
export function bookingModeFor(stageId: string): BookingMode | null {
  if (BOOKABLE_FROM.includes(stageId)) return "book";
  if (stageId === "intervju-booket") return "rebook";
  return null;
}

/** A recruiter books for anyone (booking.write); a sales leader his own (booking.own). */
export function useCanBook() {
  const access = useAccess();
  return access.can("booking.write") || access.can("booking.own");
}

/** The candidate's one open booking (there is at most one: one_open_interview). */
function useBookedInterview(candidateId: string, enabled: boolean) {
  const q = useInterviews({ candidate: candidateId, status: "booket" }, { enabled });
  return { ...q, interview: q.data?.[0] };
}

export function CandidateBookingDialog({ candidateId, mode, open, onOpenChange }: {
  candidateId: string; mode: BookingMode; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  if (mode === "book") {
    return <BookInterviewDialog candidateId={candidateId} open={open} onOpenChange={onOpenChange} onBooked={() => onOpenChange(false)} />;
  }
  return <RebookForCandidate candidateId={candidateId} open={open} onOpenChange={onOpenChange} />;
}

function RebookForCandidate({ candidateId, open, onOpenChange }: {
  candidateId: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const booked = useBookedInterview(candidateId, open);
  if (open && booked.interview) {
    return <RebookDialog iv={booked.interview} open onOpenChange={onOpenChange} />;
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ombook intervju</DialogTitle>
          <DialogDescription>
            {booked.isPending ? "Henter intervjuet …"
              : booked.isError ? "Kunne ikke hente intervjuet. Prøv igjen."
              : "Fant ikke et booket intervju for kandidaten. Det kan være avlyst i mellomtiden."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

/** The button itself (candidate page header). Opens the dialog in place, no page jump. */
export function CandidateBookingButton({ candidateId, stageId, primary = true }: {
  candidateId: string; stageId: string; primary?: boolean;
}) {
  const canBook = useCanBook();
  const mode = bookingModeFor(stageId);
  const [open, setOpen] = React.useState(false);
  if (!canBook || !mode) return null;
  return (
    <>
      <Button size="sm" variant={primary ? "default" : "outline"} className="gap-1.5" onClick={() => setOpen(true)}>
        {mode === "book"
          ? <><CalendarPlus className="size-4" aria-hidden /> Book intervju</>
          : <><RotateCcw className="size-4" aria-hidden /> Ombook</>}
      </Button>
      <CandidateBookingDialog candidateId={candidateId} mode={mode} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** R6 «Kommer ikke» on the candidate page, for the candidate's booked interview. */
export function CandidateKommerIkke({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const canBook = useCanBook();
  const booked = useBookedInterview(candidateId, canBook);
  if (!canBook || !booked.interview) return null;
  return <KommerIkkeStep iv={{ id: booked.interview.id, candidateName }} />;
}
