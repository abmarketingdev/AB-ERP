"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { BellRing, CircleAlert, CircleCheck, Clock, KeyRound, Power, Send, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Mascot } from "@/components/patterns/mascot";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { FormErrorSummary, errorsFromApi, type FieldError } from "@/components/patterns/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  type AdminIntegration,
  useAckAlert,
  useAdminIntegrations,
  useIntegrationAlerts,
  useSaveSecrets,
  useSendTest,
  useToggleIntegration,
} from "@/lib/api/integrations-admin";
import { useAccess } from "@/lib/use-access";
import { mascotFor } from "@/lib/use-mascot";
import { riseIn } from "@/lib/motion";

/**
 * /admin/integrasjoner in api mode — SRS §4 l.561–566 made operable by an admin:
 * which integration is down, what that breaks, and the three things they can do about it
 * without a developer (switch it off/on, enter keys, send a test). Status is words + icon
 * + colour (WCAG 1.4.1); the list is a triage list, worst first.
 */
const STATUS = {
  failing: { label: "Feiler", icon: CircleAlert, chip: "border-danger/30 bg-danger/10 text-danger", dot: "bg-danger" },
  late: { label: "Forsinket", icon: Clock, chip: "border-warning/35 bg-warning/10 text-warning", dot: "bg-warning" },
  off: { label: "Av", icon: Power, chip: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  ok: { label: "I rute", icon: CircleCheck, chip: "border-success/30 bg-success/10 text-success", dot: "bg-success" },
} as const;
const RANK = { failing: 0, late: 1, off: 2, ok: 3 } as const;

const dt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (iso: string | null) => (iso ? dt.format(new Date(iso)) : "Aldri");

export function IntegrationAdmin() {
  const query = useAdminIntegrations();
  const alerts = useIntegrationAlerts();
  const reduced = useReducedMotion();
  const { can } = useAccess();
  const canAdmin = can("integrations.admin");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Integrasjoner"
        description="Hver integrasjon kjører for seg. Når én er nede, virker resten."
        source="Rekrutteringstjenesten"
        lastUpdated={query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : new Date()}
      />

      {alerts.data && alerts.data.length > 0 && <AlertList alerts={alerts.data} />}

      <QueryBoundary
        query={query}
        skeleton={<div className="flex flex-col gap-2.5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen integrasjoner er satt opp"
        emptyDescription="Integrasjonene dukker opp her når de første jobbene er lagt i kø."
        className="flex flex-col gap-5"
      >
        {(rows) => {
          const failing = rows.filter((r) => r.status === "failing").length;
          const late = rows.filter((r) => r.status === "late").length;
          const off = rows.filter((r) => r.status === "off").length;
          const allWell = failing === 0 && late === 0;
          return (
            <>
              <motion.div {...riseIn(0, reduced)}
                className="flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-5 py-4 text-[13.5px] text-foreground">
                {allWell && <Mascot {...mascotFor("allClear")} size={56} className="shrink-0" />}
                <p>
                  {allWell ? (
                    <>Alle integrasjoner som er på, går som normalt.{off > 0 && <span className="text-muted-foreground"> {off} er skrudd av.</span>}</>
                  ) : (
                    <>
                      {failing > 0 && <><span className="font-mono tabular-nums">{failing}</span> {failing === 1 ? "feiler" : "feiler"}</>}
                      {failing > 0 && late > 0 && ", "}
                      {late > 0 && <><span className="font-mono tabular-nums">{late}</span> er forsinket</>}
                      . <span className="text-muted-foreground">Resten av systemet virker som vanlig.</span>
                    </>
                  )}
                </p>
              </motion.div>
              <ul className="flex flex-col gap-2.5">
                {[...rows].sort((a, b) => RANK[a.status] - RANK[b.status]).map((r, i) => (
                  <motion.li key={r.name} {...riseIn(i + 1, reduced)}>
                    <Row r={r} canAdmin={canAdmin} />
                  </motion.li>
                ))}
              </ul>
              <p className="text-[12px] text-muted-foreground">
                Feilede kall prøves på nytt automatisk. Etter tre feil på rad får administratorene varsel her og på e-post.
                Mens en integrasjon er av, venter jobbene. Ingenting går tapt.
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function AlertList({ alerts }: { alerts: { id: number; label: string; message: string; createdAt: string }[] }) {
  const ack = useAckAlert();
  return (
    <section aria-label="Varsler" className="flex flex-col gap-2">
      {alerts.map((a) => (
        <div key={a.id} role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3">
          <BellRing className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium text-foreground">{a.label}</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{a.message}</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">{when(a.createdAt)}</p>
          </div>
          <Button variant="outline" className="min-h-11 sm:min-h-9" disabled={ack.isPending} onClick={() => ack.mutate(a.id)}>
            Kvitter ut
          </Button>
        </div>
      ))}
    </section>
  );
}

function Row({ r, canAdmin }: { r: AdminIntegration; canAdmin: boolean }) {
  const s = STATUS[r.status];
  const Icon = s.icon;
  const toggle = useToggleIntegration();
  const test = useSendTest();
  const [keysOpen, setKeysOpen] = React.useState(false);
  const toggleError = toggle.error ? errorMessage(toggle.error) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 gap-3.5">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-foreground">{r.label}</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">{r.breaksWhat || "—"}</p>
            {r.status === "failing" && r.lastError && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-danger">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="break-words">Siste feil: {r.lastError}</span>
              </p>
            )}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${s.chip}`}>
          <Icon className="size-3" aria-hidden />
          {s.label}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-2 border-t border-border px-5 py-3 sm:flex sm:flex-wrap">
        <Field label="Siste vellykkede" value={when(r.lastSuccessAt)} />
        <Field label="Feil på rad" value={String(r.consecutiveFailures)} tone={r.consecutiveFailures ? "text-danger" : undefined} />
        <Field label="Venter i kø" value={String(r.pendingJobs)} />
        <Field label="Leverandør" value={r.provider === "mock" ? "Test (mock)" : "Ekte"} />
        <Field label="Nøkler" value={r.hasSecrets ? "Lagret" : "Ikke lagt inn"} />
        <Field label="Eier" value={r.owner || "—"} />
      </dl>

      {canAdmin && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-muted/20 px-5 py-3">
          <label className="flex min-h-11 items-center gap-2.5 text-[13px] text-foreground">
            <Switch
              checked={r.enabled}
              disabled={toggle.isPending}
              onCheckedChange={(on) => toggle.mutate({ name: r.name, enabled: on })}
              aria-label={`${r.label} ${r.enabled ? "på" : "av"}`}
            />
            {r.enabled ? "På" : "Av"}
          </label>
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => setKeysOpen(true)}>
            <KeyRound className="size-4" aria-hidden /> Nøkler
          </Button>
          <Button variant="outline" className="min-h-11 sm:min-h-9" disabled={test.isPending || !r.enabled}
            title={!r.enabled ? "Skru på integrasjonen for å teste" : undefined}
            onClick={() => test.mutate(r.name)}>
            <Send className="size-4" aria-hidden /> {test.isPending ? "Tester…" : "Send test"}
          </Button>
          <span aria-live="polite" className="text-[12.5px]">
            {test.data && (test.data.ok
              ? <span className="text-success">Testen gikk gjennom.</span>
              : <span className="text-danger">Testen feilet: {String(test.data.detail ?? "ukjent feil")}</span>)}
            {test.error && <span className="text-danger">{errorMessage(test.error)}</span>}
            {toggleError && <span className="text-danger">{toggleError}</span>}
          </span>
        </div>
      )}
      {keysOpen && <SecretsSheet integration={r} onClose={() => setKeysOpen(false)} />}
    </div>
  );
}

/** Write-only (§4 l.564): what is stored is never shown again, not even masked. */
function SecretsSheet({ integration, onClose }: { integration: AdminIntegration; onClose: () => void }) {
  const save = useSaveSecrets();
  const [rows, setRows] = React.useState([{ key: "api_key", value: "" }]);
  const [errors, setErrors] = React.useState<FieldError[]>([]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const filled = rows.filter((r) => r.key.trim());
    const errs: FieldError[] = [];
    filled.forEach((r, i) => { if (!r.value) errs.push({ field: `secret-value-${i}`, message: `Verdi mangler for «${r.key}».` }); });
    if (!filled.length) errs.push({ field: "secret-key-0", message: "Legg inn minst én nøkkel." });
    setErrors(errs);
    if (errs.length) return;
    save.mutate({ name: integration.name, secrets: filled }, {
      onSuccess: onClose,
      onError: (err) => setErrors(err instanceof ApiError ? errorsFromApi(err.body) : [{ message: errorMessage(err) }]),
    });
  }

  return (
    <ResponsiveSheet
      open
      onOpenChange={(o) => !o && !save.isPending && onClose()}
      title={`Nøkler for ${integration.label}`}
      description="Lagres kryptert. Det som er lagret vises aldri igjen. Nye verdier erstatter de gamle."
      footer={<>
        <Button variant="ghost" className="min-h-11" onClick={onClose} disabled={save.isPending}>Avbryt</Button>
        <Button type="submit" form="secrets-form" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? "Lagrer…" : "Lagre nøkler"}
        </Button>
      </>}
    >
      <form id="secrets-form" onSubmit={submit} className="space-y-4" autoComplete="off">
        <FormErrorSummary errors={errors} />
        {rows.map((r, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`secret-key-${i}`}>Navn</Label>
              <Input id={`secret-key-${i}`} value={r.key} className="h-11 font-mono"
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`secret-value-${i}`}>Verdi</Label>
              <Input id={`secret-value-${i}`} type="password" value={r.value} className="h-11"
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            </div>
          </div>
        ))}
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setRows([...rows, { key: "", value: "" }])}>
          Legg til nøkkel
        </Button>
      </form>
    </ResponsiveSheet>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-[12.5px] tabular-nums ${tone ?? "text-foreground"}`}>{value}</dd>
    </div>
  );
}
