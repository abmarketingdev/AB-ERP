"use client";

import * as React from "react";
import { Check, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateStandLead } from "@/lib/api/leads";
import { errorMessage } from "@/lib/api/client";
import { standLeadSchema } from "@/types/lead";
import { LEAD_CAMPAIGNS } from "@/mocks/leads";
import { useSession } from "@/lib/permissions";

/**
 * LEAD-05 — "Promotør skal kunne registrere leads fra stand i et mobilskjema,
 * og blir automatisk knyttet til leadet."
 *
 * IFK-08 says a promoter must be able to do everything they need from a phone,
 * so this is a single column at every width, 16px type, and 44px tap targets —
 * it is filled in standing up, outdoors, with one hand, next to the person whose
 * details are being typed.
 *
 * The promoter is taken from the session and shown read-only rather than
 * selected. Typing it would make "registrert av" a guess, and DASH-03 measures
 * promotørkvalitet off exactly that field.
 */
export default function StandSkjema() {
  const session = useSession();
  const create = useCreateStandLead();
  const [done, setDone] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "", phone: "", email: "",
    campaign: LEAD_CAMPAIGNS[0],
    consentContact: false, consentAdAudience: false, note: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm({ name: "", phone: "", email: "", campaign: LEAD_CAMPAIGNS[0], consentContact: false, consentAdAudience: false, note: "" });
    setErrors({});
    setSubmitError(null);
    setDone(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = standLeadSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const lead = await create.mutateAsync({ ...form, promoter: session?.name });
      setDone(lead.name);
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  }

  // A confirmation that is its own screen, because the next thing that happens
  // on a stand is another person walking up.
  if (done) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <PageHeader title="Registrert" description="Leadet ligger nå i samleinnboksen" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-base font-medium">{done} er registrert</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rekrutterer ser det i samleinnboksen med deg som promotør.
              </p>
            </div>
            <Button size="lg" className="h-11 w-full max-w-xs gap-2" onClick={reset}>
              <RotateCcw className="size-4" /> Registrer neste
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Registrer lead"
        description={session ? `Registreres på ${session.name}` : "Registrer en interessert person fra stand"}
      />

      <form onSubmit={submit} className="flex flex-col gap-5">
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <Field label="Navn" id="st-name" error={errors.name}>
              <Input id="st-name" className="h-11 text-base" autoComplete="name"
                value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>

            <Field label="Telefon" id="st-phone" error={errors.phone}>
              <Input id="st-phone" className="h-11 text-base" type="tel" inputMode="tel" autoComplete="tel"
                value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>

            <Field label="E-post" id="st-email" error={errors.email} hint="Kan stå tomt">
              <Input id="st-email" className="h-11 text-base" type="email" inputMode="email" autoComplete="email"
                value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>

            <Field label="Kampanje" id="st-campaign" error={errors.campaign}>
              <Select value={form.campaign} onValueChange={(v) => set("campaign", v)}>
                <SelectTrigger id="st-campaign" className="h-11 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_CAMPAIGNS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Notat" id="st-note" hint="Valgfritt — hva ble sagt">
              <Textarea id="st-note" rows={2} className="text-base"
                value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {/*
          LEAD-10 — two separate consents, worded as what the person is actually
          agreeing to. The second is not a formality: LEAD-11 exports
          well-performing people to Meta and TikTok as lookalike seeds, and
          agreeing to a phone call is not agreeing to that.
        */}
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <p className="text-sm font-medium">Samtykke</p>
            <label className="flex min-h-11 items-start gap-3 text-[15px]">
              <Checkbox className="mt-0.5 size-5" checked={form.consentContact}
                onCheckedChange={(v) => set("consentContact", Boolean(v))} />
              <span>Jeg samtykker til å bli kontaktet om stilling hos AB Marketing.</span>
            </label>
            {errors.consentContact && <p className="text-sm text-danger">{errors.consentContact}</p>}

            <label className="flex min-h-11 items-start gap-3 text-[15px]">
              <Checkbox className="mt-0.5 size-5" checked={form.consentAdAudience}
                onCheckedChange={(v) => set("consentAdAudience", Boolean(v))} />
              <span>Jeg samtykker også til at opplysningene brukes til å finne lignende kandidater i annonser.</span>
            </label>
          </CardContent>
        </Card>

        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={create.isPending}>
          {create.isPending ? "Registrerer…" : "Registrer lead"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label, id, error, hint, children,
}: {
  label: string; id: string; error?: string; hint?: string; children: React.ReactNode;
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
