"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, Users2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/patterns/empty-state";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidates, useStages } from "@/lib/api/recruitment";
import { STAGE_BADGE } from "@/lib/recruitment";

export default function RekrutteringForside() {
  const now = new Date();
  const stages = useStages();
  const candidates = useCandidates();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Forside"
        description="Dine kandidater og hva som venter"
        source="Rekrutteringslogg"
        lastUpdated={now}
      />

      <QueryBoundary
        query={stages}
        skeleton={<Skeleton className="h-24 rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen steg er definert"
      >
        {(stageList) => {
          const stageOf = (id: string) => stageList.find((s) => s.id === id);
          return (
            <QueryBoundary
              query={candidates}
              skeleton={<Skeleton className="h-24 rounded-lg" />}
              isEmpty={(d) => d.length === 0}
              emptyTitle="Ingen kandidater registrert ennå"
              emptyDescription="Nye kandidater dukker opp her så snart de registreres."
            >
              {(list) => {
                const overdue = list.filter((c) => c.nextActivity?.overdue);
                const upcoming = list.filter((c) => c.nextActivity && !c.nextActivity.overdue);
                const stageCounts = stageList
                  .filter((s) => !s.terminal)
                  .map((s) => ({ stage: s, count: list.filter((c) => c.stageId === s.id).length }));

                return (
                  <div className="flex flex-1 flex-col gap-6">
                    {/*
                      One column per stage, so the row is the pipeline.
                      A fixed four-column grid left the fifth stage alone on a
                      second row looking like an afterthought — and the count of
                      stages is explicitly preliminary (clarification 6), so the
                      layout has to follow the data rather than assume it.
                    */}
                    <div
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(var(--stages),minmax(0,1fr))]"
                      style={{ "--stages": stageCounts.length } as React.CSSProperties}
                    >
                      {stageCounts.map((sc, i) => (
                        <motion.div
                          key={sc.stage.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05, duration: 0.3 }}
                        >
                          <Card>
                            <CardContent className="py-4">
                              <p className="text-2xl font-medium tabular-nums text-foreground">{sc.count}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{sc.stage.label}</p>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-danger" />
                      <h2 className="text-sm font-medium text-foreground">
                        Ikke fulgt opp <span className="font-normal text-muted-foreground">— {overdue.length} kandidater</span>
                      </h2>
                    </div>

                    {overdue.length === 0 ? (
                      <EmptyState roy="idle" title="Ingenting på overtid" description="Alle neste-aktiviteter er innenfor frist." />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {overdue.map((c) => (
                          <Link key={c.id} href={`/rekruttering/kandidater/${c.id}`}>
                            <Card className="border-danger/30 bg-danger/5 transition-colors hover:border-danger/50">
                              <CardContent className="flex items-center justify-between gap-3 py-3.5 min-h-11 sm:min-h-6">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                                  <p
                                    className="mt-0.5 truncate text-xs text-muted-foreground"
                                    title={`${c.nextActivity?.label} — frist ${c.nextActivity?.date}`}
                                  >
                                    {c.nextActivity?.label} — frist {c.nextActivity?.date}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Badge className={STAGE_BADGE[c.stageId]}>{stageOf(c.stageId)?.label}</Badge>
                                  <ArrowRight className="size-4 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Users2 className="size-4 text-muted-foreground" />
                      <h2 className="text-sm font-medium text-foreground">
                        Kommende aktiviteter <span className="font-normal text-muted-foreground">— {upcoming.length} kandidater</span>
                      </h2>
                    </div>

                    {upcoming.length === 0 ? (
                      <EmptyState roy={false} title="Ingen planlagte aktiviteter" />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {upcoming.map((c) => (
                          <Link key={c.id} href={`/rekruttering/kandidater/${c.id}`}>
                            <Card className="transition-colors hover:border-[var(--ab-accent-9)]/40">
                              <CardContent className="flex items-center justify-between gap-3 py-3.5 min-h-11 sm:min-h-6">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                                  <p
                                    className="mt-0.5 truncate text-xs text-muted-foreground"
                                    title={`${c.nextActivity?.label} — ${c.nextActivity?.date}`}
                                  >
                                    {c.nextActivity?.label} — {c.nextActivity?.date}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Badge className={STAGE_BADGE[c.stageId]}>{stageOf(c.stageId)?.label}</Badge>
                                  <ArrowRight className="size-4 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            </QueryBoundary>
          );
        }}
      </QueryBoundary>

      <div className="mt-2">
        <Link href="/rekruttering/kandidater" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ab-accent-11)] hover:underline min-h-11 sm:min-h-6">
          Se alle kandidater <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
