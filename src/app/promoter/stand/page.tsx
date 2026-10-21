"use client";

import * as React from "react";
import { CloudOff, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateStandLead, useStandMeta } from "@/lib/api/leads";
import { errorMessage } from "@/lib/api/client";
import { standLeadSchema } from "@/types/lead";
import { useSession } from "@/lib/permissions";
import { Mascot } from "@/components/patterns/mascot";
import { mascotFor } from "@/lib/use-mascot";
import { FormErrorSummary, type FieldError } from "@/components/patterns/form-error-summary";

/** Field → input id, so the error summary can link to (and focus) the field. */
const FIELD_IDS: Record<string, string> = {
  name: "st-name", phone: "st-phone", email: "st-email", campaign: "st-campaign", consentContact: "st-consent",
};
import { isRetryable, newClientId, useStandQueue, type QueuedLead } from "@/lib/stand-queue";

const LAST_CAMPAIGN = "ab-erp:stand-campaign";

/**
 * LEAD-05 — "Promotør skal kunne registrere leads fra stand i et mobilskjema,
 * og blir automatisk knyttet til leadet."
 *
 * IFK-08 says a promoter must be able to do everything they need from a phone,
 * so this is a single column at every width, 16px type, and 44px tap targets —
 * it is filled in standing up, outdoors, with one hand, next to the person whose
 * details are being typed.
 *
 * The promoter is not sent at all: the server takes it from the login token
 * (§8.1 l.729 *knyttet til riktig promotør*). Typing it would make "registrert av"
 * a guess, and DASH-03 measures promotørkvalitet off exactly that field.
 *
 * Bad signal is normal at a stand, so a send that fails on the network is queued
 * on the phone and retried (lib/stand-queue.ts); the server is idempotent on
 * `clientId`, so a retry never makes a second lead.
 */
export default function StandSkjema() {
  const session = useSession();
  const create = useCreateStandLead();
  const meta = useStandMeta();
  const campaigns = React.useMemo(() => meta.data?.campaigns ?? [], [meta.data]);
  const send = React.useCallback((item: QueuedLead) => create.mutateAsync({ ...item.payload, clientId: item.clientId }),
                                 [create]);
  const queue = useStandQueue(send);
  const [done, setDone] = React.useState<{ name: string; queued: boolean } | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "", phone: "", email: "",
    campaign: "",
    consentContact: false, consentAdAudience: false, note: "",
  });

  // The last campaign is pre-selected: a promotor stands at one stand all day.
  // Derived, not set in an effect: an untouched form shows the remembered campaign.
  const [remembered] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(LAST_CAMPAIGN); } catch { return null; }
  });
  const campaign = form.campaign
    || (campaigns.find((c) => c.id === remembered) ?? campaigns[0])?.id
    || "";

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm({ name: "", phone: "", email: "", campaign, consentContact: false, consentAdAudience: false, note: "" });
    setErrors({});
    setSubmitError(null);
    setDone(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const data = { ...form, campaign };
    const parsed = standLeadSchema.safeParse(data);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try { localStorage.setItem(LAST_CAMPAIGN, campaign); } catch { /* storage blocked */ }
    const item: QueuedLead = { clientId: newClientId(), payload: data, queuedAt: new Date().toISOString() };
    try {
      const lead = await send(item);
      setDone({ name: (lead as { name: string }).name, queued: false });
    } catch (err) {
      if (isRetryable(err)) {
        queue.enqueue(item);
        setDone({ name: form.name, queued: true });
      } else {
        setSubmitError(errorMessage(err));
      }
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
            {done.queued ? (
              <span className="flex size-12 items-center justify-center rounded-full bg-warning/10 text-warning-on-tint">
                <CloudOff className="size-6" aria-hidden />
              </span>
            ) : (
              // The screen exists because a lead was just sent — a real transition, so `once` is right.
              <Mascot {...mascotFor("allDone", "Registrert")} motion="once" size={72} />
            )}
            <div>
              <p className="text-base font-medium">
                {done.queued ? `${done.name} er lagret på telefonen` : `${done.name} er registrert`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {done.queued
                  ? "Ingen dekning akkurat nå. Leadet sendes automatisk så snart du er på nett igjen."
                  : "Rekrutterer ser det i samleinnboksen med deg som rekruttert av."}
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

      {queue.pending > 0 && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <CloudOff className="size-4" aria-hidden />
            {queue.pending === 1 ? "1 lead venter på nett" : `${queue.pending} leads venter på nett`}
          </span>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => void queue.flush()}>
            Send nå
          </Button>
        </div>
      )}

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <FormErrorSummary errors={Object.entries(errors).map(([field, message]): FieldError => ({ field: FIELD_IDS[field] ?? field, message }))} />
        <Card>
          <CardContent className="flex flex-col gap-4 py-5">
            <Field label="Navn" id="st-name" error={errors.name} required>
              <Input id="st-name" aria-invalid={Boolean(errors.name)} className="h-11 text-base" autoComplete="name"
                value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>

            <Field label="Telefon" id="st-phone" error={errors.phone} required>
              <Input id="st-phone" aria-invalid={Boolean(errors.phone)} className="h-11 text-base" type="tel" inputMode="tel" autoComplete="tel"
                value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>

            <Field label="E-post" id="st-email" error={errors.email} hint="Kan stå tomt">
              <Input id="st-email" aria-invalid={Boolean(errors.email)} className="h-11 text-base" type="email" inputMode="email" autoComplete="email"
                value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>

            <Field label="Kampanje" id="st-campaign" error={errors.campaign} required>
              <Select value={campaign} onValueChange={(v) => set("campaign", v)}
                disabled={meta.isLoading || campaigns.length === 0}>
                <SelectTrigger id="st-campaign" className="h-11 text-base">
                  <SelectValue placeholder={meta.isLoading ? "Henter kampanjer…" : meta.isError ? "Kunne ikke hente kampanjer" : "Velg kampanje"} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
              <Checkbox id="st-consent" className="mt-0.5 size-5" checked={form.consentContact} aria-required="true"
                onCheckedChange={(v) => set("consentContact", Boolean(v))} />
              <span>Jeg samtykker til å bli kontaktet om stilling hos AB Marketing. <span className="text-danger" aria-hidden>*</span></span>
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
  label, id, error, hint, required, children,
}: {
  label: string; id: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        {required && <span className="sr-only"> (påkrevd)</span>}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
