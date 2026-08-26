"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, TriangleAlert, Users, X } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePendingCorrections,
  useDecidedCorrections,
  useDecideCorrection,
} from "@/lib/api/quality";
import { errorMessage } from "@/lib/api/client";
import { enter, expand, riseIn } from "@/lib/motion";
import type { DecidedCorrection, PendingCorrection } from "@/types/quality";

/**
 * FR-I-06 / FR-I-07 — the correction cascade, made operable.
 *
 * The impact used to sit behind a "Se konsekvens" button. That is exactly
 * backwards: FR-I-06 says a pending correction shows what it will affect
 * *before* it commits, and hiding it behind a click makes seeing the
 * consequence the optional path. It is now open by default on the first
 * pending item and one tap away on the rest.
 *
 * The layout is doc 01's, verbatim — Perioder, KPIer, Personer,
 * Kunderapporter — because that is the order the question gets asked in: which
 * periods move, which figures move, whose numbers move, and did we already send
 * this to a customer. The last one is the one people forget.
 *
 * Both outcomes take a note. A rejection with no recorded why is the one an
 * auditor asks about a year later, and the screen that made it easy to skip is
 * the reason there is no answer.
 */
export default function AdminKorrigeringer() {
  const now = new Date();
  const reduced = useReducedMotion();
  const pending = usePendingCorrections();
  const decided = useDecidedCorrections();
  const decide = useDecideCorrection();

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [deciding, setDeciding] = React.useState<{ id: string; outcome: "approved" | "rejected" } | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [showDecided, setShowDecided] = React.useState(false);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Korrigeringer"
        description="Se hele konsekvensen før en korrigering skrives"
        source="Kvalitetskontroll"
        lastUpdated={now}
      />

      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {failed}
        </p>
      )}

      <QueryBoundary
        query={pending}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen korrigeringer venter"
        emptyDescription="Foreslåtte korrigeringer fra kvalitetskontrollen dukker opp her."
        className="flex flex-col gap-4"
      >
        {(list) => {
          /*
           * The one that opens by default is the one with the most at stake,
           * not the one that happens to be first.
           *
           * A correction that moves figures inside the company can be undone
           * quietly. One that moves figures a customer has already been sent
           * cannot — somebody has to tell them. Opening the first card meant
           * the higher-consequence item sat collapsed underneath it, which is
           * precisely backwards on a screen whose whole purpose is "see the
           * consequence before you write".
           */
          const consequential = list.findIndex((c) => c.affectedCustomerReports.length > 0);
          const defaultOpen = consequential >= 0 ? consequential : 0;
          return (
          <>
            <p className="text-[13px] text-muted-foreground">
              <span className="font-mono tabular-nums text-foreground">{list.length}</span>{" "}
              {list.length === 1 ? "korrigering venter" : "korrigeringer venter"} på godkjenning.
              Ingenting skrives før du bestemmer deg.
            </p>

            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {list.map((c, i) => (
                  <motion.li
                    key={c.id}
                    layout
                    {...riseIn(i, reduced)}
                    exit={{ opacity: 0, height: 0, marginBottom: -12 }}
                    transition={enter}
                    className="overflow-hidden"
                  >
                    <PendingCard
                      correction={c}
                      // The first one arrives open: the consequence is the point
                      // of the screen, not a detail to go looking for.
                      expanded={openId === null ? i === defaultOpen : openId === c.id}
                      deciding={deciding?.id === c.id ? deciding.outcome : null}
                      pendingWrite={decide.isPending}
                      onToggle={() => setOpenId(openId === c.id ? "__none__" : c.id)}
                      onAsk={(outcome) => {
                        setFailed(null);
                        setDeciding({ id: c.id, outcome });
                      }}
                      onCancel={() => setDeciding(null)}
                      onConfirm={(note) => {
                        setFailed(null);
                        decide.mutate(
                          { id: c.id, outcome: deciding!.outcome, note },
                          {
                            onSuccess: () => setDeciding(null),
                            onError: (e) => setFailed(errorMessage(e)),
                          },
                        );
                      }}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </>
        );
        }}
      </QueryBoundary>

      {/* The record. FR-I-07 keeps the decision, not only its effect. */}
      <QueryBoundary query={decided} skeleton={<Skeleton className="h-10 rounded-lg" />}>
        {(rows) =>
          rows.length === 0 ? (
            <></>
          ) : (
            <section>
              <button
                type="button"
                onClick={() => setShowDecided((v) => !v)}
                aria-expanded={showDecided}
                className="flex min-h-11 items-center gap-1.5 rounded text-[13px] text-muted-foreground sm:min-h-6 transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  className={`size-4 transition-transform duration-[200ms] ${showDecided ? "rotate-180" : ""}`}
                />
                Behandlede korrigeringer ({rows.length})
              </button>
              <AnimatePresence initial={false}>
                {showDecided && (
                  <motion.ul {...expand(reduced)} className="mt-3 flex flex-col gap-2.5 overflow-hidden">
                    {rows.map((r) => (
                      <li key={r.id}>
                        <DecidedCard correction={r} />
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          )
        }
      </QueryBoundary>

      <p className="font-mono text-[10.5px] text-muted-foreground">
        Godkjenning skriver om tallene uten å slette det forrige (FR-Q-03) · både godkjenning og
        avvisning logges med begrunnelse, tidspunkt, før- og etterverdi og hvem som bestemte
      </p>
    </div>
  );
}

function PendingCard({
  correction,
  expanded,
  deciding,
  pendingWrite,
  onToggle,
  onAsk,
  onCancel,
  onConfirm,
}: {
  correction: PendingCorrection;
  expanded: boolean;
  deciding: "approved" | "rejected" | null;
  pendingWrite: boolean;
  onToggle: () => void;
  onAsk: (outcome: "approved" | "rejected") => void;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[14.5px] break-words text-foreground">{correction.description}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            Foreslått av {correction.requestedBy} · {correction.requestedAt}
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{correction.reason}</p>
          {correction.affectedCustomerReports.length > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-warning/35 bg-warning/10 px-2.5 py-0.5 text-[11.5px] text-warning">
              <TriangleAlert className="size-3" aria-hidden />
              Påvirker {correction.affectedCustomerReports.length === 1 ? "en kunderapport" : `${correction.affectedCustomerReports.length} kunderapporter`} som allerede er sendt
            </p>
          )}
        </div>

        {/* Before → after, up front. It is the whole change in six characters. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 font-mono text-[12px] tabular-nums sm:shrink-0 sm:flex-nowrap">
          <span className="text-muted-foreground line-through">{correction.before}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-foreground">{correction.after}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center gap-1.5 border-t border-border px-5 py-2.5 text-left font-mono text-[10px] sm:min-h-6 uppercase tracking-[0.09em] text-muted-foreground transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown
          className={`size-3.5 transition-transform duration-[200ms] ${expanded ? "rotate-180" : ""}`}
        />
        Påvirker
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div {...expand(reduced)} className="overflow-hidden">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
              <Impact label="Perioder" items={correction.affectedPeriods} />
              <Impact label="KPIer" items={correction.affectedKpis} />
              <Impact label="Personer" items={correction.affectedPeople} icon />
              <Impact
                label="Kunderapporter"
                items={correction.affectedCustomerReports}
                warn="Allerede sendt til kunde"
              />
            </dl>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {deciding ? (
          <motion.div key="decide" {...expand(reduced)} className="overflow-hidden">
            <DecisionForm
              outcome={deciding}
              correction={correction}
              pending={pendingWrite}
              onCancel={onCancel}
              onConfirm={onConfirm}
            />
          </motion.div>
        ) : (
          <motion.div key="actions" initial={false} animate={{ opacity: 1 }}>
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3.5">
              <Button size="sm" className="gap-1.5" onClick={() => onAsk("approved")}>
                <Check className="size-3.5" aria-hidden />
                Godkjenn
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAsk("rejected")}>
                <X className="size-3.5" aria-hidden />
                Avvis
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DecisionForm({
  outcome,
  correction,
  pending,
  onCancel,
  onConfirm,
}: {
  outcome: "approved" | "rejected";
  correction: PendingCorrection;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = React.useState("");
  const approving = outcome === "approved";

  return (
    <div className="border-t border-border bg-secondary/40 px-5 py-4">
      <p className="text-[13.5px] text-foreground">
        {approving ? "Godkjenn korrigeringen?" : "Avvis korrigeringen?"}
      </p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {approving ? (
          <>
            Tallene regnes om for {correction.affectedPeriods.join(", ")}. Den forrige verdien
            slettes ikke, og {correction.affectedPeople.length === 1 ? "personen" : "personene"} får
            en melding om hva som ble endret.
            {correction.affectedCustomerReports.length > 0 && (
              <> Kunderapporten {correction.affectedCustomerReports.join(", ")} oppdateres også.</>
            )}
          </>
        ) : (
          <>Ingenting endres. Forslaget arkiveres med begrunnelsen din.</>
        )}
      </p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={approving ? "Hvorfor godkjennes den? (påkrevd)" : "Hvorfor avvises den? (påkrevd)"}
        aria-label="Begrunnelse"
        className="mt-2.5 min-h-16 text-sm"
        autoFocus
      />
      <div className="mt-2.5 flex gap-2">
        <Button
          size="sm"
          variant={approving ? "default" : "destructive"}
          disabled={!note.trim() || pending}
          onClick={() => onConfirm(note.trim())}
        >
          {pending ? "Lagrer…" : approving ? "Godkjenn korrigering" : "Avvis korrigering"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Avbryt
        </Button>
      </div>
    </div>
  );
}

function DecidedCard({ correction }: { correction: DecidedCorrection }) {
  const approved = correction.outcome === "approved";
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] text-foreground">{correction.description}</p>
          <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
            {approved ? "Godkjent" : "Avvist"} av {correction.decidedBy} · {correction.decidedAt}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            approved
              ? "border-success/30 bg-success/10 text-success"
              : "border-border text-muted-foreground"
          }`}
        >
          {approved ? "Godkjent" : "Avvist"}
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        <span className="font-mono text-[10px] uppercase tracking-[0.09em]">Begrunnelse</span>{" "}
        {correction.decisionNote}
      </p>
    </div>
  );
}

function Impact({
  label,
  items,
  icon,
  warn,
}: {
  label: string;
  items: string[];
  icon?: boolean;
  warn?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {icon && <Users className="size-3" aria-hidden />}
        {label}
      </dt>
      <dd className="mt-1.5">
        {items.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">Ingen</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((i) => (
              <li key={i} className="text-[13px] text-foreground">
                {i}
              </li>
            ))}
          </ul>
        )}
        {warn && items.length > 0 && (
          <p className="mt-1.5 text-[11.5px] text-warning">{warn}</p>
        )}
      </dd>
    </div>
  );
}
