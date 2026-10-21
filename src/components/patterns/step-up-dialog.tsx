"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mascot } from "@/components/patterns/mascot";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { FormErrorSummary } from "@/components/patterns/form-error-summary";
import { useAccess } from "@/lib/use-access";
import { mascotFor } from "@/lib/use-mascot";
import { enrollConfirm, enrollStart, stepUpLogin, stepUpVerify } from "@/lib/step-up-api";

type Step =
  | { name: "password" }
  | { name: "otp"; preAuthToken: string }
  | { name: "enroll"; enrollToken: string; qr: string; secret: string }
  | { name: "backup"; token: string; codes: string[] };

/**
 * «Bekreft med tofaktor» (IFK-04). One flow, three paths: password → code; password →
 * first-time setup (QR + code → backup codes, shown once); or a clear refusal. Opened by
 * StepUpProvider when the server answers 403 step_up_required; resolves with the verified
 * token, or null if the user cancels.
 */
export function StepUpDialog({ onDone }: { onDone: (token: string | null) => void }) {
  const { access } = useAccess();
  const [step, setStep] = React.useState<Step>({ name: "password" });
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const username = access?.username ?? "";

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return setError("Skriv inn passordet ditt.");
    setBusy(true);
    setError(null);
    const r = await stepUpLogin(username, password);
    if (r.kind === "otp") setStep({ name: "otp", preAuthToken: r.preAuthToken });
    else if (r.kind === "enroll") {
      const s = await enrollStart(r.enrollToken);
      if ("error" in s) setError(s.error);
      else setStep({ name: "enroll", enrollToken: r.enrollToken, qr: s.qr, secret: s.secret });
    } else setError(r.message);
    setPassword("");
    setBusy(false);
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError("Skriv inn koden fra autentiseringsappen.");
    setBusy(true);
    setError(null);
    if (step.name === "otp") {
      const r = await stepUpVerify(step.preAuthToken, code);
      if ("token" in r) onDone(r.token);
      else setError(r.error);
    } else if (step.name === "enroll") {
      const r = await enrollConfirm(step.enrollToken, code);
      if ("token" in r) setStep({ name: "backup", token: r.token, codes: r.backupCodes });
      else setError(r.error);
    }
    setCode("");
    setBusy(false);
  }

  const titles: Record<Step["name"], string> = {
    password: "Bekreft med tofaktor",
    otp: "Skriv inn engangskoden",
    enroll: "Sett opp tofaktor",
    backup: "Ta vare på reservekodene",
  };
  const descriptions: Record<Step["name"], string> = {
    password: "Denne handlingen krever ekstra bekreftelse. Skriv inn passordet ditt først.",
    otp: "Åpne autentiseringsappen og skriv inn den sekssifrede koden.",
    enroll: "Første gang: skann koden med en autentiseringsapp (for eksempel Microsoft Authenticator), og skriv inn koden appen viser.",
    backup: "Hver kode kan brukes én gang hvis du mister telefonen. De vises bare nå.",
  };

  const footer =
    step.name === "backup" ? (
      <Button className="min-h-11 w-full sm:w-auto" onClick={() => onDone(step.token)}>
        Jeg har lagret kodene
      </Button>
    ) : (
      <>
        <Button variant="ghost" className="min-h-11" onClick={() => onDone(null)} disabled={busy}>
          Avbryt
        </Button>
        <Button
          type="submit"
          form="step-up-form"
          className="min-h-11"
          disabled={busy}
        >
          {busy ? "Bekrefter…" : step.name === "password" ? "Fortsett" : "Bekreft"}
        </Button>
      </>
    );

  return (
    <ResponsiveSheet
      open
      onOpenChange={(open) => !open && !busy && onDone(null)}
      title={titles[step.name]}
      description={descriptions[step.name]}
      footer={footer}
    >
      <div className="space-y-4">
        {error && <FormErrorSummary title="Bekreftelsen gikk ikke" errors={[{ field: "step-up-input", message: error }]} />}

        {step.name === "password" && (
          <form id="step-up-form" onSubmit={submitPassword} className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden /> Innlogget som <span className="font-medium text-foreground">{username}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="step-up-input">Passord</Label>
              <Input id="step-up-input" type="password" autoComplete="current-password" autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </div>
          </form>
        )}

        {(step.name === "otp" || step.name === "enroll") && (
          <form id="step-up-form" onSubmit={submitCode} className="space-y-3">
            {step.name === "enroll" && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL from Auth, not an asset */}
                <img src={step.qr} alt="QR-kode for autentiseringsappen" width={184} height={184} />
                <p className="text-center text-xs text-neutral-700">
                  Kan du ikke skanne? Skriv inn nøkkelen: <span className="font-mono break-all">{step.secret}</span>
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="step-up-input">Sekssifret kode</Label>
              <Input id="step-up-input" inputMode="numeric" autoComplete="one-time-code" autoFocus
                maxLength={12} value={code} onChange={(e) => setCode(e.target.value)}
                className="h-11 max-w-[12rem] font-mono tracking-[0.3em]" />
              {step.name === "otp" && (
                <p className="text-xs text-muted-foreground">Mistet telefonen? Skriv inn en av reservekodene dine.</p>
              )}
            </div>
          </form>
        )}

        {step.name === "backup" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <Mascot {...mascotFor("approved")} size={56} />
            </div>
            <ul className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-sm">
              {step.codes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
