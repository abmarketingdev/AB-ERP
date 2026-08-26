"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { permittedBand } from "@/lib/goal";
import type { GoalLimit } from "@/types/leader";

/**
 * FR-L-13 — the one place a goal is edited, at either level.
 *
 * A sales chief moving a team target and a team lead moving a person's target
 * are the same operation with different units, so they are the same component.
 * The rule it enforces is learned once and behaves identically in both places:
 *
 *  - the permitted band is printed before the field can be got wrong
 *  - the band is measured from the period baseline, never the current target
 *  - a reason is mandatory, and the endpoint enforces both again
 *
 * Mounted with a key derived from the saved target, so the draft resets by
 * remounting rather than by an effect writing state during render.
 */
export function GoalEditor({
  id,
  name,
  target,
  baseline,
  unit,
  limit,
  pending,
  reasonHint,
  preview,
  onCancel,
  onSave,
}: {
  id: string;
  name: string;
  target: number;
  baseline: number;
  unit: string;
  limit: GoalLimit;
  pending: boolean;
  /** Who will read the reason — named, because that changes how it gets written. */
  reasonHint: string;
  /** What the new number would mean, in the subject's own terms. */
  preview: (next: number) => React.ReactNode;
  onCancel: () => void;
  onSave: (target: number, reason: string) => void;
}) {
  const band = permittedBand(baseline, limit);
  const [draft, setDraft] = React.useState(String(target));
  const [reason, setReason] = React.useState("");

  const parsed = Number(draft);
  const valid =
    draft.trim() !== "" && Number.isFinite(parsed) && parsed >= band.min && parsed <= band.max;
  const changed = Math.round(parsed) !== target;

  return (
    <div className="flex flex-col gap-3.5 border-t border-border px-5 py-4">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <label htmlFor={`target-${id}`} className="block text-[12px] text-muted-foreground">
            Nytt mål for {name}
          </label>
          <Input
            id={`target-${id}`}
            type="number"
            inputMode="numeric"
            min={band.min}
            max={band.max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-describedby={`band-${id}`}
            aria-invalid={!valid}
            className="mt-1.5 w-32 font-mono tabular-nums"
            autoFocus
          />
        </div>

        {/* The rule, stated before it can be broken. */}
        <p id={`band-${id}`} className="pb-2.5 text-[12.5px] text-muted-foreground">
          Tillatt: <span className="font-mono tabular-nums text-foreground">{band.min}</span>–
          <span className="font-mono tabular-nums text-foreground">{band.max}</span> {unit} (±{" "}
          {limit.maxChangePct} % fra utgangspunktet {formatNumber(baseline)})
        </p>
      </div>

      {!valid && draft.trim() !== "" && (
        <p className="text-[12.5px] text-danger" role="alert">
          {parsed > band.max
            ? `${Math.round(parsed)} er over rammen. Større økning må avtales med ${limit.owner}.`
            : `${Math.round(parsed)} er under rammen. Større reduksjon må avtales med ${limit.owner}.`}
        </p>
      )}

      {valid && changed && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          {preview(Math.round(parsed))}
        </div>
      )}

      <div>
        <label htmlFor={`reason-${id}`} className="block text-[12px] text-muted-foreground">
          Begrunnelse (påkrevd — {reasonHint})
        </label>
        <Textarea
          id={`reason-${id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Hvorfor endres målet?"
          className="mt-1.5 min-h-16 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!valid || !changed || !reason.trim() || pending}
          onClick={() => onSave(Math.round(parsed), reason.trim())}
        >
          {pending ? "Lagrer…" : "Lagre mål"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
