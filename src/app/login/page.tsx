"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, ShieldCheck, Sparkles, Target, Users, UserSearch, KeyRound, RotateCcw, ChevronLeft } from "lucide-react";
import { Mascot } from "@/components/patterns/mascot";
import { FloatingPaths } from "@/components/patterns/floating-paths";
import { LoginTransition } from "@/components/patterns/login-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { takeReturnTo } from "@/lib/use-session-guard";
import { login, verifyTwoFactor, fetchSession, storeToken, DEMO_ACCOUNTS, type DemoAccount } from "@/lib/mock-auth";
import { MOCK_USERS } from "@/lib/mock-users";

const DEMO_PRESETS: { userKey: keyof typeof MOCK_USERS; name: string; role: string; icon: React.ElementType }[] = [
  { userKey: "promoter", name: "Kari Nordmann", role: "Promoter", icon: Target },
  { userKey: "leader", name: "Ola Nordmann", role: "Team lead", icon: Users },
  { userKey: "recruitment", name: "Fredrik Amundsen", role: "Rekrutterer", icon: UserSearch },
  { userKey: "admin", name: "Administrator", role: "Admin (2FA)", icon: ShieldCheck },
];

const HIGHLIGHTS = [
  "Ett innlogg for promotere, ledere og kunder",
  "Sanntidstall med godkjent-data-merking",
  "Ingen rollelogikk hardkodet i grensesnittet",
];

type Step = "credentials" | "twofactor";

/**
 * FR-S-01 — the ERP's own login, deliberately separate from the maps, HR and
 * quality-control logins the company already runs.
 *
 * One more password to remember is the price of not having four systems share
 * a session that none of them fully controls.
 */
export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = React.useState<Step>("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingToken, setPendingToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [transitioning, setTransitioning] = React.useState<{ label: string } | null>(null);
  const [mascotState, setMascotState] = React.useState<"greeting" | "ready" | "thinking" | "concerned">("greeting");

  function triggerError(message: string) {
    setError(message);
    setMascotState("concerned");
    setShake((s) => s + 1);
  }

  async function completeLogin(token: string) {
    storeToken(token);
    setTransitioning({ label: "Henter din side…" });
    const session = await fetchSession(token);
    if (!session) {
      setTransitioning(null);
      triggerError("Kunne ikke laste sesjonen. Prøv igjen.");
      return;
    }
    // FR-S-08 — return to where the session expired, filters and all, provided
    // the user may actually see it. A stale address for a portal this account
    // has no permission for falls back to their own front page.
    const returnTo = takeReturnTo();
    const allowed =
      returnTo && session.navigation.some((n) => returnTo.startsWith(n.href.split("?")[0]));
    const dest = (allowed ? returnTo : null) ?? session.navigation[0]?.href ?? "/";
    setTimeout(() => router.push(dest), 300);
  }

  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setMascotState("thinking");
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      triggerError(result.error);
      return;
    }
    if (result.requires2fa) {
      setPendingToken(result.pendingToken);
      setMascotState("ready");
      setStep("twofactor");
      return;
    }
    await completeLogin(result.token);
  }

  async function onSubmitTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken) return;
    setError(null);
    setSubmitting(true);
    setMascotState("thinking");
    const result = await verifyTwoFactor(pendingToken, code);
    setSubmitting(false);
    if (!result.ok) {
      triggerError(result.error);
      return;
    }
    await completeLogin(result.token);
  }

  function fillDemo(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
    setMascotState("ready");
  }

  function backToCredentials() {
    setStep("credentials");
    setCode("");
    setError(null);
    setMascotState("greeting");
  }

  return (
    <div className="relative bg-background md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      <LoginTransition active={transitioning !== null} label={transitioning?.label ?? ""} />

      {/* Left — hero panel */}
      <div className="relative hidden h-full flex-col overflow-hidden border-r border-border bg-muted/60 p-10 lg:flex">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--ab-accent-9)]/15">
            <Mascot state="idle" size={22} />
          </span>
          <span className="text-sm font-medium tracking-wide text-foreground">AB ERP</span>
        </div>

        <div className="relative z-10 mt-auto max-w-sm">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            Alt i ett, for <span className="text-[var(--ab-accent-11)]">hele laget</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Promoter, leder, rekruttering og kundeportal — samlet i én plattform bygget for AB Marketing.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {HIGHLIGHTS.map((h) => (
              <div key={h} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]">
                  <Sparkles className="size-3" />
                </span>
                {h}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="relative flex min-h-screen flex-col justify-center p-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 isolate -z-10 contain-strict opacity-60"
        >
          <div className="absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,rgba(255,255,255,0.06)_0,rgba(140,140,140,0.02)_50%,rgba(255,255,255,0.01)_80%)]" />
          <div className="absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.01)_80%,transparent_100%)]" />
        </div>

        <Button variant="ghost" className="absolute top-7 left-5 text-foreground" asChild>
          <Link href="/">
            <ChevronLeft className="me-2 size-4" />
            Hjem
          </Link>
        </Button>

        <div className="relative z-10 mx-auto mb-6 flex items-center gap-2 lg:hidden">
          <Mascot state={mascotState} size={32} interactive />
          <span className="text-base font-medium text-foreground">AB ERP</span>
        </div>

        <AnimatePresence mode="wait">
          {step === "credentials" ? (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 mx-auto w-full sm:w-sm"
            >
              <h2 className="text-2xl font-medium tracking-wide text-foreground">Logg inn</h2>
              <p className="mt-1.5 text-base text-muted-foreground">E-post og passord, separat fra Maps, HR og QC.</p>

              <form onSubmit={onSubmitCredentials} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-foreground">E-post</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="navn@abmarketing.no"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setMascotState("ready")}
                    className="h-11 bg-input/40"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-foreground">Passord</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setMascotState("ready")}
                    className="h-11 bg-input/40"
                    required
                  />
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-medium text-danger">
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full bg-[var(--ab-accent-9)] text-sm font-medium text-white shadow-lg shadow-[var(--ab-accent-9)]/25 hover:bg-[var(--ab-accent-10)] disabled:opacity-70"
                >
                  {submitting ? "Logger inn…" : "Logg inn med e-post"}
                  {!submitting && <ArrowRight className="size-4" />}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo-kontoer</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                {DEMO_PRESETS.map((preset, i) => {
                  const Icon = preset.icon;
                  const account = DEMO_ACCOUNTS.find((a) => a.userKey === preset.userKey)!;
                  return (
                    <motion.button
                      key={preset.userKey}
                      type="button"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                      whileHover={{ scale: 1.015, x: 3 }}
                      whileTap={{ scale: 0.985 }}
                      onMouseEnter={() => setMascotState("ready")}
                      onClick={() => fillDemo(account)}
                      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-left transition-colors hover:border-[var(--ab-accent-9)]/50 hover:bg-secondary"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)] transition-colors group-hover:bg-[var(--ab-accent-9)] group-hover:text-white">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{preset.name}</span>
                        <span className="block text-xs text-muted-foreground">{preset.role}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">Fyll ut</span>
                    </motion.button>
                  );
                })}
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">Velg en demo-konto for å fylle ut skjemaet, eller skriv inn selv.</p>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Er du kunde?{" "}
                <a href="/kunde/login" className="font-medium text-[var(--ab-accent-11)] hover:underline">
                  Gå til kundeportalen →
                </a>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="twofactor"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: shake ? [0, -8, 8, -6, 6, 0] : 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 mx-auto w-full sm:w-sm"
            >
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]">
                <KeyRound className="size-5" />
              </span>
              <h2 className="text-2xl font-medium tracking-tight text-foreground">Bekreft med kode</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Administratortilgang krever tofaktor. Skriv inn <span className="font-mono text-foreground">123456</span> for demoen.
              </p>

              <form onSubmit={onSubmitTwoFactor} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-foreground">6-sifret kode</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    onFocus={() => setMascotState("ready")}
                    className="h-11 bg-input/40 text-center font-mono text-lg tracking-[0.4em]"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-medium text-danger">
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="h-11 w-full bg-[var(--ab-accent-9)] text-sm font-medium text-white shadow-lg shadow-[var(--ab-accent-9)]/25 hover:bg-[var(--ab-accent-10)] disabled:opacity-50"
                >
                  {submitting ? "Bekrefter…" : "Bekreft og logg inn"}
                  {!submitting && <ArrowRight className="size-4" />}
                </Button>
                <button
                  type="button"
                  onClick={backToCredentials}
                  className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  Tilbake til pålogging
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

