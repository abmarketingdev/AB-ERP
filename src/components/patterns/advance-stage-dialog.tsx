"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdvanceStage } from "@/lib/api/recruitment";
import { errorMessage } from "@/lib/api/client";
import { REJECTION_REASONS } from "@/lib/mock-data";
import { TERMINAL_STAGE_IDS } from "@/lib/recruitment";
import type { Candidate, RecruitmentStage } from "@/types/recruitment";

/**
 * FR-R-02 / KAND-05 / KAND-07 — the form a stage change goes through.
 *
 * The move is not committed until this is submitted, which is what makes drag
 * safe on the board: the drop is a navigation, the submit is the record. The
 * entry it writes is appended to the candidate's history, never overwritten.
 *
 * KAND-07: when the target stage ends the process, the reason comes from a list
 * rather than free text, because DASH-04 reports on rejection reasons and free
 * text cannot be counted.
 */
export function AdvanceStageDialog({
  candidate, stage, onClose,
}: {
  candidate: Candidate | null;
  stage: RecruitmentStage | null;
  onClose: () => void;
}) {
  const advance = useAdvanceStage();
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  // A fresh form per opening — stale answers from the previous card would be
  // filed against this one.
  React.useEffect(() => {
    setFields({});
    setError(null);
  }, [candidate?.id, stage?.id]);

  const isRejection = stage ? TERMINAL_STAGE_IDS.includes(stage.id) : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate || !stage) return;
    setError(null);
    try {
      await advance.mutateAsync({ candidateId: candidate.id, toStageId: stage.id, fields });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog open={Boolean(candidate && stage)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {candidate?.name}
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              {stage?.label}
            </DialogTitle>
            <DialogDescription>
              Registrer det dette steget krever. Oppføringen legges til i historikken — den
              erstatter ingenting.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {isRejection && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adv-reason">Årsak</Label>
                <Select
                  value={fields.arsak ?? ""}
                  onValueChange={(v) => setFields((f) => ({ ...f, arsak: v }))}
                >
                  <SelectTrigger id="adv-reason"><SelectValue placeholder="Velg årsak" /></SelectTrigger>
                  <SelectContent>
                    {REJECTION_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Årsaken velges fra listen fordi den telles opp i kanalkvalitet-rapporten.
                </p>
              </div>
            )}

            {stage?.fields
              .filter((f) => !(isRejection && f.id === "arsak"))
              .map((f) => (
                <div key={f.id} className="flex flex-col gap-1.5">
                  <Label htmlFor={`adv-${f.id}`}>{f.label}</Label>
                  {f.id.includes("notat") || f.id.includes("vurdering") ? (
                    <Textarea
                      id={`adv-${f.id}`}
                      rows={3}
                      value={fields[f.id] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setFields((s) => ({ ...s, [f.id]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`adv-${f.id}`}
                      value={fields[f.id] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => setFields((s) => ({ ...s, [f.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

            {error && <p className="text-sm text-danger">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Avbryt</Button>
            <Button type="submit" disabled={advance.isPending || (isRejection && !fields.arsak)}>
              {advance.isPending ? "Lagrer…" : `Flytt til ${stage?.label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
