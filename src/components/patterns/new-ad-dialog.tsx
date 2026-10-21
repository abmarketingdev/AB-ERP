"use client";

import * as React from "react";
import { AlertTriangle, FileText, Hand } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdTemplates, useAdMeta, useCreateAd, useWordingCheck } from "@/lib/api/ads";
import { ApiError, errorMessage } from "@/lib/api/client";
import { newAdSchema, type WordingCheck } from "@/types/ad";
import { LEAD_CAMPAIGNS } from "@/mocks/leads";
import { NbDateField } from "@/components/booking/nb-date-field";

/**
 * ANN-01 / ANN-03 — lag annonsen én gang, fra en mal, og publiser til flere
 * plattformer samtidig.
 *
 * Picking a template fills the title and body rather than locking them: ANN-03
 * asks for templates per job type and location, and the point of a template is
 * to start from something rather than to be forbidden from editing it. Choosing
 * job type + location picks the matching template by itself.
 *
 * SRS l.4 («fjern alt av … salg og pengemotiv»): the text is checked against the
 * server's own word list while typing, so the recruiter sees the word before
 * pressing save — not a refusal after it.
 */
export function NewAdDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {/* Mounted per opening, so every new ad starts from an empty form. */}
        {open && <NewAdForm onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function NewAdForm({ onClose }: { onClose: () => void }) {
  const templates = useAdTemplates();
  const meta = useAdMeta();
  const create = useCreateAd();
  const wording = useWordingCheck();

  const boards = React.useMemo(() => meta.data?.boards ?? [], [meta.data]);
  const defaultBoards = React.useMemo(() => boards.filter((b) => b.free).map((b) => b.key), [boards]);

  const [form, setForm] = React.useState({
    title: "", jobType: "", location: "", campaign: LEAD_CAMPAIGNS[0], body: "", deadline: "",
  });
  // null = untouched: follow the default (the free boards) even if meta arrives after mount.
  const [chosen, setChosen] = React.useState<string[] | null>(null);
  const platforms = chosen ?? defaultBoards;
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [check, setCheck] = React.useState<WordingCheck | null>(null);

  // Live wording check, debounced — one request per pause in typing.
  const text = `${form.title}\n${form.body}`;
  const { mutate: runCheck } = wording;
  React.useEffect(() => {
    if (text.trim().length < 3) return;
    const t = setTimeout(() => runCheck(text, { onSuccess: setCheck }), 500);
    return () => clearTimeout(t);
  }, [text, runCheck]);

  function applyTemplate(id: string) {
    const t = (templates.data ?? []).find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({ ...f, title: t.title, body: t.body, jobType: t.jobType, location: t.location }));
  }

  function pick(field: "jobType" | "location", value: string) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // ANN-03: job type + location together select their template, if the text is still untouched.
      const match = (templates.data ?? []).find((t) => t.jobType === next.jobType && t.location === next.location);
      if (match && !f.body) return { ...next, title: match.title, body: match.body };
      return next;
    });
  }

  function togglePlatform(key: string) {
    setChosen(platforms.includes(key) ? platforms.filter((x) => x !== key) : [...platforms, key]);
  }

  async function submit(publish: boolean) {
    setSubmitError(null);
    const payload = { ...form, deadline: form.deadline || undefined, platforms };
    const parsed = newAdSchema.safeParse(publish ? payload : { ...payload, platforms: platforms.length ? platforms : ["-"] });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] = i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      await create.mutateAsync({ ...payload, publish });
      onClose();
    } catch (err) {
      setSubmitError(errorMessage(err));
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        const fieldErrors = (err.body as { errors?: Record<string, string[]> }).errors ?? {};
        setErrors(Object.fromEntries(Object.entries(fieldErrors).filter(([k]) => k !== "detail")
          .map(([k, v]) => [k, `Fjern: ${v.join(", ")}`])));
      }
    }
  }

  const blocked = check?.blocked ?? [];
  const warned = check?.warnings ?? [];
  const manualChosen = boards.filter((b) => b.mode === "manual" && platforms.includes(b.key));

  return (
    <>
        <DialogHeader>
          <DialogTitle>Ny annonse</DialogTitle>
          <DialogDescription>
            Lag annonsen én gang og publiser den til flere plattformer. Hver plattform får sin
            egen sporingslenke, slik at søkerne kan knyttes til riktig kanal.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-tpl">Start fra en mal</Label>
            <Select onValueChange={applyTemplate}>
              <SelectTrigger id="ad-tpl" className="w-full"><SelectValue placeholder="Velg mal (valgfritt)" /></SelectTrigger>
              <SelectContent>
                {(templates.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} · {t.jobType} · {t.location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field id="ad-title" label="Tittel" error={errors.title}>
            <Input id="ad-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
            <Field id="ad-jobtype" label="Stillingstype" error={errors.jobType}>
              <Select value={form.jobType} onValueChange={(v) => pick("jobType", v)}>
                <SelectTrigger id="ad-jobtype" className="w-full"><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>
                  {(meta.data?.jobTypes ?? []).map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="ad-loc" label="Sted" error={errors.location}>
              <Select value={form.location} onValueChange={(v) => pick("location", v)}>
                <SelectTrigger id="ad-loc" className="w-full"><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>
                  {(meta.data?.locations ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="ad-camp" label="Kampanje" error={errors.campaign}>
              <Select value={form.campaign} onValueChange={(v) => setForm((f) => ({ ...f, campaign: v }))}>
                <SelectTrigger id="ad-camp" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_CAMPAIGNS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="ad-body" label="Annonsetekst" error={errors.body}>
            <Textarea id="ad-body" rows={9} value={form.body} aria-describedby="ad-wording"
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </Field>

          <div id="ad-wording" aria-live="polite" className="flex flex-col gap-1.5">
            {blocked.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Kandidater skal ikke se ord om penger eller salg. Fjern:{" "}
                  {[...new Set(blocked.map((h) => h.text))].map((w) => <mark key={w} className="rounded bg-danger/15 px-1 text-danger">{w}</mark>)
                    .reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " ", el] : [el]), [])}
                </span>
              </p>
            )}
            {warned.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning-on-tint">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  «{[...new Set(warned.map((h) => h.text))].join("», «")}» er lov, men tenk over om det trengs.
                  Annonsen skal handle om jobben og saken, ikke om penger.
                </span>
              </p>
            )}
          </div>

          <Field id="ad-deadline" label="Søknadsfrist" hint="Valgfritt. Annonsen avpubliseres automatisk når fristdagen er over">
            <NbDateField id="ad-deadline" value={form.deadline} min={new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date())}
              onChange={(iso) => setForm((f) => ({ ...f, deadline: iso }))} />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Publiser til</legend>
            {meta.isPending ? (
              <p className="text-sm text-muted-foreground">Henter plattformer…</p>
            ) : meta.isError ? (
              <p className="text-sm text-danger">Kunne ikke hente plattformene. Du kan lagre som utkast og publisere senere.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {boards.map((b) => (
                  <label key={b.key} className="flex min-h-11 items-center gap-2 rounded-md px-1 text-sm">
                    <Checkbox checked={platforms.includes(b.key)} onCheckedChange={() => togglePlatform(b.key)} />
                    <span>{b.name}</span>
                    {(!b.free || b.mode === "manual") && (
                      <span className="text-xs text-muted-foreground">
                        ({[!b.free && "krever partneravtale", b.mode === "manual" && "manuell"].filter(Boolean).join(" · ")})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
            {manualChosen.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Hand className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {manualChosen.map((b) => b.name).join(", ")} publiseres manuelt: legg inn annonsen der med
                sporingslenken som søknadslenke, og lim inn annonse-ID-en etterpå. Søkerne telles likevel.
              </p>
            )}
            {errors.platforms && <p className="text-sm text-danger">{errors.platforms}</p>}
          </fieldset>

          {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button variant="outline" className="gap-1.5" disabled={create.isPending} onClick={() => submit(false)}>
            <FileText className="size-4" /> Lagre som utkast
          </Button>
          <Button disabled={create.isPending || blocked.length > 0 || platforms.length === 0} onClick={() => submit(true)}>
            {create.isPending ? "Publiserer…" : `Publiser til ${platforms.length} plattform${platforms.length === 1 ? "" : "er"}`}
          </Button>
        </DialogFooter>
    </>
  );
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
