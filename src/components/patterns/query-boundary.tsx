"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/empty-state";
import { errorMessage } from "@/lib/api/client";

/**
 * Every data surface has five states. Building them per screen is how they get
 * skipped, so they live here once.
 *
 * Note what this deliberately does NOT do on refetch: it does not fall back to a
 * skeleton. A skeleton flash on every filter change reads as broken, so the
 * previous render is held at reduced opacity instead.
 */
export function QueryBoundary<T>({
  query,
  skeleton,
  isEmpty,
  emptyTitle,
  emptyDescription,
  errorHint,
  className,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
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

  // 2. Error — plain Norwegian, and a way out.
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-6">
        <span className="flex items-center gap-2 text-sm font-medium text-danger">
          <AlertTriangle className="size-4" />
          {errorMessage(query.error)}
        </span>
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
        roy="sleeping"
      />
    );
  }

  // 4. Partial / refetching — hold the previous render, dim it.
  return (
    <div
      className={[className, query.isFetching ? "opacity-60 transition-opacity duration-150" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-busy={query.isFetching || undefined}
    >
      {children(data)}
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
