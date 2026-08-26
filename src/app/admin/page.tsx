"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building2, ChevronDown, LayoutGrid, MapPin, Megaphone, Users } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgOverview, useAuditLog } from "@/lib/api/quality";
import { formatNumber } from "@/lib/format";
import type { OrgEntity } from "@/types/quality";
import type { LucideIcon } from "lucide-react";

/**
 * FR-A-01 — a cross-organisation overview of customers, campaigns, departments,
 * teams and users.
 *
 * Counts on their own are a vanity panel: five big numbers tell an administrator
 * nothing they could act on. Each card therefore carries a second line saying
 * what the count is *made of* — how many customers actually have a working
 * login, how many users are deactivated — and expands to the underlying items.
 * That second line is where the work is: "12 kunder" is a fact, "3 uten
 * portaltilgang" is a task.
 *
 * Everything is derived from the same tables the rest of the product reads, so
 * this page cannot claim a team that does not exist.
 */
const ICONS: Record<string, LucideIcon> = {
  customers: Building2,
  campaigns: Megaphone,
  departments: MapPin,
  teams: LayoutGrid,
  users: Users,
};

export default function AdminOversikt() {
  const now = new Date();
  const overview = useOrgOverview();
  const audit = useAuditLog();
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Oversikt"
        description="Kunder, kampanjer, avdelinger, team og brukere"
        source="Tilgangsstyring"
        lastUpdated={now}
      />

      <QueryBoundary
        query={overview}
        skeleton={<Skeleton className="h-56 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen organisasjonsdata"
        emptyDescription="Oversikten bygges av kunde-, team- og brukerregisteret."
        className="flex flex-col gap-4"
      >
        {(rows) => (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((e) => (
              <EntityCard
                key={e.key}
                entity={e}
                expanded={openKey === e.key}
                onToggle={() => setOpenKey(openKey === e.key ? null : e.key)}
              />
            ))}
          </div>
        )}
      </QueryBoundary>

      {/* The audit log is the administrator's home feed — anything that changed
          anywhere shows up here, so the overview links straight into it. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-foreground">Siste endringer</h2>
          <Link
            href="/admin/revisjonslogg"
            className="inline-flex items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
          >
            Hele revisjonsloggen
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        <QueryBoundary
          query={audit}
          skeleton={<Skeleton className="h-48 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingenting er endret ennå"
          emptyDescription="Korrigeringer, tilgangsendringer og forhåndsvisninger dukker opp her."
        >
          {(log) => (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {log.slice(0, 6).map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                  <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                    {a.at}
                  </span>
                  <span className="text-[13px] text-foreground">{a.action}</span>
                  <span className="text-[13px] text-muted-foreground">{a.affected}</span>
                  <span className="ml-auto rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
                    {a.area}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </section>

      <p className="font-mono text-[10.5px] text-muted-foreground">
        Tallene er utledet av kunde-, team- og brukerregisteret · administratorpålogging krever
        tofaktor (FR-A-09)
      </p>
    </div>
  );
}

function EntityCard({
  entity,
  expanded,
  onToggle,
}: {
  entity: OrgEntity;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = ICONS[entity.key] ?? LayoutGrid;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Icon className="size-3.5" aria-hidden />
            {entity.label}
          </p>
          <p className="mt-2 font-mono text-[30px] leading-none tabular-nums text-foreground">
            {formatNumber(entity.count)}
          </p>
          {/* The line that turns a count into a task. */}
          <p className="mt-2 text-[12.5px] text-muted-foreground">{entity.detail}</p>
        </div>
        {entity.href && (
          <Link
            href={entity.href}
            aria-label={`Gå til ${entity.label}`}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground sm:min-h-8 sm:min-w-8 transition-colors hover:border-[var(--ab-accent-9)]/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center gap-1.5 border-t border-border px-5 py-2.5 text-left font-mono text-[10.5px] sm:min-h-6 uppercase tracking-[0.09em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Skjul" : "Vis alle"}
      </button>

      {expanded && (
        <ul className="divide-y divide-border border-t border-border">
          {entity.items.map((i) => (
            <li key={i.name} className="flex items-baseline justify-between gap-3 px-5 py-2">
              <span className="truncate text-[13px] text-foreground">{i.name}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                {i.meta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
