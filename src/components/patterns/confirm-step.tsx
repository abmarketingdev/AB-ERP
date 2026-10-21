"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The confirmation built into the page for destructive or irreversible actions
 * (08-DESIGN-REVIEW: «`confirm()` is not used»). It replaces the action's button in
 * place, says exactly what will happen, and — for actions that cannot be undone —
 * asks the user to type a word, so the second click is a decision, not a reflex.
 *
 *     <ConfirmStep
 *       trigger="Slett personopplysninger"
 *       consequence="Navn, telefon, e-post, notater og vedlegg slettes i alle deler av systemet. Kan ikke angres."
 *       confirmLabel="Slett for godt"
 *       typeToConfirm="SLETT"
 *       pending={mutation.isPending}
 *       onConfirm={() => mutation.mutate()}
 *     />
 *
 * Escape and «Avbryt» close it and return focus to the trigger.
 */
export function ConfirmStep({
  trigger,
  consequence,
  confirmLabel,
  typeToConfirm,
  pending = false,
  onConfirm,
  tone = "danger",
}: {
  trigger: string;
  consequence: string;
  confirmLabel: string;
  typeToConfirm?: string;
  pending?: boolean;
  onConfirm: () => void;
  tone?: "danger" | "neutral";
}) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputId = React.useId();
  const ready = !typeToConfirm || typed.trim().toUpperCase() === typeToConfirm.toUpperCase();

  function close() {
    setOpen(false);
    setTyped("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (!open) {
    return (
      <Button
        ref={triggerRef}
        variant={tone === "danger" ? "outline" : "secondary"}
        className={tone === "danger" ? "border-danger/40 text-danger hover:bg-danger/10" : undefined}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-label={trigger}
      onKeyDown={(e) => e.key === "Escape" && !pending && close()}
      className={`space-y-3 rounded-lg border p-3 ${tone === "danger" ? "border-danger/40 bg-danger/5" : "border-border bg-muted/40"}`}
    >
      <p className="flex gap-2 text-sm text-foreground">
        <TriangleAlert className={`mt-0.5 size-4 shrink-0 ${tone === "danger" ? "text-danger" : "text-muted-foreground"}`} aria-hidden />
        <span>{consequence}</span>
      </p>
      {typeToConfirm && (
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>Skriv {typeToConfirm} for å bekrefte</Label>
          <Input
            id={inputId}
            autoFocus
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="h-11 max-w-xs"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          autoFocus={!typeToConfirm}
          disabled={!ready || pending}
          onClick={onConfirm}
          className={`min-h-11 ${tone === "danger" ? "bg-danger text-white hover:bg-danger/90" : ""}`}
        >
          {pending ? "Arbeider…" : confirmLabel}
        </Button>
        <Button variant="ghost" className="min-h-11" disabled={pending} onClick={close}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}
