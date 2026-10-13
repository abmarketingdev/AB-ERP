"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ChevronRight, FlaskConical, Lock, LockOpen, Search, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpiDefinitions, useDefinitionImpact } from "@/lib/api/quality";
import { errorMessage } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { splitDiff } from "@/lib/diff";
import { DUR, EASE_ENTER, enter, expand, riseIn } from "@/lib/motion";
import type { KpiDefinition } from "@/types/quality";

/**
 * FR-K-01…05 — the KPI dictionary.
 *
 * Doc 01 specifies "list left, detail right", and the reason is the job: you
 * arrive knowing which definition you want to check, and the previous flat
 * stack of eight tall cards made that a 1 500-pixel scroll. Master-detail turns
 * it into one click.
 *
 * On a phone the same structure becomes list *then* detail with a back control,
 * rather than a two-pane layout squeezed to 390px. Sliding the detail in from
 * the right and back out to the right is the whole navigation model made
 * visible — the direction says "deeper" and "back" without a word of copy.
 *
 * The addition the screen was missing is FR-K-03: version history with a real
 * diff. A version list showing only numbers and dates is a changelog nobody can
 * check; what a reader needs is which words changed, because the figures in
 * every past report were computed under the old wording.
 */
export default function AdminKpiOrdbok() {
  const now = new Date();
  const reduced = useReducedMotion();
  const defs = useKpiDefinitions();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="KPI-ordbok"
        description="Definisjoner, versjoner og hvem som bruker dem"
        source="KPI-ordbok"
        lastUpdated={now}
      />

      <QueryBoundary
        query={defs}
        skeleton={<Skeleton className="h-96 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen definisjoner"
        className="flex flex-1 flex-col gap-4"
      >
        {(list) => {
          const needle = q.trim().toLowerCase();
          const matches = needle
            ? list.filter(
                (d) =>
                  d.name.toLowerCase().includes(needle) ||
                  d.rule.toLowerCase().includes(needle) ||
                  d.owner.toLowerCase().includes(needle),
              )
            : list;
          const selected = matches.find((d) => d.id === selectedId) ?? null;
          const unlocked = list.filter((d) => !d.locked).length;

          return (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Søk i definisjoner…"
                    aria-label="Søk i definisjoner"
                    className="pl-9"
                  />
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  <span className="font-mono tabular-nums text-foreground">{list.length}</span>{" "}
                  definisjoner ·{" "}
                  <span className="font-mono tabular-nums text-foreground">{unlocked}</span> ikke
                  låst
                </p>
              </div>

              {matches.length === 0 ? (
                <EmptyState
                  title="Ingen definisjoner matcher søket"
                  description="Prøv et KPI-navn, et ord fra regelen eller en eier."
                  mascot="thinking"
                />
              ) : (
                <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
                  {/* Master. Hidden on mobile once a definition is open, so the
                      phone gets one screen at a time instead of a squeezed pane. */}
                  <ul
                    className={`flex-col gap-1 self-start rounded-xl border border-border bg-card p-2 ${
                      selected ? "hidden lg:flex" : "flex"
                    }`}
                    aria-label="KPI-definisjoner"
                  >
                    {matches.map((d, i) => (
                      <motion.li key={d.id} {...riseIn(i, reduced)}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(d.id)}
                          aria-pressed={selected?.id === d.id}
                          className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected?.id === d.id
                              ? "bg-[var(--ab-accent-9)]/12 ring-1 ring-[var(--ab-accent-9)]/30"
                              : "hover:bg-secondary/60"
                          }`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13.5px] text-foreground">{d.name}</span>
                              <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                                {d.version}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground">
                              {d.locked ? "Låst" : "Ikke låst"} · {d.owner}
                            </span>
                          </span>
                          <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground transition-transform duration-[120ms] group-hover:translate-x-0.5 lg:hidden"
                            aria-hidden
                          />
                        </button>
                      </motion.li>
                    ))}
                  </ul>

                  {/* Detail. */}
                  <AnimatePresence mode="wait" initial={false}>
                    {selected ? (
                      <Detail
                        key={selected.id}
                        definition={selected}
                        onBack={() => setSelectedId(null)}
                      />
                    ) : (
                      <motion.div
                        key="none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={enter}
                        className="hidden items-center justify-center rounded-xl border border-dashed border-border p-10 lg:flex"
                      >
                        <p className="text-[13px] text-muted-foreground">
                          Velg en definisjon for å se regel, versjonshistorikk og hvem som bruker den.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <p className="font-mono text-[10.5px] text-muted-foreground">
                En låst definisjon kan ikke endres uten ny versjon · endringer gjelder tilbake i tid
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Detail({ definition, onBack }: { definition: KpiDefinition; onBack: () => void }) {
  const reduced = useReducedMotion();
  const [locking, setLocking] = React.useState(false);
  const [compareTo, setCompareTo] = React.useState<string | null>(null);

  const previous = definition.history[1] ?? null;
  const comparing = definition.history.find((h) => h.version === compareTo) ?? null;

  return (
    <motion.div
      // Deeper goes left-to-right; back reverses it. On desktop the pane only
      // fades, because nothing moved spatially there.
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
      transition={{ duration: DUR.base, ease: EASE_ENTER }}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded text-[13px] text-muted-foreground sm:min-h-6 transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Alle definisjoner
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-baseline gap-2 text-[19px] text-foreground">
            {definition.name}
            <span className="font-mono text-[13px] text-muted-foreground">
              {definition.version}
            </span>
          </h2>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">{definition.rule}</p>
        </div>
        <LockChip locked={definition.locked} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-4 sm:grid-cols-4">
        <Cell label="Eier" value={definition.owner} />
        <Cell label="Gjelder fra" value={definition.effectiveFrom} />
        {/* FR-K-02 — who locked it and when. A locked definition is somebody's
            decision, and the person who has to live with it gets to see whose. */}
        <Cell label="Låst av" value={definition.lockedBy ?? "—"} />
        <Cell label="Låst" value={definition.lockedAt ?? "—"} />
      </dl>

      {/* FR-K-04 — which screens consume it. Stated plainly, because this is the
          list you check before changing a rule. */}
      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
          Brukes av
        </h3>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {definition.consumers.map((c) => (
            <li
              key={c}
              className="rounded-full border border-border px-2.5 py-1 text-[12px] text-foreground"
            >
              {c}
            </li>
          ))}
        </ul>
      </section>

      {/* FR-K-03 — version history, with the diff that makes it checkable. */}
      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
          Versjonshistorikk
        </h3>
        <ol className="mt-2.5 flex flex-col">
          {definition.history.map((h, i) => {
            const isCurrent = i === 0;
            const older = definition.history[i + 1];
            const open = compareTo === h.version;
            return (
              <li key={h.version} className="relative flex gap-3 pb-3 last:pb-0">
                <div className="relative flex w-4 shrink-0 flex-col items-center pt-1.5">
                  <span
                    className={`z-10 size-2 rounded-full ${
                      isCurrent ? "bg-[var(--ab-accent-9)]" : "bg-border"
                    }`}
                  />
                  {i < definition.history.length - 1 && (
                    <span className="absolute bottom-0 top-3.5 w-px bg-border" aria-hidden />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <span className="font-mono text-foreground">{h.version}</span>
                    {isCurrent && (
                      <span className="rounded border border-[var(--ab-accent-9)]/35 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ab-accent-11)]">
                        Gjeldende
                      </span>
                    )}
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {h.at} · {h.by}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{h.note}</p>

                  {older && (
                    <button
                      type="button"
                      onClick={() => setCompareTo(open ? null : h.version)}
                      aria-expanded={open}
                      className="mt-1.5 inline-flex min-h-11 items-center rounded text-[12px] text-[var(--ab-accent-11)] sm:min-h-6 underline decoration-[var(--ab-accent-9)]/40 underline-offset-4 transition-colors duration-[120ms] hover:decoration-[var(--ab-accent-9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {open ? "Skjul endring" : `Vis endring fra ${older.version}`}
                    </button>
                  )}

                  <AnimatePresence initial={false}>
                    {open && older && (
                      <motion.div {...expand(reduced)} className="overflow-hidden">
                        <RuleDiff before={older.rule} after={h.rule} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ol>
        {previous && !comparing && (
          <p className="sr-only">
            Gjeldende regel: {definition.rule}. Forrige versjon {previous.version}:{" "}
            {previous.rule}.
          </p>
        )}
      </section>

      {/* FR-K-06 — see the damage before deciding. */}
      <ChangePreview definition={definition} />

      {/* FR-K-05 — locking is deliberate, takes a note, and warns about the past. */}
      {!definition.locked && (
        <div className="border-t border-border pt-4">
          <AnimatePresence initial={false} mode="wait">
            {locking ? (
              <motion.div key="form" {...expand(reduced)} className="overflow-hidden">
                <LockForm name={definition.name} onCancel={() => setLocking(false)} />
              </motion.div>
            ) : (
              <motion.div key="cta" initial={false} animate={{ opacity: 1 }}>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLocking(true)}>
                  <Lock className="size-3.5" aria-hidden />
                  Lås definisjon
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

/**
 * FR-K-06 — dry-run a proposed rule change against periods already reported.
 *
 * This is what turns "locking applies retroactively" from a warning into a
 * number. The warning on the lock form tells you the past will move; this tells
 * you *by how much, for whom, and whether it was already sent to a customer* —
 * which is the only version of that sentence anyone can act on.
 *
 * Nothing here writes. It is a calculation, and abandoning it costs nothing.
 */
function ChangePreview({ definition }: { definition: KpiDefinition }) {
  const reduced = useReducedMotion();
  const impact = useDefinitionImpact();
  const [open, setOpen] = React.useState(false);
  const [proposal, setProposal] = React.useState("");
  const [failed, setFailed] = React.useState<string | null>(null);

  const changed = proposal.trim() && proposal.trim() !== definition.rule;

  return (
    <section className="border-t border-border pt-4">
      {!open ? (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            setOpen(true);
            setProposal(definition.rule);
            setFailed(null);
          }}
        >
          <FlaskConical className="size-3.5" aria-hidden />
          Test en endring mot tidligere perioder
        </Button>
      ) : (
        <motion.div {...expand(reduced)} className="overflow-hidden">
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor={`proposal-${definition.id}`}
                className="block text-[12px] text-muted-foreground"
              >
                Forslag til ny regeltekst
              </label>
              <Textarea
                id={`proposal-${definition.id}`}
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                className="mt-1.5 min-h-16 text-sm"
                autoFocus
              />
              {changed && (
                <div className="mt-2">
                  <RuleDiff before={definition.rule} after={proposal.trim()} />
                </div>
              )}
            </div>

            {failed && (
              <p className="text-[12.5px] text-danger" role="alert">
                {failed}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!changed || impact.isPending}
                onClick={() => {
                  setFailed(null);
                  impact.mutate(
                    { id: definition.id, proposal: proposal.trim() },
                    { onError: (e) => setFailed(errorMessage(e)) },
                  );
                }}
              >
                {impact.isPending ? "Regner om…" : "Vis konsekvens"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  impact.reset();
                }}
              >
                Lukk
              </Button>
            </div>

            {impact.data && (
              <motion.div {...expand(reduced)} className="overflow-hidden">
                <ul className="flex flex-col gap-2">
                  {impact.data.map((r) => {
                    const delta = r.proposedValue - r.currentValue;
                    return (
                      <li
                        key={r.period}
                        className="rounded-lg border border-border bg-secondary/30 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <p className="text-[13.5px] text-foreground">{r.period}</p>
                          <p className="font-mono text-[12.5px] tabular-nums">
                            <span className="text-muted-foreground line-through">
                              {formatNumber(r.currentValue)}
                            </span>
                            <span aria-hidden> → </span>
                            <span className="text-foreground">
                              {formatNumber(r.proposedValue)}
                            </span>
                            <span className="ml-1.5 text-muted-foreground">
                              ({delta > 0 ? "+" : ""}
                              {formatNumber(delta)} {r.unit})
                            </span>
                          </p>
                        </div>
                        <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                          {r.affectedPeople} personer får endret tall
                          {r.examples.length > 0 && (
                            <>
                              {" — f.eks. "}
                              {r.examples
                                .map((e) => `${e.name} ${e.from} → ${e.to}`)
                                .join(", ")}
                            </>
                          )}
                          .
                        </p>
                        {r.affectedCustomerReports.length > 0 && (
                          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-warning/35 bg-warning/10 px-2.5 py-0.5 text-[11.5px] text-warning">
                            <TriangleAlert className="size-3" aria-hidden />
                            Allerede sendt til kunde: {r.affectedCustomerReports.join(", ")}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
                  Ingenting er endret — dette er kun en beregning
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </section>
  );
}

function RuleDiff({ before, after }: { before: string; after: string }) {
  const { before: b, after: a } = splitDiff(before, after);
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3.5 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.09em] text-muted-foreground">
        Endring i regelteksten
      </p>
      <dl className="mt-2 flex flex-col gap-1.5 text-[13px] leading-relaxed">
        <div className="flex gap-2.5">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            Før
          </dt>
          <dd className="whitespace-pre-wrap text-muted-foreground">
            {b.map((p, i) =>
              p.kind === "removed" ? (
                <span key={i} className="rounded bg-danger/12 text-danger line-through decoration-danger/50">
                  {p.text}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </dd>
        </div>
        <div className="flex gap-2.5">
          <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            Etter
          </dt>
          <dd className="whitespace-pre-wrap text-foreground">
            {a.map((p, i) =>
              p.kind === "added" ? (
                <span key={i} className="rounded bg-success/15 text-success">
                  {p.text}
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </dd>
        </div>
      </dl>
      {/* Colour alone never carries it — WCAG 1.4.1. */}
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        Gjennomstreket = fjernet · uthevet = lagt til
      </p>
    </div>
  );
}

function LockForm({ name, onCancel }: { name: string; onCancel: () => void }) {
  const [note, setNote] = React.useState("");
  const [done, setDone] = React.useState(false);

  if (done) {
    return (
      <p className="rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13px] text-success">
        {name} er låst. Endringer krever nå en ny versjon.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/[0.07] px-4 py-3.5">
      <p className="flex items-start gap-2 text-[13.5px] text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          Å låse {name} gjelder <strong className="font-medium">tilbake i tid</strong>. Alle
          historiske perioder blir regnet om etter denne definisjonen, og tall som allerede er
          rapportert til kunder kan endre seg.
        </span>
      </p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notat: hvorfor låses definisjonen nå? (påkrevd)"
        aria-label="Notat"
        className="mt-3 min-h-16 text-sm"
        autoFocus
      />
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" disabled={!note.trim()} onClick={() => setDone(true)}>
          Lås definisjonen
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

function LockChip({ locked }: { locked: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
        locked
          ? "border-border bg-secondary text-muted-foreground"
          : "border-warning/35 bg-warning/10 text-warning"
      }`}
    >
      {locked ? <Lock className="size-3" aria-hidden /> : <LockOpen className="size-3" aria-hidden />}
      {locked ? "Låst" : "Ikke låst"}
    </span>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
