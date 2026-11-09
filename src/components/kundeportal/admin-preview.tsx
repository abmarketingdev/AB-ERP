"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportScreen } from "./report-screen";
import { PreviewOrgContext, usePreviewReport, useKundeOrgs } from "@/lib/kundeportal/admin-api";

/**
 * «Forhåndsvis som kunde» på ekte data: samme rapportbygger og samme avtale som kunden får,
 * hentet med ansatt-innloggingen (ingen kundeøkt lages, kunden ser ingenting av det).
 */
export function AdminPreview() {
  const router = useRouter();
  const params = useSearchParams();
  const orgs = useKundeOrgs();
  const now = React.useMemo(() => new Date(), []);
  const orgId = params.get("org");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader title="Forhåndsvis som kunde" description="Se rapporten slik kunden ser den" source="Kundeportalen" lastUpdated={now} />
      <QueryBoundary query={orgs} skeleton={<Skeleton className="h-10 w-72 rounded-md" />}>
        {(list) => {
          const org = list.find((o) => o.id === orgId) ?? null;
          return (
            <div className="flex flex-col gap-6">
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ingen kundekontoer ennå. Opprett en under «Kunder».</p>
              ) : (
                <Select value={org?.id ?? ""} onValueChange={(v) => router.replace(`/admin/forhandsvis?org=${v}`)}>
                  <SelectTrigger className="w-72" aria-label="Kunde">
                    <SelectValue placeholder="Velg kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    {list.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {org && (
                <PreviewOrgContext.Provider value={org.id}>
                  <div className="rounded-2xl border border-border bg-background p-4 sm:p-6">
                    <ReportScreen
                      key={org.id}
                      useReport={usePreviewReport}
                      banner={
                        <p className="mb-4 flex items-center gap-2 rounded-md border border-[var(--ab-accent-9)]/30 bg-[var(--ab-accent-9)]/10 px-3.5 py-2.5 text-sm text-foreground print:hidden">
                          <Eye className="size-4 shrink-0" aria-hidden />
                          Forhåndsvisning: slik ser {org.name} rapporten akkurat nå. Kunden ser ikke dette banneret.
                        </p>
                      }
                    />
                  </div>
                </PreviewOrgContext.Provider>
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
