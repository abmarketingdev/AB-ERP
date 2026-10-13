"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { ArrowRight, KeyRound, RotateCcw } from "lucide-react";
import { Mascot } from "@/components/patterns/mascot";
import { LoginTransition } from "@/components/patterns/login-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customerLogin, customerVerify2fa, fetchCustomerSession, storeCustomerToken, CUSTOMER_DEMO_ACCOUNTS } from "@/lib/customer-session";

type Step = "credentials" | "twofactor";

/**
 * FR-C-01 — the customer's own login, with two factors, and never conditional
 * on whether they have paid. Access to your own results is not leverage.
 *
 * Separate from the staff login at every level the demo can manage: its own
 * route, its own credential store, its own token key. In a real deployment it
 * would be a separate host.
 */
export default function CustomerLoginPage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  const [step, setStep] = React.useState<Step>("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingToken, setPendingToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [transitioning, setTransitioning] = React.useState<{ label: string } | null>(null);
  /*
   * The staff login has had a reactive mascot since it was built; this one was
   * hardcoded to `idle` through the whole flow, so a customer got no
   * acknowledgement of a wrong password and no sign the 2FA step was working.
   * "It's a report, not an experience" governs the *report*, not the door.
   */
  const [mascotState, setMascotState] = React.useState<
    "greeting" | "ready" | "thinking" | "concerned"
  >("greeting");

  function triggerError(message: string) {
    setError(message);
    setMascotState("concerned");
    setShake((s) => s + 1);
  }

  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setMascotState("thinking");
    const result = await customerLogin(email, password);
    setSubmitting(false);
    if (!result.ok) {
      triggerError(result.error);
      return;
    }
    setPendingToken(result.pendingToken);
    setMascotState("ready");
    setStep("twofactor");
  }

  async function onSubmitTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setError(null);
    setSubmitting(true);
    setMascotState("thinking");
    const result = await customerVerify2fa(pendingToken, code);
    setSubmitting(false);
    if (!result.ok) {
      triggerError(result.error);
      return;
    }
    storeCustomerToken(result.token);
    setTransitioning({ label: "Henter din kampanjerapport…" });
    const account = await fetchCustomerSession(result.token);
    if (!account) {
      setTransitioning(null);
      triggerError("Kunne ikke laste kontoen. Prøv igjen.");
      return;
    }
    setTimeout(() => router.push("/kunde/rapport"), 300);
  }

  function fillDemo() {
    setEmail(CUSTOMER_DEMO_ACCOUNTS[0].email);
    setPassword(CUSTOMER_DEMO_ACCOUNTS[0].password);
    setError(null);
    setMascotState("ready");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-10">
      <LoginTransition active={transitioning !== null} label={transitioning?.label ?? ""} />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px 360px at 20% -10%, color-mix(in oklab, var(--ab-accent-9) 10%, transparent), transparent 65%), radial-gradient(700px 420px at 100% 100%, color-mix(in oklab, var(--ab-accent-11) 6%, transparent), transparent 70%)",
        }}
        animate={reduced ? undefined : { opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Mascot state={mascotState} size={72} />
          <div>
            <h1 className="text-lg font-medium text-foreground">AB Marketing — Kundeportal</h1>
            <p className="text-sm text-muted-foreground">Rapporter for din organisasjon</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "credentials" ? (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full rounded-2xl border border-border bg-card p-8 shadow-lg"
            >
              <h2 className="text-xl font-medium text-foreground">Logg inn</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tofaktorautentisering er påkrevd for alle kundekontoer.</p>

              <form onSubmit={onSubmitCredentials} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-email">E-post</Label>
                  <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setMascotState("ready")} className="h-11" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-password">Passord</Label>
                  <Input id="c-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onFocus={() => setMascotState("ready")} className="h-11" required />
                </div>
                {error && <p className="text-xs font-medium text-danger">{error}</p>}
                <Button type="submit" disabled={submitting} className="h-11 w-full text-sm font-medium">
                  {submitting ? "Logger inn…" : "Fortsett"}
                  {!submitting && <ArrowRight className="size-4" />}
                </Button>
              </form>

              <button type="button" onClick={fillDemo} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Fyll ut demo-konto (Røde Kors)
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="twofactor"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full rounded-2xl border border-border bg-card p-8 shadow-lg"
            >
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <KeyRound className="size-5" />
              </span>
              <h2 className="text-xl font-medium text-foreground">Bekreft med kode</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Skriv inn <span className="font-mono text-foreground">246810</span> for demoen.
              </p>
              <form onSubmit={onSubmitTwoFactor} className="mt-6 space-y-4">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="h-11 text-center font-mono text-lg tracking-[0.4em]"
                  autoFocus
                  required
                />
                {error && <p className="text-xs font-medium text-danger">{error}</p>}
                <Button type="submit" disabled={submitting || code.length !== 6} className="h-11 w-full text-sm font-medium">
                  {submitting ? "Bekrefter…" : "Bekreft og logg inn"}
                  {!submitting && <ArrowRight className="size-4" />}
                </Button>
                <button type="button" onClick={() => {
                  setStep("credentials");
                  setMascotState("greeting");
                }} className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <RotateCcw className="size-3" /> Tilbake
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
