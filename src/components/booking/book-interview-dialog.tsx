"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookingForm } from "./booking-form";
import type { Interview } from "@/types/interview";

/**
 * The booking form for one candidate, in a dialog. A2's kanban opens it when a
 * card is dropped on «Intervju booket» (the server answers that drop with
 * 409 {requires: "booking"}), so the status only changes through a real booking.
 */
export function BookInterviewDialog({ candidateId, open, onOpenChange, onBooked }: {
  candidateId: string; open: boolean; onOpenChange: (open: boolean) => void; onBooked?: (iv: Interview) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Book intervju</DialogTitle>
          <DialogDescription>Velg leder og en ledig tid. Kandidaten og lederen får SMS og kalenderinvitasjon.</DialogDescription>
        </DialogHeader>
        <BookingForm candidateId={candidateId} onBooked={onBooked} compact />
      </DialogContent>
    </Dialog>
  );
}
