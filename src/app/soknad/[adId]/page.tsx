"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicAd, useApply } from "@/lib/api/ads";
import { ApiError, errorMessage } from "@/lib/api/client";
import { Mascot } from "@/components/patterns/mascot";
import { applicationSchema, CONSENT_TEXT } from "@/types/ad";

/**
 * ANN-04 — søknadsskjemaet bak sporingslenken.
 *
 * Public: no login, no shell, no navigation. The candidate has arrived from a
 * job ad and has one thing to do. The `?k=` token from the tracking link is sent
 * with the application, and the SERVER resolves it to the platform the person
 * came from (ANN-04, LEAD-04, LEAD-12) — a channel name in the URL could be
 * edited, a token cannot. Without a token the lead lands as «Nettside».
 *
 * The consent wording is the server's versioned text (LEAD-10), word for word.
 *
 * Always light. This is a page an applicant sees once, and it should look like
 * the company's website rather than inherit whatever theme a staff member set.
 */
export default function Soknad() {
  const { adId } = useParams<{ adId: string }>();
  const params = useSearchParams();
  const token = params.get("k") ?? undefined;
  const legacyChannel = params.get("kanal") ?? undefined;
  const ad = usePublicAd(adId);
  const apply = useApply();

  const [form, setForm] = React.useState({
    name: "", phone: "", email: "", message: "",
    consentContact: false, consentAdAudience: false,
  });
  // Honeypot: invisible to people, filled in by bots. The server drops those quietly.
  const [website, setWebsite] = React.useState("");
  const [closed, setClosed] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = applicationSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await apply.mutateAsync({ ...form, adId, k: token, channel: legacyChannel, website });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setClosed(true);
      else setSubmitError(errorMessage(err));
    }
  }

  return (
    <div className="light min-h-screen bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">AB Marketing</p>
          {ad.isPending ? (
            <Skeleton className="h-8 w-3/4" />
          ) : (
            <h1 className="text-2xl font-medium tracking-tight">{ad.data?.title ?? "Søk på stilling"}</h1>
          )}
          {ad.data && (
            <p className="text-sm text-muted-foreground">
              {ad.data.jobType} · {ad.data.location}
              {ad.data.deadline && ` · søknadsfrist ${new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(new Date(ad.data.deadline))}`}
            </p>
          )}
        </header>

        {ad.isError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Mascot state="sleeping" size={72} label="Fant ikke annonsen" />
              <p className="text-base font-medium">Vi fant ikke denne annonsen</p>
              <p className="text-sm text-muted-foreground">Lenken kan være feil, eller annonsen er fjernet.</p>
            </CardContent>
          </Card>
        ) : closed || (ad.data && !ad.data.open) ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Mascot state="sleeping" size={72} label="Søknadsfristen er ute" />
              <p className="text-base font-medium">Søknadsfristen er ute</p>
              <p className="text-sm text-muted-foreground">
                Denne stillingen tar ikke imot flere søknader. Takk for interessen!
              </p>
            </CardContent>
          </Card>
        ) : sent ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Mascot state="win-small" size={72} label="Søknaden er sendt" />
              <div>
                <p className="text-base font-medium">Takk for søknaden</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vi tar kontakt så snart vi har sett på den. Du hører fra oss på telefon eller SMS.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {ad.data && (
              <Card>
                <CardContent className="py-5">
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{ad.data.body}</p>
                </CardContent>
              </Card>
            )}

            <form onSubmit={submit} noValidate className="relative flex flex-col gap-5">
              {/* Error summary first (GOV.UK pattern): on a phone the field errors can be off-screen. */}
              {Object.keys(errors).length > 0 && (
                <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-4 text-sm">
                  <p className="font-medium text-danger">Noe mangler før du kan sende</p>
                  <ul className="mt-2 list-disc pl-5">
                    {Object.entries(errors).map(([k, m]) => (
                      <li key={k}><a className="underline underline-offset-2" href={`#ap-${{ name: "name", phone: "phone", email: "email" }[k] ?? "name"}`}>{m}</a></li>
                    ))}
                  </ul>
                </div>
              )}
              <Card>
                <CardContent className="flex flex-col gap-4 py-5">
                  <h2 className="text-sm font-medium">Dine opplysninger</h2>
                  <Field id="ap-name" label="Navn" error={errors.name}>
                    <Input id="ap-name" className="h-11 text-base" autoComplete="name"
                      value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field id="ap-phone" label="Telefon" error={errors.phone}>
                    <Input id="ap-phone" className="h-11 text-base" type="tel" inputMode="tel" autoComplete="tel"
                      value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </Field>
                  <Field id="ap-email" label="E-post" error={errors.email}>
                    <Input id="ap-email" className="h-11 text-base" type="email" inputMode="email" autoComplete="email"
                      value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </Field>
                  <Field id="ap-msg" label="Kort om deg" hint="Valgfritt">
                    <Textarea id="ap-msg" rows={3} className="text-base"
                      value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-4 py-5">
                  <h2 className="text-sm font-medium">Samtykke</h2>
                  <label className="flex min-h-11 items-start gap-3 text-[15px]">
                    <Checkbox className="mt-0.5 size-5" checked={form.consentContact}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, consentContact: Boolean(v) }))} />
                    <span>{CONSENT_TEXT.contact}</span>
                  </label>
                  {errors.consentContact && <p className="text-sm text-danger">{errors.consentContact}</p>}
                  <label className="flex min-h-11 items-start gap-3 text-[15px]">
                    <Checkbox className="mt-0.5 size-5" checked={form.consentAdAudience}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, consentAdAudience: Boolean(v) }))} />
                    <span>{CONSENT_TEXT.adAudience} <span className="text-muted-foreground">(valgfritt)</span></span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Søknader fra kandidater som ikke blir ansatt slettes etter tre år, med mindre du
                    samtykker til lengre lagring. Du kan når som helst be om innsyn eller sletting.
                  </p>
                </CardContent>
              </Card>

              <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
                <label htmlFor="ap-website">Nettside</label>
                <input id="ap-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}

              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={apply.isPending}>
                {apply.isPending ? "Sender…" : "Send søknad"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
