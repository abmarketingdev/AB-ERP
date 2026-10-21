"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/empty-state";
import { Mascot, type MascotPose } from "@/components/patterns/mascot";
import { errorMessage } from "@/lib/api/client";
import { mascotFor } from "@/lib/use-mascot";

/**
 * Every data surface has five states. Building them per screen is how they get
 * skipped, so they live here once.
 *
 * Note what this deliberately does NOT do on refetch: it does not fall back to a
 * skeleton. A skeleton flash on every filter change reads as broken, so the
 * previous render is held at reduced opacity instead.
 *
 * Nor does a failed BACKGROUND refetch replace data the person is working on with an
 * error box (02-design-system state 4, partial/stale; found by A2): the last data stays,
 * lightly dimmed, under a small notice «Kunne ikke oppdatere · viser data fra 18:42 ·
 * Prøv igjen». The error box is only for a failure with nothing to show.
 */
export function QueryBoundary<T>({
  query,
  skeleton,
  isEmpty,
  emptyTitle,
  emptyDescription,
  emptyPose,
  errorHint,
  className,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Pick a pose for this particular emptiness. Defaults to "ingen data". */
  emptyPose?: MascotPose;
  /** One extra sentence under a failure — where to turn when retrying doesn't
   *  help. Worth having wherever the reader has no colleague to ask. */
  errorHint?: string;
  /** Layout for the success wrapper. Needed because this div sits between the
   *  page's flex column and its children, so the page's gap cannot reach them. */
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  // 1. Loading — first load only.
  if (query.isPending) {
    return <>{skeleton ?? <DefaultSkeleton />}</>;
  }

  // 2. Error — plain Norwegian, and a way out. Only when there is nothing to show.
  if (query.isError && query.data === undefined) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
        {/*
         * Every failed fetch in the product funnels through here, and until now
         * none of them had a mascot — the one state where a bit of warmth is
         * unambiguously on the reader's side, because nothing has gone wrong
         * that is their fault. `meeting-chaos` is the pack's own "feil, travel
         * uke" pose.
         */}
        <div className="flex items-center gap-3">
          <Mascot state="concerned" size={56} />
          <span className="flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle className="size-4" />
            {errorMessage(query.error)}
          </span>
        </div>
        {errorHint && <p className="max-w-prose text-[13px] text-muted-foreground">{errorHint}</p>}
        <Button variant="outline" size="sm" onClick={() => query.refetch()} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          Prøv igjen
        </Button>
      </div>
    );
  }

  const data = query.data as T;

  // 3. Empty — a sentence explaining why, never a blank region.
  if (isEmpty?.(data)) {
    return (
      <EmptyState
        title={emptyTitle ?? "Ingen data for denne perioden"}
        description={emptyDescription}
        pose={emptyPose}
        mascot="sleeping"
      />
    );
  }

  // 4a. Stale — a background refetch failed: keep the data, say so, offer a retry.
  const stale = query.isError;
  // 4b. Refetching — hold the previous render, dim it.
  return (
    <>
      {stale && <StaleNotice updatedAt={query.dataUpdatedAt} retrying={query.isFetching} onRetry={() => query.refetch()} />}
      <div
        className={[className, query.isFetching || stale ? "opacity-75 transition-opacity duration-150" : ""]
          .filter(Boolean)
          .join(" ")}
        aria-busy={query.isFetching || undefined}
      >
        {children(data)}
      </div>
    </>
  );
}

const hhmm = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" });
const dayHhmm = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The partial/stale marker: small, in place, never covering the data it describes. */
export function StaleNotice({ updatedAt, retrying, onRetry }: { updatedAt: number; retrying?: boolean; onRetry: () => void }) {
  const at = new Date(updatedAt);
  const sameDay = at.toDateString() === new Date().toDateString();
  const m = mascotFor("stale");
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[13px] text-warning-on-tint">
      <Mascot {...m} size={28} />
      <span className="font-medium">Kunne ikke oppdatere</span>
      <span>· viser data fra {updatedAt ? (sameDay ? hhmm : dayHhmm).format(at) : "tidligere"}</span>
      <Button variant="ghost" size="sm" disabled={retrying} onClick={onRetry} className="ml-auto min-h-11 gap-1.5 sm:min-h-8">
        <RotateCcw className={`size-3.5 ${retrying ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
        {retrying ? "Prøver…" : "Prøv igjen"}
      </Button>
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}
