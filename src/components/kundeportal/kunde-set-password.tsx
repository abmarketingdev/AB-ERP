"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, KundeAuthFrame, type MascotMood } from "./auth-frame";
import { KundeError, kundeFetch } from "@/lib/kundeportal/api";

/** /kunde/sett-passord?t=… — lenken fra «Pålogging sendt» eller «Glemt passord». */
export function KundeSetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("t") ?? "";
  const check = useQuery({
    queryKey: ["kundeportal", "link", token],
    queryFn: () => kundeFetch<{ email: string; organisation: string }>("/auth/link/", { params: { t: token } }),
    enabled: !!token,
    retry: false,
  });
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [shake, setShake] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [mood, setMood] = React.useState<MascotMood>("greeting");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== pw2) {
      setError("Passordene er ikke like.");
      setMood("concerned");
      setShake((s) => s + 1);
      return;
    }
    setBusy(true);
    setMood("thinking");
    try {
      await kundeFetch("/auth/set-password/", { method: "POST", body: { token, password: pw } });
      setDone(true);
      setMood("ready");
    } catch (err) {
      setError(err instanceof KundeError ? err.detail : "Noe gikk galt. Prøv igjen.");
      setMood("concerned");
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  }

  const invalid = !token || check.isError;
  return (
    <KundeAuthFrame mood={invalid ? "concerned" : mood}>
      <AnimatePresence mode="wait">
        {invalid ? (
          <AuthCard id="invalid" shake={0}>
            <h2 className="text-xl font-medium text-foreground">Lenken virker ikke</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {check.error instanceof KundeError ? check.error.detail : "Lenken er ugyldig, utløpt eller allerede brukt."}{" "}
              Du kan be om en ny under «Glemt passordet?» på innloggingssiden.
            </p>
            <Button asChild className="mt-6 h-11 w-full"><Link href="/kunde/login">Til innlogging</Link></Button>
          </AuthCard>
        ) : done ? (
          <AuthCard id="done" shake={0}>
            <h2 className="text-xl font-medium text-foreground">Passordet er satt</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Logg inn med e-post og det nye passordet. Første gang setter du opp en autentiseringsapp.
            </p>
            <Button className="mt-6 h-11 w-full" onClick={() => router.replace("/kunde/login")}>
              Til innlogging <ArrowRight className="size-4" />
            </Button>
          </AuthCard>
        ) : (
          <AuthCard id="form" shake={shake}>
            <h2 className="text-xl font-medium text-foreground">Sett passord</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {check.data ? <>For <span className="text-foreground">{check.data.email}</span> ({check.data.organisation}).</> : "Sjekker lenken…"}
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <input type="email" autoComplete="username" value={check.data?.email ?? ""} readOnly hidden />
              <div className="space-y-1.5">
                <Label htmlFor="k-pw">Nytt passord</Label>
                <Input id="k-pw" type="password" autoComplete="new-password" value={pw}
                  onChange={(e) => setPw(e.target.value)} onFocus={() => setMood("ready")} className="h-11" required minLength={10} />
                <p className="text-xs text-muted-foreground">Minst 10 tegn.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-pw2">Gjenta passordet</Label>
                <Input id="k-pw2" type="password" autoComplete="new-password" value={pw2}
                  onChange={(e) => setPw2(e.target.value)} className="h-11" required />
              </div>
              {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
              <Button type="submit" disabled={busy || !check.data} className="h-11 w-full text-sm font-medium">
                {busy ? "Lagrer…" : "Sett passord"}
              </Button>
            </form>
          </AuthCard>
        )}
      </AnimatePresence>
    </KundeAuthFrame>
  );
}
