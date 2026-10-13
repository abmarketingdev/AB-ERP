"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdTemplates, useAdMeta, useCreateAd } from "@/lib/api/srs";
import { errorMessage } from "@/lib/api/client";
import { newAdSchema, AD_PLATFORMS, PLATFORM_FREE, type AdPlatform } from "@/types/ad";
import { LEAD_CAMPAIGNS } from "@/mocks/leads";

/**
 * ANN-01 / ANN-03 — lag annonsen én gang, fra en mal, og publiser til flere
 * plattformer samtidig.
 *
 * Picking a template fills the title and body rather than locking them: ANN-03
 * asks for templates per job type and location, and the point of a template is
 * to start from something rather than to be forbidden from editing it.
 */
export function NewAdDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const templates = useAdTemplates();
  const meta = useAdMeta();
  const create = useCreateAd();

  const [form, setForm] = React.useState({
    title: "", jobType: "", location: "", campaign: LEAD_CAMPAIGNS[0], body: "", deadline: "",
  });
  const [platforms, setPlatforms] = React.useState<AdPlatform[]>(["Nav", "Indeed"]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm({ title: "", jobType: "", location: "", campaign: LEAD_CAMPAIGNS[0], body: "", deadline: "" });
    setPlatforms(["Nav", "Indeed"]);
    setErrors({});
    setSubmitError(null);
  }, [open]);

  function applyTemplate(id: string) {
    const t = (templates.data ?? []).find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({ ...f, title: t.title, body: t.body, jobType: t.jobType, location: t.location }));
  }

  function togglePlatform(p: AdPlatform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function submit(publish: boolean) {
    setSubmitError(null);
    const payload = { ...form, deadline: form.deadline || undefined, platforms };
    const parsed = newAdSchema.safeParse(payload);
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
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
              <SelectTrigger id="ad-tpl"><SelectValue placeholder="Velg mal (valgfritt)" /></SelectTrigger>
              <SelectContent>
                {(templates.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Field id="ad-title" label="Tittel" error={errors.title}>
            <Input id="ad-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ad-jobtype" label="Stillingstype" error={errors.jobType}>
              <Select value={form.jobType} onValueChange={(v) => setForm((f) => ({ ...f, jobType: v }))}>
                <SelectTrigger id="ad-jobtype"><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>
                  {(meta.data?.jobTypes ?? []).map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="ad-loc" label="Sted" error={errors.location}>
              <Select value={form.location} onValueChange={(v) => setForm((f) => ({ ...f, location: v }))}>
                <SelectTrigger id="ad-loc"><SelectValue placeholder="Velg" /></SelectTrigger>
                <SelectContent>
                  {(meta.data?.locations ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="ad-camp" label="Kampanje" error={errors.campaign}>
              <Select value={form.campaign} onValueChange={(v) => setForm((f) => ({ ...f, campaign: v }))}>
                <SelectTrigger id="ad-camp"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_CAMPAIGNS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field id="ad-body" label="Annonsetekst" error={errors.body}>
            <Textarea id="ad-body" rows={9} value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </Field>

          <Field id="ad-deadline" label="Søknadsfrist" hint="Annonsen avpubliseres automatisk når fristen går ut">
            <Input id="ad-deadline" type="date" className="w-[11rem]" value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Publiser til</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {AD_PLATFORMS.map((p) => (
                <label key={p} className="flex min-h-9 items-center gap-2 text-sm">
                  <Checkbox checked={platforms.includes(p)} onCheckedChange={() => togglePlatform(p)} />
                  {p}
                  {!PLATFORM_FREE[p] && <span className="text-xs text-muted-foreground">(betalt — «Bør» i SRS-en)</span>}
                </label>
              ))}
            </div>
            {errors.platforms && <p className="text-sm text-danger">{errors.platforms}</p>}
          </fieldset>

          {submitError && <p className="text-sm text-danger">{submitError}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button variant="outline" className="gap-1.5" disabled={create.isPending} onClick={() => submit(false)}>
            <FileText className="size-4" /> Lagre som utkast
          </Button>
          <Button disabled={create.isPending} onClick={() => submit(true)}>
            {create.isPending ? "Publiserer…" : `Publiser til ${platforms.length} plattform${platforms.length === 1 ? "" : "er"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
