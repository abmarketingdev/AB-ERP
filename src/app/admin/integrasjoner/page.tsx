"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { CircleCheck, CircleAlert, Clock, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntegrations } from "@/lib/api/quality";
import { riseIn } from "@/lib/motion";
import { Roy } from "@/components/patterns/roy";
import type { Integration } from "@/types/quality";

/**
 * FR-A-10 — integration health.
 *
 * Doc 04 sets the register precisely: "Status rows, green/amber/red. **Plain
 * language, no Redis terminology.**" An administrator is not on call for a
 * message queue. They need to answer one question at 08:00 — *did last night's
 * numbers arrive, and if not, who do I ring* — so every row carries what breaks
 * when it stops and who owns it. Nothing is named after the technology that
 * implements it.
 *
 * "Late" is its own state rather than a shade of failed, because the useful
 * moment is *before* the failure. An administrator who only ever sees red has
 * already lost the morning.
 */
const STATUS = {
  ok: {
    label: "I rute",
    icon: CircleCheck,
    chip: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  late: {
    label: "Forsinket",
    icon: Clock,
    chip: "border-warning/35 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  failed: {
    label: "Feilet",
    icon: CircleAlert,
    chip: "border-danger/30 bg-danger/10 text-danger",
    dot: "bg-danger",
  },
} as const;

const KIND_LABEL: Record<Integration["kind"], string> = {
  import: "Import",
  job: "Planlagt jobb",
  feed: "Løpende overføring",
};

export default function AdminIntegrasjoner() {
  const now = new Date();
  const reduced = useReducedMotion();
  const query = useIntegrations();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Integrasjoner"
        description="Siste vellykkede kjøring for hver import og planlagte jobb"
        source="Driftsovervåking"
        lastUpdated={now}
      />

      <QueryBoundary
        query={query}
        skeleton={<Skeleton className="h-80 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen integrasjoner registrert"
        emptyDescription="Overvåkingen viser importer, overføringer og planlagte jobber."
        className="flex flex-col gap-5"
      >
        {(rows) => {
          const failed = rows.filter((r) => r.status === "failed");
          const late = rows.filter((r) => r.status === "late");
          const healthy = rows.length - failed.length - late.length;

          return (
            <>
              {/* The summary answers the 08:00 question before any scrolling. */}
              <motion.div
                {...riseIn(0, reduced)}
                className="flex items-center gap-4 rounded-xl border border-border bg-secondary/30 px-5 py-4 text-[13.5px] text-foreground"
              >
                {/* Only when everything is healthy. A character next to a list
                    of failures would be commenting on someone's bad morning. */}
                {failed.length === 0 && late.length === 0 && (
                  <Roy state="win-small" size={40} className="shrink-0" />
                )}
                <p>
                {failed.length === 0 && late.length === 0 ? (
                  <>Alle {rows.length} integrasjoner har kjørt som forventet.</>
                ) : (
                  <>
                    {failed.length > 0 && (
                      <>
                        <span className="font-mono tabular-nums">{failed.length}</span>{" "}
                        {failed.length === 1 ? "integrasjon har feilet" : "integrasjoner har feilet"}
                        {late.length > 0 && ", "}
                      </>
                    )}
                    {late.length > 0 && (
                      <>
                        <span className="font-mono tabular-nums">{late.length}</span> er forsinket
                      </>
                    )}
                    .{" "}
                    <span className="text-muted-foreground">
                      {healthy} av {rows.length} går som normalt.
                    </span>
                  </>
                )}
                </p>
              </motion.div>

              <ul className="flex flex-col gap-2.5">
                {/* Anything needing attention first — this is a triage list. */}
                {[...rows]
                  .sort((a, b) => rank(a.status) - rank(b.status))
                  .map((r, i) => (
                    <motion.li key={r.id} {...riseIn(i + 1, reduced)}>
                      <Row integration={r} />
                    </motion.li>
                  ))}
              </ul>

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Forsinket betyr at det er gått lengre tid enn intervallet uten en vellykket kjøring ·
                feilet betyr at siste kjøring stoppet · kontakt eieren i raden
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

const rank = (s: Integration["status"]) => ({ failed: 0, late: 1, ok: 2 })[s];

function Row({ integration: r }: { integration: Integration }) {
  const s = STATUS[r.status];
  const Icon = s.icon;
  const overdue =
    r.minutesSinceSuccess !== null && r.minutesSinceSuccess > r.expectedEveryMinutes;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 gap-3.5">
          <span className={`mt-1 size-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-[14px] text-foreground">{r.name}</p>
            {/* The line that makes the row worth reading. */}
            <p className="mt-1 text-[12.5px] text-muted-foreground">{r.consequence}</p>
            {r.note && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-warning">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {r.note}
              </p>
            )}
          </div>
        </div>

        {/* Status in text as well as colour — WCAG 1.4.1. */}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${s.chip}`}
        >
          <Icon className="size-3" aria-hidden />
          {s.label}
        </span>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border px-5 py-3">
        <Field label="Type" value={KIND_LABEL[r.kind]} />
        <Field label="Forventet" value={r.schedule} />
        <Field
          label="Siste vellykkede"
          value={r.lastSuccessAt ?? "Aldri"}
          tone={overdue ? "text-warning" : undefined}
        />
        <Field label="Siste forsøk" value={r.lastRunAt ?? "—"} />
        <Field label="Eier" value={r.owner} />
      </dl>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 text-[12.5px] ${tone ?? "text-foreground"}`}>{value}</dd>
    </div>
  );
}
