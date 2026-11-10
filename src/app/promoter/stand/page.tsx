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
import { useCreateStandLead, useStandMeta } from "@/lib/api/leads";
import { MANUAL_SOURCES } from "@/lib/lead-sources";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/api/client";
import { standLeadSchema } from "@/types/lead";
import { useHasPermission, useSession } from "@/lib/permissions";
import Link from "next/link";
import { Mascot } from "@/components/patterns/mascot";
import { mascotFor } from "@/lib/use-mascot";
import { FormErrorSummary, type FieldError } from "@/components/patterns/form-error-summary";

/** Field → input id, so the error summary can link to (and focus) the field. */
const FIELD_IDS: Record<string, string> = {
  name: "st-name", phone: "st-phone", email: "st-email", consentContact: "st-consent",
};
import { isRetryable, newClientId, useStandQueue, type QueuedLead } from "@/lib/stand-queue";

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
  // C3 (client 10.11): a recruiter, leader or admin has a board — the lead lands at the top
  // of «Ny» there. A stand promoter has none: the inbox text stays for them.
  const mayWrite = useHasPermission("leads.write");
  const isLeader = useHasPermission("leads.board");
  const onBoard = mayWrite || isLeader;
  const create = useCreateStandLead();
  // R1 (client 09.11): where the person heard of us; «Stand» unless the promoter picks another.
  const meta = useStandMeta();
  const sources = meta.data?.sources?.length ? meta.data.sources : MANUAL_SOURCES;
  const defaultSource = meta.data?.defaultSource ?? "stand";
  const send = React.useCallback((item: QueuedLead) => create.mutateAsync({ ...item.payload, clientId: item.clientId }),
                                 [create]);
  const queue = useStandQueue(send);
  const [done, setDone] = React.useState<{ name: string; queued: boolean } | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "", phone: "", email: "",
    consentContact: false, note: "", source: "stand",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm({ name: "", phone: "", email: "", consentContact: false, note: "", source: defaultSource });
    setErrors({});
    setSubmitError(null);
    setDone(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    // No campaign (client 2026-11-05): a stand lead is not tied to a campaign. One consent
    // box — the privacy policy — so ad-audience consent is never claimed at a stand.
    const data = { ...form, consentAdAudience: false };
    const parsed = standLeadSchema.safeParse(data);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
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
        <PageHeader title="Registrert" description={onBoard && !done.queued ? "Leadet ligger øverst i «Ny» på tavlen din" : "Leadet ligger nå i samleinnboksen"} />
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
                  : onBoard
                    ? "Du finner det øverst i «Ny» på tavlen, og i samleinnboksen. «Ta denne» gjør det til din kandidat."
                    : "Rekrutterer ser det i samleinnboksen med deg som rekruttert av."}
              </p>
            </div>
            <Button size="lg" className="h-11 w-full max-w-xs gap-2" onClick={reset}>
              <RotateCcw className="size-4" /> Registrer neste
            </Button>
            {onBoard && !done.queued && (
              <Button asChild variant="outline" size="lg" className="h-11 w-full max-w-xs">
                <Link href="/rekruttering/kandidater">Åpne tavlen</Link>
              </Button>
            )}
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

            <div className="flex flex-col gap-1.5">
              <span id="st-source-label" className="text-sm font-medium">Kilde</span>
              <div role="radiogroup" aria-labelledby="st-source-label" className="flex flex-wrap gap-2">
                {sources.map((s) => {
                  const on = form.source === s.key;
                  return (
                    <button key={s.key} type="button" role="radio" aria-checked={on}
                      onClick={() => set("source", s.key)}
                      className={cn(
                        "h-11 rounded-full border px-4 text-[15px] transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground"
                           : "border-border bg-background hover:bg-muted",
                      )}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

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
            {/* One box (client 2026-11-05): the privacy policy, linked. The link is its own
                element so a tap on the words opens the policy without toggling the box. */}
            <label className="flex min-h-11 items-start gap-3 text-[15px]">
              <Checkbox id="st-consent" className="mt-0.5 size-5" checked={form.consentContact} aria-required="true"
                aria-invalid={Boolean(errors.consentContact)}
                onCheckedChange={(v) => set("consentContact", Boolean(v))} />
              <span>
                Jeg har lest og godtar{" "}
                <a href="https://abmarketing.no/personvern" target="_blank" rel="noopener noreferrer"
                   className="font-medium underline underline-offset-4" onClick={(e) => e.stopPropagation()}>
                  personvernerklæringen
                </a>
                . <span className="text-danger" aria-hidden>*</span>
              </span>
            </label>
            {errors.consentContact && <p className="text-sm text-danger">{errors.consentContact}</p>}
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
