"use client";

import * as React from "react";
import { motion } from "motion/react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { usePromoterNews, useMarkNewsRead } from "@/lib/api/promoter";
import { useSession } from "@/lib/permissions";
import type { NewsItem } from "@/types/promoter";

/**
 * FR-P-10 — published items scoped to the promoter's department, campaign or
 * everyone, with a read state per item.
 *
 * Chronological, never re-ordered by read state: an item does not move when you
 * open it, because a list that rearranges under your cursor is disorienting.
 * The unread dot is the only thing that changes.
 */
export default function PromoterNyheter() {
  const now = new Date();
  const who = useSession()?.name ?? "Deg";
  const news = usePromoterNews();
  const markRead = useMarkNewsRead();
  const [openId, setOpenId] = React.useState<string | null>(null);

  function toggle(item: NewsItem) {
    const next = openId === item.id ? null : item.id;
    setOpenId(next);
    if (next && !item.read) markRead.mutate(item.id);
  }

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Nyheter"
        description="Siste nytt for deg"
        source="Nyhetsmodul"
        lastUpdated={now}
      />

      <QueryBoundary
        query={news}
        skeleton={<Skeleton className="h-64 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen nyheter"
        emptyPose="reading"
        emptyDescription="Kunngjøringer for avdelingen og kampanjene dine vises her."
        className="flex flex-col gap-5"
      >
        {(items) => {
          const unread = items.filter((n) => !n.read).length;
          return (
            <>
              <p className="font-mono text-[11px] text-muted-foreground">
                {who} · {items.length} saker · {unread} ulest
              </p>

              <ul className="flex flex-col gap-2">
                {items.map((n) => {
                  const open = openId === n.id;
                  return (
                    <li key={n.id}>
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <button
                          type="button"
                          onClick={() => toggle(n)}
                          aria-expanded={open}
                          className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span
                              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                                n.read ? "bg-transparent" : "bg-[var(--ab-accent-9)]"
                              }`}
                              aria-label={n.read ? undefined : "Ulest"}
                            />
                            <div className="min-w-0">
                              <p
                                className={`text-[13.5px] ${
                                  n.read ? "text-muted-foreground" : "text-foreground"
                                }`}
                              >
                                {n.title}
                              </p>
                              <p className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                                <span className="rounded border border-border px-1.5 py-0.5">
                                  {n.scope}
                                </span>
                                {n.publishedAt}
                              </p>
                            </div>
                          </div>
                        </button>

                        {open && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                          >
                            <p className="border-t border-border px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
                              {n.body}
                            </p>
                          </motion.div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Saker vises i tidsrekkefølge · en sak markeres som lest når du åpner den
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
