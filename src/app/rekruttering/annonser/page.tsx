"use client";

import * as React from "react";
import { Plus, ExternalLink, Copy, Check, Globe, CalendarX } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAds, usePublishAd, useUnpublishAd } from "@/lib/api/srs";
import { AD_STATUS_LABEL, AD_PLATFORMS, PLATFORM_FREE, type Ad, type AdStatus } from "@/types/ad";
import { NewAdDialog } from "@/components/patterns/new-ad-dialog";

/**
 * ANN-06 — oversikt over aktive annonser, kanal og antall søkere per annonse.
 *
 * The applicant count is shown per platform rather than per ad, because that is
 * the comparison the feature exists for: an ad with 86 applicants tells you
 * nothing, while "Nav 41, Finn 27, Indeed 18" tells you where to spend the next
 * one. ANN-04's tracking link sits beside each count, since the two are the
 * same mechanism seen from either end.
 */

const STATUS_TONE: Record<AdStatus, string> = {
  utkast: "bg-muted text-muted-foreground",
  publisert: "bg-success/10 text-success",
  avpublisert: "bg-muted text-muted-foreground line-through",
};

const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });
const numFmt = new Intl.NumberFormat("nb-NO");

export default function Annonser() {
  const ads = useAds();
  const [createOpen, setCreateOpen] = React.useState(false);

  const all = ads.data ?? [];
  const live = all.filter((a) => a.status === "publisert");
  const applicants = all.reduce((n, a) => n + a.publications.reduce((m, p) => m + p.applicants, 0), 0);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Annonser"
        description={`${live.length} aktive annonser · ${numFmt.format(applicants)} søkere totalt`}
        source="Nav, Indeed, Finn og andre gratis jobbplattformer"
        lastUpdated={new Date()}
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Ny annonse
          </Button>
        }
      />

      <QueryBoundary
        query={ads}
        skeleton={<div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen annonser ennå"
        emptyDescription="Lag én annonse og publiser den til Nav, Indeed og Finn på én gang."
        className="flex flex-col gap-4"
      >
        {(list) => <>{list.map((ad) => <AdCard key={ad.id} ad={ad} />)}</>}
      </QueryBoundary>

      <NewAdDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  const publish = usePublishAd();
  const unpublish = useUnpublishAd();
  const [copied, setCopied] = React.useState<string | null>(null);

  const total = ad.publications.reduce((n, p) => n + p.applicants, 0);
  const deadlinePassed = ad.deadline ? new Date(ad.deadline) < new Date("2026-08-20") : false;
  const unpublished = ad.publications.filter((p) => !p.unpublishedAt);
  const missing = AD_PLATFORMS.filter((pl) => !unpublished.some((p) => p.platform === pl));

  async function copy(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard can be blocked; the link is visible and selectable anyway.
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{ad.title}</h2>
              <Badge className={STATUS_TONE[ad.status]}>{AD_STATUS_LABEL[ad.status]}</Badge>
              {deadlinePassed && ad.status === "avpublisert" && (
                <Badge variant="outline" className="gap-1 border-warning/40 text-warning-on-tint">
                  <CalendarX className="size-3" aria-hidden />
                  Fristen gikk ut
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ad.jobType} · {ad.location} · {ad.campaign} · laget av {ad.createdBy}
              {ad.deadline && ` · søknadsfrist ${dayFmt.format(new Date(ad.deadline))}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ad.status === "publisert" && (
              <Button size="sm" variant="outline" disabled={unpublish.isPending}
                onClick={() => unpublish.mutate({ id: ad.id })}>
                Avpubliser
              </Button>
            )}
            {ad.status !== "publisert" && missing.length > 0 && (
              <Button size="sm" className="gap-1.5" disabled={publish.isPending}
                onClick={() => publish.mutate({ id: ad.id, platforms: missing.filter((m) => PLATFORM_FREE[m]) })}>
                <Globe className="size-4" /> Publiser
              </Button>
            )}
          </div>
        </div>

        {ad.publications.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Ikke publisert ennå. Publiser for å få sporingslenker og søkertall per kanal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Plattform</th>
                  <th className="pb-2 font-medium">Ekstern ID</th>
                  <th className="pb-2 text-right font-medium">Søkere</th>
                  <th className="pb-2 font-medium">Sporingslenke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ad.publications.map((p) => (
                  <tr key={p.platform} className={p.unpublishedAt ? "text-muted-foreground" : undefined}>
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        {p.platform}
                        {!PLATFORM_FREE[p.platform] && (
                          <Badge variant="outline" className="text-[10px]">betalt</Badge>
                        )}
                        {p.unpublishedAt && <Badge variant="outline" className="text-[10px]">avpublisert</Badge>}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{p.externalId ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{numFmt.format(p.applicants)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => copy(p.trackingUrl, p.platform)}
                        className="group flex max-w-[22rem] items-center gap-1.5 truncate rounded px-1 text-left font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Kopier sporingslenken"
                      >
                        <span className="truncate">{p.trackingUrl}</span>
                        {copied === p.platform
                          ? <Check className="size-3 shrink-0 text-success" aria-hidden />
                          : <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="pt-2 text-xs text-muted-foreground" colSpan={2}>Totalt</td>
                  <td className="pt-2 text-right font-medium tabular-nums">{numFmt.format(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Vis annonseteksten</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-[13px] leading-relaxed">{ad.body}</p>
        </details>

        {ad.publications.some((p) => !p.unpublishedAt) && (
          <a
            href={`/soknad/${ad.id}?kanal=nav`}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="size-3" aria-hidden />
            Åpne søknadsskjemaet slik søkeren ser det
          </a>
        )}
      </CardContent>
    </Card>
  );
}
