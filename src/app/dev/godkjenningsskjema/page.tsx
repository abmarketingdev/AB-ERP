"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ApprovalSubmitDialog } from "@/components/patterns/approval-submit-dialog";
import { useCandidates } from "@/lib/api/recruitment";

/**
 * Review harness for the GODK-01 form (A4). In the product it opens from the kanban drop
 * on «Til godkjenning» (A2) and from the candidate page; here it opens on its own, for the
 * design review screenshots and for trying the form without dragging a card.
 */
export default function GodkjenningsskjemaDev() {
  const candidates = useCandidates();
  const candidate = (candidates.data ?? []).find((c) => c.stageId === "intervjuet");
  const [open, setOpen] = React.useState(true);
  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-lg font-medium">Godkjenningsskjema (GODK-01)</h1>
      <p className="text-sm text-muted-foreground">
        {candidate ? `Kandidat: ${candidate.name}` : "Ingen intervjuet kandidat i testdataene."}
      </p>
      <div><Button onClick={() => setOpen(true)} disabled={!candidate}>Send til godkjenning</Button></div>
      {candidate && <ApprovalSubmitDialog candidateId={candidate.id} open={open} onOpenChange={setOpen} />}
    </div>
  );
}
