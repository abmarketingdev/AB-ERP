"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdvanceStage, useCandidateReasons, useRejectionPreview } from "@/lib/api/recruitment";
import { ApiError, errorMessage } from "@/lib/api/client";
import { TERMINAL_STAGE_IDS } from "@/lib/recruitment";
import { moveRefusalSchema, type Candidate, type RecruitmentStage } from "@/types/recruitment";

/**
 * FR-R-02 / KAND-05 / KAND-07 — the form a stage change goes through.
 *
 * The move is not committed until this is submitted, which is what makes drag
 * safe on the board: the drop is a navigation, the submit is the record. The
 * entry it writes is appended to the candidate's history, never overwritten.
 *
 * KAND-07: when the target stage ends the process, the reason comes from a list
 * rather than free text, because DASH-04 reports on rejection reasons and free
 * text cannot be counted. The list is the server's (codes + labels). A rejection
 * can also send the automatic «avslag» — previewed word for word before it goes.
 *
 * Free text typed here is stored as a note on the candidate, never in the status
 * log, which outlives the 3-year anonymisation (IFK-01).
 */
export function AdvanceStageDialog(props: {
  candidate: Candidate | null;
  stage: RecruitmentStage | null;
  onClose: () => void;
}) {
  // A fresh form per opening — stale answers from the previous card would be filed
  // against this one. Keyed remount instead of resetting state in an effect.
  return <AdvanceStageSheet key={`${props.candidate?.id}-${props.stage?.id}`} {...props} />;
}

function AdvanceStageSheet({
  candidate, stage, onClose,
}: {
  candidate: Candidate | null;
  stage: RecruitmentStage | null;
  onClose: () => void;
}) {
  const advance = useAdvanceStage();
  const reasons = useCandidateReasons();
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [sendRejection, setSendRejection] = React.useState(false);


  const isRejection = stage?.id === "avvist" || stage?.id === "trukket";
  const reopening = Boolean(candidate && TERMINAL_STAGE_IDS.includes(candidate.stageId) && stage?.id === "kvalifisert");
  const options = stage?.id === "avvist" ? reasons.data?.rejection : reasons.data?.withdraw;
  const preview = useRejectionPreview(candidate?.id ?? "", stage?.id === "avvist" && sendRejection ? fields.arsak ?? null : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate || !stage) return;
    setError(null);
    try {
      await advance.mutateAsync({
        candidateId: candidate.id, toStageId: stage.id, fields,
        reasonCode: isRejection ? fields.arsak : reopening ? "gjenapnet" : undefined,
        sendRejection: stage.id === "avvist" && sendRejection,
      });
      onClose();
    } catch (err) {
      // A 409 carries the server's reason (and which form to use instead).
      const refusal = err instanceof ApiError && err.status === 409 ? moveRefusalSchema.safeParse(err.body) : null;
      setError(refusal?.success ? refusal.data.message : errorMessage(err));
    }
  }

  const formId = "advance-stage-form";
  return (
    <ResponsiveSheet
      open={Boolean(candidate && stage)}
      onOpenChange={(open) => !open && onClose()}
      title={candidate && stage ? `${candidate.name} → ${stage.label}` : ""}
      description="Registrer det dette steget krever. Oppføringen legges til i historikken — den erstatter ingenting."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button type="submit" form={formId} className="gap-1.5"
            disabled={advance.isPending || (isRejection && !fields.arsak)}>
            {advance.isPending ? "Lagrer…" : <>Flytt til {stage?.label} <ArrowRight className="size-4" aria-hidden /></>}
          </Button>
        </>
      }
    >
        <form id={formId} onSubmit={submit}>
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
                    {(options ?? []).map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Årsaken velges fra listen fordi den telles opp i kanalkvalitet-rapporten.
                </p>
              </div>
            )}

            {stage?.id === "avvist" && (
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox className="mt-0.5" checked={sendRejection} onCheckedChange={(v) => setSendRejection(Boolean(v))} />
                  <span>Send automatisk avslag til kandidaten</span>
                </label>
                {sendRejection && fields.arsak && (
                  <div className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground" aria-live="polite">
                    {preview.isLoading ? "Henter forhåndsvisning…" : preview.data?.channel ? (
                      <>
                        <p className="mb-1 font-medium text-foreground">
                          Sendes som {preview.data.channel === "email" ? "e-post" : "SMS"}
                          {preview.data.subject ? `: ${preview.data.subject}` : ""}
                        </p>
                        <p className="whitespace-pre-line">{preview.data.body}</p>
                      </>
                    ) : "Kandidaten har verken e-post eller telefon — ingenting sendes."}
                  </div>
                )}
              </div>
            )}

            {reopening && (
              <p className="text-xs text-muted-foreground">
                Kandidaten gjenåpnes og legges i «Kvalifisert». Det logges at du gjenåpnet.
              </p>
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

        </form>
    </ResponsiveSheet>
  );
}
