"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import qrcode from "qrcode-generator";
import { ArrowRight, Copy, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, KundeAuthFrame, type MascotMood } from "./auth-frame";
import { KundeError, kundeFetch, readKundeToken, storeKundeToken } from "@/lib/kundeportal/api";

type Step = "credentials" | "enrol" | "backup" | "twofactor" | "forgot" | "forgot-sent";

/**
 * Kundens innlogging (FR-C-01): e-post + passord, deretter ALLTID en kode fra en
 * autentiseringsapp. Første gang settes appen opp her (QR-kode). Serveren håndhever det:
 * passordsteget gir bare et kortlivet pre-token som ikke kan lese rapporten.
 */
export function KundeLogin() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [useBackup, setUseBackup] = React.useState(false);
  const [pre, setPre] = React.useState<string | null>(null);
  const [enrol, setEnrol] = React.useState<{ secret: string; uri: string } | null>(null);
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [session, setSession] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [mood, setMood] = React.useState<MascotMood>("greeting");

  React.useEffect(() => {
    if (readKundeToken()) router.replace("/kunde/rapport");
  }, [router]);

  function fail(e: unknown) {
    const msg = e instanceof KundeError ? e.detail : "Noe gikk galt. Prøv igjen.";
    // Pre-tokenet varer 5 min: er det ute, start på nytt i stedet for å vise en blindvei.
    if (e instanceof KundeError && e.status === 401 && step !== "credentials") {
      restart("Innloggingen tok for lang tid. Logg inn på nytt.");
      return;
    }
    setError(msg);
    setMood("concerned");
    setShake((s) => s + 1);
  }

  function restart(message: string | null = null) {
    setStep("credentials");
    setPre(null);
    setEnrol(null);
    setCode("");
    setUseBackup(false);
    setError(message);
    setMood(message ? "concerned" : "greeting");
  }

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    setMood("thinking");
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const onCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await kundeFetch<{ step: "2fa" | "enrol"; pre_token: string }>("/auth/login/", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      setPre(r.pre_token);
      setPassword("");
      setCode("");
      setMood("ready");
      if (r.step === "enrol") {
        const s = await kundeFetch<{ secret: string; otpauth_uri: string }>("/auth/enrol/start/", {
          method: "POST",
          token: r.pre_token,
        });
        setEnrol({ secret: s.secret, uri: s.otpauth_uri });
        setStep("enrol");
      } else {
        setStep("twofactor");
      }
    });
  };

  const onEnrolConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await kundeFetch<{ token: string; backup_codes: string[] }>("/auth/enrol/confirm/", {
        method: "POST",
        token: pre,
        body: { code },
      });
      setSession(r.token);
      setBackupCodes(r.backup_codes);
      setMood("ready");
      setStep("backup");
    });
  };

  const onVerify = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await kundeFetch<{ token: string }>("/auth/verify/", {
        method: "POST",
        token: pre,
        body: useBackup ? { backup_code: code } : { code },
      });
      storeKundeToken(r.token);
      router.replace("/kunde/rapport");
    });
  };

  const onForgot = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await kundeFetch("/auth/forgot/", { method: "POST", body: { email: email.trim() } });
      setMood("ready");
      setStep("forgot-sent");
    });
  };

  function finishBackup() {
    if (session) storeKundeToken(session);
    router.replace("/kunde/rapport");
  }

  const back = (
    <button type="button" onClick={() => restart()}
      className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <RotateCcw className="size-3" /> Tilbake
    </button>
  );
  const err = error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>;

  return (
    <KundeAuthFrame mood={mood}>
      <AnimatePresence mode="wait">
        {step === "credentials" && (
          <AuthCard id="credentials" shake={shake}>
            <h2 className="text-xl font-medium text-foreground">Logg inn</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tofaktorautentisering er påkrevd for alle kundekontoer.</p>
            <form onSubmit={onCredentials} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="k-email">E-post</Label>
                <Input id="k-email" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off"
                  spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setMood("ready")} className="h-11" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-password">Passord</Label>
                <Input id="k-password" type="password" autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} onFocus={() => setMood("ready")} className="h-11" required />
              </div>
              {err}
              <Button type="submit" disabled={busy} className="h-11 w-full text-sm font-medium">
                {busy ? "Logger inn…" : "Fortsett"}
                {!busy && <ArrowRight className="size-4" />}
              </Button>
            </form>
            <button type="button" onClick={() => { setError(null); setStep("forgot"); }}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Glemt passordet?
            </button>
          </AuthCard>
        )}

        {step === "enrol" && enrol && (
          <AuthCard id="enrol" shake={shake}>
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <h2 className="text-xl font-medium text-foreground">Sett opp innlogging med app</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Åpne en autentiseringsapp (for eksempel Microsoft eller Google Authenticator).</li>
              <li>Skann QR-koden, eller skriv inn nøkkelen under.</li>
              <li>Skriv inn den 6-sifrede koden appen viser.</li>
            </ol>
            <QrImage text={enrol.uri} />
            <SecretKey secret={enrol.secret} />
            <form onSubmit={onEnrolConfirm} className="mt-5 space-y-4">
              <CodeInput value={code} onChange={setCode} />
              {err}
              <Button type="submit" disabled={busy || code.length !== 6} className="h-11 w-full text-sm font-medium">
                {busy ? "Bekrefter…" : "Bekreft og logg inn"}
              </Button>
            </form>
            {back}
          </AuthCard>
        )}

        {step === "backup" && (
          <AuthCard id="backup" shake={shake}>
            <h2 className="text-xl font-medium text-foreground">Ta vare på reservekodene</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mister du telefonen, kan du logge inn med én av disse kodene. Hver kode virker én gang.
              De vises bare nå.
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3 font-mono text-sm">
              {backupCodes.map((c) => <li key={c} className="text-center">{c}</li>)}
            </ul>
            <Button type="button" variant="outline" className="mt-3 w-full gap-1.5"
              onClick={() => void navigator.clipboard?.writeText(backupCodes.join("\n"))}>
              <Copy className="size-4" /> Kopier kodene
            </Button>
            <Button type="button" onClick={finishBackup} className="mt-3 h-11 w-full text-sm font-medium">
              Jeg har tatt vare på kodene <ArrowRight className="size-4" />
            </Button>
          </AuthCard>
        )}

        {step === "twofactor" && (
          <AuthCard id="twofactor" shake={shake}>
            <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </span>
            <h2 className="text-xl font-medium text-foreground">Bekreft med kode</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {useBackup ? "Skriv inn en av reservekodene dine." : "Skriv inn den 6-sifrede koden fra autentiseringsappen."}
            </p>
            <form onSubmit={onVerify} className="mt-6 space-y-4">
              {useBackup ? (
                <Input aria-label="Reservekode" value={code} onChange={(e) => setCode(e.target.value)}
                  autoComplete="off" autoCapitalize="none" spellCheck={false}
                  className="h-11 text-center font-mono text-lg" autoFocus required />
              ) : (
                <CodeInput value={code} onChange={setCode} />
              )}
              {err}
              <Button type="submit" disabled={busy || (!useBackup && code.length !== 6) || (useBackup && code.length < 6)}
                className="h-11 w-full text-sm font-medium">
                {busy ? "Bekrefter…" : "Bekreft og logg inn"}
                {!busy && <ArrowRight className="size-4" />}
              </Button>
            </form>
            <button type="button" onClick={() => { setUseBackup((b) => !b); setCode(""); setError(null); }}
              className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              {useBackup ? "Bruk koden fra appen" : "Har du ikke telefonen? Bruk en reservekode"}
            </button>
            {back}
          </AuthCard>
        )}

        {step === "forgot" && (
          <AuthCard id="forgot" shake={shake}>
            <h2 className="text-xl font-medium text-foreground">Glemt passordet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Vi sender en lenke for å sette nytt passord.</p>
            <form onSubmit={onForgot} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="k-forgot">E-post</Label>
                <Input id="k-forgot" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off"
                  spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" required />
              </div>
              {err}
              <Button type="submit" disabled={busy} className="h-11 w-full text-sm font-medium">
                {busy ? "Sender…" : "Send lenke"}
              </Button>
            </form>
            {back}
          </AuthCard>
        )}

        {step === "forgot-sent" && (
          <AuthCard id="forgot-sent" shake={shake}>
            <h2 className="text-xl font-medium text-foreground">Sjekk e-posten</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Finnes adressen hos oss, får du en e-post med en lenke. Lenken virker i 72 timer.
              Har du aldri fått pålogging, ta kontakt med kontaktpersonen din i AB Marketing.
            </p>
            {back}
          </AuthCard>
        )}
      </AnimatePresence>
    </KundeAuthFrame>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      aria-label="Kode fra autentiseringsappen"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className="h-11 text-center font-mono text-lg tracking-[0.4em]"
      autoFocus
      required
    />
  );
}

function QrImage({ text }: { text: string }) {
  const src = React.useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createDataURL(5, 2);
  }, [text]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- data-URL generert i nettleseren
    <img src={src} alt="QR-kode for autentiseringsappen" width={180} height={180}
      className="mx-auto mt-4 rounded-md border border-border bg-white p-1 [image-rendering:pixelated]" />
  );
}

function SecretKey({ secret }: { secret: string }) {
  const grouped = secret.match(/.{1,4}/g)?.join(" ") ?? secret;
  return (
    <p className="mt-3 text-center text-xs text-muted-foreground">
      Nøkkel: <span className="select-all font-mono text-foreground">{grouped}</span>
    </p>
  );
}
