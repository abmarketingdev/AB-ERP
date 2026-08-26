"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Pencil, X, Info } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { SparkLine } from "@/components/charts/spark-line";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFollowUps, useFollowUpAction } from "@/lib/api/leader";
import { errorMessage } from "@/lib/api/client";
import type { FollowUpRow } from "@/types/leader";

/**
 * The most constrained screen in the product. It will be reviewed by an employee
 * representative, so it is built as though that review is happening now.
 *
 * FR-L-05 gives every row a suggested action; FR-L-06 records all three
 * outcomes — accepted, changed, rejected — because "the leader disagreed" is
 * the single most valuable thing this screen can learn about its own rules.
 * FR-L-08 is the constraint the other two hang off: nothing here acts. Every
 * verb on screen is a proposal to a person.
 *
 * Deliberately absent: any score, any risk badge, any percentage rating, and any
 * chart. The explanation is readable text naming the rule and the numbers. A
 * chart here would invite the leader to interpret rather than read the rule, and
 * the rule is what has to be defensible. The single sparkline is context only —
 * no axes, no interaction.
 *
 * Nothing happens to a person automatically. The screen suggests; the leader decides.
 */

const PRIORITY_LABEL = {
  high: "Høy prioritet",
  medium: "Middels prioritet",
  low: "Lav prioritet",
} as const;

const PRIORITY_VARIANT = {
  high: "bg-danger/10 text-danger",
  medium: "bg-warning/10 text-warning-on-tint",
  low: "bg-muted text-muted-foreground",
} as const;

type Draft = { id: string; mode: "rejected" | "modified"; text: string };

export default function LederOppfolging() {
  const now = new Date();
  const query = useFollowUps();
  const action = useFollowUpAction();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  function submit(row: FollowUpRow, type: "accepted" | "modified" | "rejected", note?: string) {
    setFailed(null);
    action.mutate(
      { id: row.id, type, note },
      {
        onSuccess: () => setDraft(null),
        onError: (err) => setFailed(errorMessage(err)),
      },
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Oppfølgingsbehov"
        description="Personer under godkjent terskel, prioritert"
        period="Uke 34"
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {failed}
        </p>
      )}

      <QueryBoundary
        query={query}
        isEmpty={(rows) => rows.length === 0}
        emptyTitle="Ingen oppfølgingsbehov denne uken"
        emptyDescription="Ingen i teamet ligger under terskel akkurat nå."
      >
        {(rows) => {
          /*
           * A person's signals are kept together, and each card says how many
           * there are.
           *
           * Priority order alone put Nora Larsen first (doors) and fourth
           * (yes-rate), four cards apart. A leader who acts on the first one is
           * deciding about a person while a second open signal about the same
           * person sits below the fold — which is exactly the kind of partial
           * picture this screen exists to prevent. Grouping keeps the
           * per-signal card and its own accept/adjust/reject (FR-L-06) while
           * making the whole picture visible before any of it is acted on.
           */
          const RANK = { high: 0, medium: 1, low: 2 } as const;
          const byPerson = new Map<string, typeof rows>();
          for (const r of rows) {
            const list = byPerson.get(r.personId) ?? [];
            list.push(r);
            byPerson.set(r.personId, list);
          }
          const ordered = [...byPerson.values()]
            .map((list) => [...list].sort((a, b) => RANK[a.priority] - RANK[b.priority]))
            .sort(
              (a, b) =>
                RANK[a[0].priority] - RANK[b[0].priority] ||
                a[0].name.localeCompare(b[0].name, "nb-NO"),
            )
            .flatMap((list) =>
              list.map((row, i) => ({ row, index: i + 1, total: list.length })),
            );

          return (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {ordered.map(({ row, index, total }) => (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: -16 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                >
                  <Card>
                    <CardContent className="space-y-3 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {row.name}{" "}
                            <span className="font-normal text-muted-foreground">— {row.team}</span>
                          </p>
                          {/* The rule, named in plain Norwegian. */}
                          <p className="mt-1 text-sm text-foreground">{row.rule}</p>
                          {total > 1 && (
                            <p className="mt-1 text-[12.5px] text-muted-foreground">
                              Signal {index} av {total} for {row.name.split(" ")[0]} denne perioden
                              — se begge før du bestemmer deg.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {row.spark && (
                            <SparkLine
                              points={row.spark}
                              className="text-muted-foreground"
                              ariaLabel={`Utvikling for ${row.name}, ${row.spark.length} dager`}
                            />
                          )}
                          <Badge className={PRIORITY_VARIANT[row.priority]}>
                            {PRIORITY_LABEL[row.priority]}
                          </Badge>
                        </div>
                      </div>

                      {/* The numbers behind the flag. Never a score. */}
                      <p className="text-sm text-muted-foreground">{row.numbers}</p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
                            >
                              <Info className="size-3.5" />
                              Terskel: {row.threshold}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Eier av terskelen: {row.thresholdOwner}</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="rounded-md bg-[var(--ab-accent-3)]/40 px-3 py-2 text-sm text-[var(--ab-accent-12)]">
                        Forslag: {row.suggestedAction}
                      </div>

                      {draft?.id === row.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={draft.text}
                            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                            placeholder={
                              draft.mode === "rejected"
                                ? "Begrunnelse for avvisning (påkrevd)"
                                : "Hva gjør du i stedet? (påkrevd)"
                            }
                            className="min-h-16 text-sm"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={draft.mode === "rejected" ? "destructive" : "default"}
                              disabled={!draft.text.trim() || action.isPending}
                              onClick={() => submit(row, draft.mode, draft.text.trim())}
                            >
                              {action.isPending
                                ? "Lagrer…"
                                : draft.mode === "rejected"
                                  ? "Bekreft avvisning"
                                  : "Lagre justering"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                              Avbryt
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5"
                            disabled={action.isPending}
                            onClick={() => submit(row, "accepted")}
                          >
                            <Check className="size-4" /> Godta
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() =>
                              setDraft({ id: row.id, mode: "modified", text: row.suggestedAction })
                            }
                          >
                            <Pencil className="size-4" /> Juster
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-danger hover:text-danger"
                            onClick={() => setDraft({ id: row.id, mode: "rejected", text: "" })}
                          >
                            <X className="size-4" /> Avvis
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        );
        }}
      </QueryBoundary>

      <p className="text-xs text-muted-foreground">
        Forslagene er beregnet fra godkjente data. Ingenting skjer automatisk — alle valg gjøres av
        leder og logges i revisjonsloggen.
      </p>
    </div>
  );
}
