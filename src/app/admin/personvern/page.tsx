"use client";

import * as React from "react";
import { Download, Search } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { ConfirmStep } from "@/components/patterns/confirm-step";
import { FormErrorSummary, type FieldError } from "@/components/patterns/form-error-summary";
import { Mascot } from "@/components/patterns/mascot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api/client";
import { APP_LABEL, useEraseSubject, useExportSubject, usePrivacySubject, useRetentionRuns } from "@/lib/api/privacy";
import { formatDate, formatNumber } from "@/lib/format";
import { mascotFor } from "@/lib/use-mascot";

/**
 * IFK-02 — «Kandidaten kan be om innsyn og sletting, og admin kan gjennomføre det med ett
 * klikk». The person who asks gives a phone number or an e-mail; that is what the admin
 * searches by. Before anything is shown or removed, the page says WHERE the person appears
 * (counts per part of the system, never the content) — the content only leaves in the
 * export file. Deleting anonymises in every part at once and cannot be undone, so it takes
 * a reason, the word SLETT and 2FA. IFK-01's 3-year job is shown below, since the same
 * admin answers for both.
 */
export default function AdminPersonvern() {
  const [text, setText] = React.useState("");
  const [q, setQ] = React.useState<string | null>(null);
  const [inputError, setInputError] = React.useState<FieldError[]>([]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    const ok = v.includes("@") || v.replace(/[^\d]/g, "").length >= 8;
    setInputError(ok ? [] : [{ field: "person", message: "Skriv et telefonnummer (8 sifre) eller en e-postadresse." }]);
    if (ok) setQ(v);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Personvern"
        description="Innsyn og sletting når en kandidat ber om det, og sletting etter tre år"
        source="Rekrutteringstjenesten"
        lastUpdated={new Date()}
      />

      <section aria-labelledby="innsyn-h" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 id="innsyn-h" className="text-base font-medium">Innsyn og sletting</h2>
        <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="person">Telefonnummer eller e-post personen oppga</Label>
            <Input id="person" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
              inputMode="email" placeholder="912 34 567 eller navn@eksempel.no" className="h-11" />
          </div>
          <Button type="submit" className="min-h-11 gap-1.5"><Search className="size-4" aria-hidden /> Finn personen</Button>
        </form>
        <FormErrorSummary errors={inputError} title="Kan ikke søke" />
        {q && <SubjectResult key={q} q={q} />}
      </section>

      <RetentionSection />
    </div>
  );
}

function SubjectResult({ q }: { q: string }) {
  const subject = usePrivacySubject(q);
  const exportFile = useExportSubject();
  const erase = useEraseSubject();
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<FieldError[]>([]);

  return (
    <QueryBoundary
      query={subject}
      skeleton={<Skeleton className="h-40 rounded-lg" />}
      isEmpty={(s) => !s.found}
      emptyTitle="Fant ingen opplysninger om denne personen"
      emptyDescription="Ingen leads, kandidater eller meldinger er knyttet til nummeret eller adressen. Svar personen at vi ikke har lagret noe."
    >
      {(s) => erase.isSuccess ? (
        <div role="status" className="flex flex-col items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-3">
            <Mascot {...mascotFor("allDone")} size={56} />
            <p className="text-[15px] font-medium">Personopplysningene er slettet</p>
          </div>
          <ul className="text-[13.5px] text-muted-foreground">
            {erase.data.report.map((r) => <li key={r.app}>{APP_LABEL[r.app] ?? r.app}: {formatNumber(r.rows)} anonymisert</li>)}
          </ul>
          <p className="text-[12.5px] text-muted-foreground">Slettingen står i revisjonsloggen uten personens navn eller nummer.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-medium">Personen finnes her</p>
            <ul className="mt-1.5 grid gap-1 text-[13.5px] sm:grid-cols-2">
              {s.apps.filter((a) => a.items > 0).map((a) => (
                <li key={a.app} className="flex justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                  <span>{APP_LABEL[a.app] ?? a.app}</span>
                  <span className="tabular-nums text-muted-foreground">{formatNumber(a.items)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="min-h-11 gap-1.5" disabled={exportFile.isPending}
              onClick={() => exportFile.mutate(q, {
                onSuccess: ({ blob, filename }) => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = filename ?? "innsyn.zip";
                  a.click();
                  URL.revokeObjectURL(a.href);
                },
              })}>
              <Download className="size-4" aria-hidden /> {exportFile.isPending ? "Lager filen…" : "Last ned innsyn"}
            </Button>
            <span aria-live="polite" className="text-[13px]">
              {exportFile.isSuccess && <span className="text-success">Filen er lastet ned. Den slettes fra serveren etter 7 dager.</span>}
              {exportFile.isError && <span className="text-danger">{errorMessage(exportFile.error)}</span>}
            </span>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="reason">Begrunnelse for slettingen <span className="text-muted-foreground">(påkrevd)</span></Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="For eksempel: Kandidaten ba om sletting på e-post 22.10." className="min-h-16" />
            </div>
            <FormErrorSummary errors={reasonError} title="Kan ikke slette ennå" />
            <ConfirmStep
              trigger="Slett personopplysninger"
              consequence="Navn, telefon, e-post, svar, notater, vedlegg og meldinger anonymiseres i alle deler av systemet. Tellingene i dashboardet beholdes. Kan ikke angres."
              confirmLabel="Slett for godt"
              typeToConfirm="SLETT"
              pending={erase.isPending}
              onConfirm={() => {
                if (!reason.trim()) return setReasonError([{ field: "reason", message: "Skriv hvorfor personen slettes." }]);
                setReasonError([]);
                erase.mutate({ q, reason: reason.trim() });
              }}
            />
            {erase.isError && <p role="alert" className="text-sm text-danger">{errorMessage(erase.error)}</p>}
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

function RetentionSection() {
  const runs = useRetentionRuns();
  return (
    <section aria-labelledby="tre-ar-h" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="tre-ar-h" className="text-base font-medium">Sletting etter tre år</h2>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Kandidater som ikke ble ansatt, og som ikke har samtykket til lengre lagring, anonymiseres tre år etter siste aktivitet.
          Jobben går hver natt.
        </p>
      </div>
      <QueryBoundary query={runs} skeleton={<Skeleton className="h-28 rounded-lg" />} isEmpty={(r) => r.length === 0}
        emptyTitle="Jobben har ikke kjørt ennå" emptyDescription="Første kjøring skjer i natt. Rapporten vises her.">
        {(list) => {
          const last = list[0];
          return (
            <div className="flex flex-col gap-3">
              {last.dryRun && (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[13px] text-warning-on-tint">
                  <span className="font-medium">Tørrkjøring.</span> Jobben teller, men sletter ingenting før tolkningen er godkjent.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:flex sm:flex-wrap">
                <Field label="Siste kjøring" value={formatDate(last.startedAt)} />
                <Field label="Grense" value={`Aktivitet før ${formatDate(last.cutoff)}`} />
                <Field label={last.dryRun ? "Ville blitt slettet" : "Slettet"} value={formatNumber(last.dryRun ? last.found : last.anonymised)} />
              </dl>
              {last.perApp.length > 0 && (
                <ul className="text-[13px] text-muted-foreground">
                  {last.perApp.map((p) => <li key={p.app}>{APP_LABEL[p.app] ?? p.app}: {formatNumber(p.count)}</li>)}
                </ul>
              )}
              {last.error && <p role="alert" className="text-[13px] text-danger">Siste kjøring stoppet: {last.error}</p>}
            </div>
          );
        }}
      </QueryBoundary>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] tabular-nums">{value}</dd>
    </div>
  );
}
