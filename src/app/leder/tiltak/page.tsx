"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ChevronDown, CircleDot } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { SparkLine } from "@/components/charts/spark-line";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMeasures, useCloseMeasure, useTeamMembers } from "@/lib/api/leader";
import { errorMessage } from "@/lib/api/client";
import type { Measure } from "@/types/leader";

/**
 * FR-L-09 / FR-L-10 — accepted suggestions become tracked measures with status,
 * owner and deadline, and a measure is closed with a short note recording the
 * outcome after the follow-up period.
 *
 * The note is mandatory, and that is the point rather than a formality: a
 * measure closed with no record of what happened leaves the person with a mark
 * against them and no account of how it resolved. The person's own trend sits on
 * the card so the outcome is judged against movement, not memory.
 */
export default function LederTiltak() {
  const now = new Date();
  const measures = useMeasures();
  const members = useTeamMembers();
  const closeMeasure = useCloseMeasure();
  const [closing, setClosing] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [failed, setFailed] = React.useState<string | null>(null);
  const [showClosed, setShowClosed] = React.useState(false);

  function submit(id: string) {
    setFailed(null);
    closeMeasure.mutate(
      { id, outcomeNote: note.trim() },
      {
        onSuccess: () => {
          setClosing(null);
          setNote("");
        },
        onError: (err) => setFailed(errorMessage(err)),
      },
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Tiltak"
        description="Oppfølging av godtatte forslag"
        source="Oppfølgingsbehov"
        lastUpdated={now}
      />

      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {failed}
        </p>
      )}

      <QueryBoundary
        query={measures}
        skeleton={<Skeleton className="h-64 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen tiltak registrert"
        emptyDescription="Tiltak opprettes når du godtar eller justerer et oppfølgingsforslag."
        className="flex flex-col gap-7"
      >
        {(list) => {
          const open = list.filter((m) => m.status === "open");
          const closed = list.filter((m) => m.status === "closed");
          const sparkFor = (person: string) =>
            members.data?.find((m) => m.name === person)?.spark;

          return (
            <>
              <div className="flex flex-wrap gap-4">
                <Summary label="Åpne tiltak" value={open.length} tone="text-warning" />
                <Summary label="Lukket" value={closed.length} tone="text-success" />
              </div>

              <section>
                <h2 className="mb-3 text-[15px] font-medium text-foreground">Åpne</h2>
                {open.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card px-5 py-6 text-center text-[13px] text-muted-foreground">
                    Ingen åpne tiltak akkurat nå.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    <AnimatePresence initial={false}>
                      {open.map((m) => (
                        <motion.li
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0, marginBottom: -12 }}
                          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        >
                          <MeasureCard
                            measure={m}
                            spark={sparkFor(m.person)}
                            closing={closing === m.id}
                            note={note}
                            pending={closeMeasure.isPending}
                            onNote={setNote}
                            onStartClose={() => {
                              setClosing(m.id);
                              setNote("");
                              setFailed(null);
                            }}
                            onCancel={() => setClosing(null)}
                            onSubmit={() => submit(m.id)}
                          />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </section>

              {closed.length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowClosed((v) => !v)}
                    aria-expanded={showClosed}
                    className="flex items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
                  >
                    <ChevronDown className={`size-4 transition-transform ${showClosed ? "rotate-180" : ""}`} />
                    Lukkede tiltak ({closed.length})
                  </button>
                  {showClosed && (
                    <ul className="mt-3 flex flex-col gap-3">
                      {closed.map((m) => (
                        <li key={m.id}>
                          <MeasureCard measure={m} spark={sparkFor(m.person)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Team Vest · tiltak opprettes fra Oppfølgingsbehov · alle endringer logges i
                revisjonsloggen
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-[140px] flex-1 rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-mono text-[24px] leading-none tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function MeasureCard({
  measure,
  spark,
  closing,
  note,
  pending,
  onNote,
  onStartClose,
  onCancel,
  onSubmit,
}: {
  measure: Measure;
  spark?: number[];
  closing?: boolean;
  note?: string;
  pending?: boolean;
  onNote?: (v: string) => void;
  onStartClose?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
}) {
  const done = measure.status === "closed";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] text-foreground">
            {done ? (
              <Check className="size-3.5 shrink-0 text-success" aria-hidden />
            ) : (
              <CircleDot className="size-3.5 shrink-0 text-warning" aria-hidden />
            )}
            {measure.person}
            <span className="font-mono text-[11px] text-muted-foreground">
              {done ? "lukket" : "åpent"}
            </span>
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">{measure.action}</p>
        </div>
        {spark && (
          <SparkLine
            points={spark}
            width={120}
            height={30}
            className="text-muted-foreground"
            ariaLabel={`Utvikling for ${measure.person}`}
          />
        )}
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 px-5 pb-4">
        <Field label="Eier" value={measure.owner} />
        <Field label="Frist" value={measure.deadline} />
      </dl>

      {done && measure.outcomeNote && (
        <div className="border-t border-border bg-success/[0.06] px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
            Resultat
          </p>
          <p className="mt-1 text-[13px] text-foreground">{measure.outcomeNote}</p>
        </div>
      )}

      {!done &&
        (closing ? (
          <div className="space-y-2 border-t border-border px-5 py-3.5">
            <Textarea
              value={note}
              onChange={(e) => onNote?.(e.target.value)}
              placeholder="Hva ble utfallet? (påkrevd)"
              className="min-h-16 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={!note?.trim() || pending} onClick={onSubmit}>
                {pending ? "Lagrer…" : "Lukk tiltaket"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Avbryt
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-border px-5 py-3">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onStartClose}>
              <Check className="size-3.5" />
              Lukk med resultat
            </Button>
          </div>
        ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
