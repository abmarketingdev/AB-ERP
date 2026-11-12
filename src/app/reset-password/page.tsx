"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Mascot, type MascotState } from "@/components/patterns/mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmPasswordReset } from "@/lib/password-reset";

type Phase = "form" | "submitting" | "success" | "invalid";

/**
 * R1 (kunden 12.11) — where the link in the «Glemt passord»-e-mail lands. Public page, no
 * session. Reads uid + token from the link, asks for the new password twice, and hands the
 * person back to /login. The password is the one shared by the whole AB system, so it also
 * works in Maps and HR afterwards. The rules (min. 8 characters, link valid 24 hours, single
 * use) are the login service's; this page only repeats its answers.
 */
function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";

  const [phase, setPhase] = React.useState<Phase>(uid && token ? "form" : "invalid");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const errorRef = React.useRef<HTMLParagraphElement>(null);
  React.useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const mascot: MascotState =
    phase === "invalid" ? "concerned" : phase === "success" ? "win-big" : phase === "submitting" ? "thinking" : "ready";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Passordet må ha minst 8 tegn."); return; }
    if (password !== confirm) { setError("Passordene er ikke like."); return; }
    setPhase("submitting");
    const result = await confirmPasswordReset(uid, token, password);
    if (result.ok) { setPhase("success"); return; }
    setPhase(result.invalidLink ? "invalid" : "form");
    if (!result.invalidLink) setError(result.error);
  }

  const primary =
    "h-11 w-full bg-[var(--ab-accent-12)] text-sm font-semibold text-[var(--ab-accent-contrast)] shadow-lg shadow-black/20 hover:bg-[var(--ab-accent-9)] disabled:opacity-50";

  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto w-full sm:w-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <Mascot state={mascot} size={32} interactive />
          <span className="text-base font-medium text-foreground">AB Rekruttering</span>
        </div>

        {phase === "invalid" && (
          <>
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-danger/15 text-danger">
              <ShieldAlert className="size-5" />
            </span>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Lenken virker ikke lenger</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Lenken for nytt passord er ugyldig eller utløpt. Den virker i 24 timer og kan bare brukes én gang. Be om en ny fra innloggingen.
            </p>
            <Button type="button" onClick={() => router.push("/login")} className={`mt-8 ${primary}`}>
              Til innlogging
              <ArrowRight className="size-4" />
            </Button>
          </>
        )}

        {phase === "success" && (
          <>
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]">
              <CheckCircle2 className="size-5" />
            </span>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Passordet er oppdatert</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Logg inn med det nye passordet. Det gjelder i hele AB-systemet.
            </p>
            <Button type="button" onClick={() => router.push("/login")} className={`mt-8 ${primary}`}>
              Logg inn
              <ArrowRight className="size-4" />
            </Button>
          </>
        )}

        {(phase === "form" || phase === "submitting") && (
          <>
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]">
              <KeyRound className="size-5" />
            </span>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">Lag et nytt passord</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Minst 8 tegn. Velg et passord du ikke bruker andre steder.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-foreground">Nytt passord</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 bg-input/40 pe-11"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Skjul passordet" : "Vis passordet"}
                    className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-foreground">Gjenta passordet</Label>
                <Input
                  id="confirm-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11 bg-input/40"
                  required
                />
              </div>

              {error && (
                <motion.p ref={errorRef} tabIndex={-1} role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-md text-sm font-medium text-danger outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {error}
                </motion.p>
              )}

              <Button type="submit" disabled={phase === "submitting" || !password || !confirm} className={primary}>
                {phase === "submitting" ? "Lagrer…" : "Lagre nytt passord"}
                {phase !== "submitting" && <ArrowRight className="size-4" />}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordInner />
    </React.Suspense>
  );
}
