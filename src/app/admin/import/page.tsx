"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  FileSpreadsheet,
  Inbox,
  RotateCcw,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useImportRuns,
  useRejectedRows,
  useImportCandidates,
  useImportPreview,
  useCommitImport,
  useResubmitRow,
  useImportInbox,
  useClaimInboxFile,
} from "@/lib/api/quality";
import { errorMessage } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { Roy } from "@/components/patterns/roy";
import { DUR, EASE_ENTER, enter, riseIn } from "@/lib/motion";
import type { ImportPreview, ImportRun, RejectedRow } from "@/types/quality";

/**
 * FR-I-01…05 — upload, review, commit.
 *
 * The screen previously had a drop zone and a run history with nothing between
 * them, which skipped the requirement that matters most: FR-I-02 says the
 * upload shows counts and validation errors **before committing**. Writing 845
 * rows into everyone's figures is not something to discover afterwards.
 *
 * So it is three explicit steps, and the step indicator is discrete rather than
 * a progress bar — the remaining work is a decision a person makes, not time
 * passing. Nothing is written until the last one; abandoning the review leaves
 * the data exactly as it was.
 *
 * Two things the preview deliberately surfaces that a silent importer would
 * swallow: a column present in the file that maps to nothing, and a period that
 * has already been imported (FR-I-03 — committing replaces that run rather than
 * adding a second one, so totals cannot double).
 */
type Step = "choose" | "review" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "choose", label: "Velg fil" },
  { key: "review", label: "Gjennomgå" },
  { key: "done", label: "Fullfør" },
];

export default function AdminImport() {
  const now = new Date();
  const reduced = useReducedMotion();
  const runs = useImportRuns();
  const rejected = useRejectedRows();
  const candidates = useImportCandidates();
  const inbox = useImportInbox();
  const claim = useClaimInboxFile();
  const preview = useImportPreview();
  const commit = useCommitImport();

  const [step, setStep] = React.useState<Step>("choose");
  const [data, setData] = React.useState<ImportPreview | null>(null);
  const [committed, setCommitted] = React.useState<ImportRun | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  function choose(file: string) {
    setFailed(null);
    preview.mutate(
      { file },
      {
        onSuccess: (p) => {
          setData(p);
          setStep("review");
        },
        onError: (e) => setFailed(errorMessage(e)),
      },
    );
  }

  function reset() {
    setStep("choose");
    setData(null);
    setCommitted(null);
    setFailed(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Import"
        description="Last opp Dashboard.xlsx, se konsekvensen, og skriv den så"
        source="Manuell opplasting"
        lastUpdated={now}
      />

      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {failed}
        </p>
      )}

      {/* FR-I-08 — automated ingestion. A file that arrived on its own goes
          through exactly the same review and commit; the only difference is who
          put it in the queue. Anything else would be a second, unreviewed path
          into everyone's figures. */}
      <QueryBoundary query={inbox} skeleton={<Skeleton className="h-10 rounded-lg" />}>
        {(files) => {
          const waiting = files.filter((f) => f.status === "awaiting-review");
          if (waiting.length === 0) return <></>;
          return (
            <section className="flex flex-col gap-3 rounded-xl border border-[var(--ab-accent-9)]/30 bg-[var(--ab-accent-9)]/[0.06] px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Inbox className="size-4 text-[var(--ab-accent-11)]" aria-hidden />
                <p className="text-[13.5px] text-foreground">
                  {waiting.length === 1
                    ? "Én fil er mottatt automatisk og venter på gjennomgang."
                    : `${waiting.length} filer er mottatt automatisk og venter på gjennomgang.`}
                </p>
              </div>
              <p className="text-[12.5px] text-muted-foreground">
                Ingenting skrives automatisk. Filen går gjennom den samme gjennomgangen som en du
                laster opp selv.
              </p>
              <ul className="flex flex-col gap-2">
                {waiting.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] text-foreground">{f.file}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                        {f.period} · {f.source} · mottatt {f.arrivedAt}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={preview.isPending}
                      onClick={() => {
                        claim.mutate({ id: f.id });
                        choose(f.file);
                      }}
                    >
                      Gjennomgå
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          );
        }}
      </QueryBoundary>

      <Stepper current={step} />

      <div className="rounded-xl border border-border bg-card">
        <AnimatePresence mode="wait" initial={false}>
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: DUR.base, ease: EASE_ENTER }}
            >
              <QueryBoundary
                query={candidates}
                skeleton={<Skeleton className="m-5 h-40 rounded-lg" />}
                isEmpty={(d) => d.length === 0}
                emptyTitle="Ingen filer tilgjengelig"
              >
                {(files) => (
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-5 py-7 text-center">
                      <Upload className="size-5 text-muted-foreground" aria-hidden />
                      <p className="text-[13.5px] text-foreground">Dra og slipp Dashboard.xlsx her</p>
                      <p className="text-[12.5px] text-muted-foreground">
                        I demoen velger du en av filene under.
                      </p>
                    </div>

                    <ul className="flex flex-col gap-2">
                      {files.map((f, i) => (
                        <motion.li key={f.file} {...riseIn(i, reduced)}>
                          <button
                            type="button"
                            disabled={preview.isPending}
                            onClick={() => choose(f.file)}
                            className="group flex w-full items-center gap-3.5 rounded-lg border border-border px-4 py-3 text-left transition-colors duration-[120ms] hover:border-[var(--ab-accent-9)]/45 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                          >
                            <FileSpreadsheet
                              className="size-4 shrink-0 text-muted-foreground transition-colors duration-[120ms] group-hover:text-[var(--ab-accent-11)]"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] text-foreground">
                                {f.file}
                              </span>
                              <span
                                className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground"
                                title={`${f.period} · ${f.label}`}
                              >
                                {f.period} · {f.label}
                              </span>
                            </span>
                            <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                              {preview.isPending ? "Leser…" : "Les inn"}
                            </span>
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}
              </QueryBoundary>
            </motion.div>
          )}

          {step === "review" && data && (
            <motion.div
              key="review"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
              transition={{ duration: DUR.base, ease: EASE_ENTER }}
            >
              <Review
                data={data}
                pending={commit.isPending}
                onBack={reset}
                onCommit={() => {
                  setFailed(null);
                  commit.mutate(
                    { file: data.file },
                    {
                      onSuccess: (r) => {
                        setCommitted(r);
                        setStep("done");
                      },
                      onError: (e) => setFailed(errorMessage(e)),
                    },
                  );
                }}
              />
            </motion.div>
          )}

          {step === "done" && committed && (
            <motion.div
              key="done"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.base, ease: EASE_ENTER }}
              className="flex flex-col items-start gap-4 p-6"
            >
              {/* A completed import is the system reporting on itself — no
                  individual's performance is on this screen — so a small
                  acknowledgement is warmth rather than a mechanic. */}
              <div className="flex items-center gap-3">
                <Roy state="win-small" size={44} />
                <span className="flex size-10 items-center justify-center rounded-full bg-success/12 text-success">
                  <Check className="size-5" aria-hidden />
                </span>
              </div>
              <div>
                <p className="text-[15px] text-foreground">Importen er skrevet.</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {committed.file} · {committed.period} ·{" "}
                  <span className="font-mono tabular-nums">{formatNumber(committed.accepted)}</span>{" "}
                  rader godkjent
                  {committed.rejected > 0 && (
                    <>
                      ,{" "}
                      <span className="font-mono tabular-nums">
                        {formatNumber(committed.rejected)}
                      </span>{" "}
                      avvist og lagt i køen under
                    </>
                  )}
                  .
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={reset}>
                Importer en fil til
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FR-I-04 — run history. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-medium text-foreground">Kjørehistorikk</h2>
        <QueryBoundary
          query={runs}
          skeleton={<Skeleton className="h-40 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen kjøringer ennå"
          emptyDescription="Historikken fylles når du har importert en fil."
        >
          {(list) => (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {list.map((r, i) => (
                <motion.li
                  key={r.id}
                  {...riseIn(i, reduced)}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-foreground">{r.file}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                      {r.period} · {formatNumber(r.accepted)} godkjent, {formatNumber(r.rejected)}{" "}
                      avvist · {r.runBy} · {r.runAt}
                    </p>
                  </div>
                  <RunStatus status={r.status} />
                </motion.li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </section>

      {/* FR-I-05 — the rejected-row queue, with a route back in. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-medium text-foreground">Avviste rader</h2>
        <QueryBoundary
          query={rejected}
          skeleton={<Skeleton className="h-32 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen avviste rader"
          emptyDescription="Alle rader fra siste import gikk gjennom valideringen."
        >
          {(rows) => <RejectedQueue rows={rows} />}
        </QueryBoundary>
      </section>
    </div>
  );
}

/**
 * Discrete steps, not a progress bar. Carbon's rule: a bar implies time
 * passing, and what remains here is a person deciding.
 */
function Stepper({ current }: { current: Step }) {
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map((s, i) => {
        const state = i < index ? "done" : i === index ? "current" : "todo";
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums transition-colors duration-[200ms] ${
                state === "done"
                  ? "border-[var(--ab-accent-9)]/45 bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]"
                  : state === "current"
                    ? "border-[var(--ab-accent-9)] bg-[var(--ab-accent-9)] text-[var(--primary-foreground)]"
                    : "border-border text-muted-foreground"
              }`}
            >
              {state === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={`text-[13px] ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 hidden h-px w-8 bg-border sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Review({
  data,
  pending,
  onBack,
  onCommit,
}: {
  data: ImportPreview;
  pending: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  const reduced = useReducedMotion();
  const unmapped = data.columns.filter((c) => !c.target);

  return (
    <div className="flex flex-col gap-5 p-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded text-[13px] text-muted-foreground sm:min-h-6 transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Velg en annen fil
      </button>

      <div>
        <p className="text-[15px] text-foreground">{data.file}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {data.period} · {formatNumber(data.totalRows)} rader lest · ingenting er skrevet ennå
        </p>
      </div>

      {/* FR-I-03 — the duplicate warning, stated before the button. */}
      {data.duplicateOf && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.07] px-3.5 py-2.5 text-[13px] text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>
            {data.period} er allerede importert fra{" "}
            <span className="font-mono">{data.duplicateOf}</span>. Denne kjøringen{" "}
            <strong className="font-medium">erstatter</strong> den forrige, så tallene blir ikke
            telt to ganger.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Count label="Rader lest" value={data.totalRows} />
        <Count label="Godkjennes" value={data.accepted} tone="text-success" />
        <Count
          label="Avvises"
          value={data.rejected}
          tone={data.rejected > 0 ? "text-danger" : undefined}
        />
      </div>

      {/* The column map. An unmapped column is the failure a silent importer
          hides — the data simply never arrives and nobody is told. */}
      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
          Kolonnekobling
        </h3>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {data.columns.map((c) => (
            <li
              key={c.source}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${
                c.target
                  ? "border-border text-muted-foreground"
                  : "border-warning/35 bg-warning/10 text-warning"
              }`}
            >
              {c.source}
              <span aria-hidden> → </span>
              {c.target ?? "ikke koblet"}
            </li>
          ))}
        </ul>
        {unmapped.length > 0 && (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            {unmapped.length === 1 ? "Én kolonne" : `${unmapped.length} kolonner`} i filen kobles
            ikke til noe felt og blir ikke importert.
          </p>
        )}
      </section>

      {/* FR-I-02 — every validation error, with its row. */}
      {data.errors.length > 0 && (
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            Valideringsfeil
          </h3>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {data.errors.map((e, i) => (
              <motion.li
                key={e.row}
                {...riseIn(i, reduced)}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-2.5"
              >
                <CircleAlert className="size-3.5 shrink-0 self-center text-danger" aria-hidden />
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  Rad {e.row}
                </span>
                <span className="text-[13px] text-foreground">{e.ref}</span>
                <span className="text-[12.5px] text-muted-foreground">{e.reason}</span>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" disabled={pending} onClick={onCommit}>
          {pending
            ? "Skriver…"
            : data.duplicateOf
              ? `Erstatt ${data.period}`
              : `Skriv ${formatNumber(data.accepted)} rader`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onBack} disabled={pending}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

function RejectedQueue({ rows }: { rows: RejectedRow[] }) {
  const reduced = useReducedMotion();
  const resubmit = useResubmitRow();
  const [busy, setBusy] = React.useState<string | null>(null);

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <AnimatePresence initial={false}>
        {rows.map((r, i) => (
          <motion.li
            key={r.id}
            layout
            {...riseIn(i, reduced)}
            exit={{ opacity: 0, height: 0 }}
            transition={enter}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 overflow-hidden px-5 py-3.5"
          >
            <div className="min-w-0">
              <p className="text-[13.5px] text-foreground">
                Rad {r.row} — {r.person}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.reason}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy === r.id}
              onClick={() => {
                setBusy(r.id);
                resubmit.mutate({ id: r.id }, { onSettled: () => setBusy(null) });
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {busy === r.id ? "Sender…" : "Send inn på nytt"}
            </Button>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-mono text-[24px] leading-none tabular-nums ${tone ?? "text-foreground"}`}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

function RunStatus({ status }: { status: ImportRun["status"] }) {
  const map = {
    success: { label: "Vellykket", cls: "border-success/30 bg-success/10 text-success" },
    partial: { label: "Delvis", cls: "border-warning/35 bg-warning/10 text-warning" },
    failed: { label: "Feilet", cls: "border-danger/30 bg-danger/10 text-danger" },
  } as const;
  const s = map[status];
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

