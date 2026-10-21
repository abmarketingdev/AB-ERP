"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, ExternalLink, Copy, Check, Globe, CalendarX, RotateCcw, AlertTriangle, Clock, Hand } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Mascot } from "@/components/patterns/mascot";
import { mascotFor } from "@/lib/use-mascot";
import {
  useAdMeta, useAds, useMarkManualPublished, usePublishAd, useRetryPublication, useUnpublishAd,
} from "@/lib/api/ads";
import { errorMessage } from "@/lib/api/client";
import {
  AD_STATUS_LABEL, PUBLICATION_STATE_LABEL, type Ad, type AdStatus, type Publication, type PublicationState,
} from "@/types/ad";
import { NewAdDialog } from "@/components/patterns/new-ad-dialog";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { Segmented } from "@/components/patterns/segmented";

type View = "aktive" | "utkast" | "avsluttet";
const VIEW_STATUS: Record<View, AdStatus> = { aktive: "publisert", utkast: "utkast", avsluttet: "avpublisert" };
const VIEW_EMPTY: Record<View, string> = {
  aktive: "Ingen aktive annonser. Publiser et utkast, eller lag en ny annonse.",
  utkast: "Ingen utkast. Lagrer du en annonse uten å publisere, ligger den her.",
  avsluttet: "Ingen avsluttede annonser ennå. Annonser som avpubliseres eller passerer fristen, havner her.",
};

/**
 * ANN-06 — oversikt over aktive annonser, kanal og antall søkere per annonse.
 *
 * The applicant count is shown per platform rather than per ad, because that is
 * the comparison the feature exists for: an ad with 86 applicants tells you
 * nothing, while "Nav 41, Finn 27, Indeed 18" tells you where to spend the next
 * one. ANN-04's tracking link sits beside each count, since the two are the
 * same mechanism seen from either end.
 *
 * Publishing is asynchronous (IFK-09: a slow board must never hold the page),
 * so each platform carries its own state — Venter, Publisert, Feilet — and a
 * board that refused says why and offers «Prøv igjen». That is the partial
 * state of the design system, per row instead of for the whole page.
 */

const STATUS_TONE: Record<AdStatus, string> = {
  utkast: "bg-muted text-muted-foreground",
  publisert: "bg-success/10 text-success",
  avpublisert: "bg-muted text-muted-foreground",
};

const PUB_TONE: Record<PublicationState, string> = {
  venter: "border-warning/40 text-warning-on-tint",
  publisert: "border-success/40 text-success",
  feilet: "border-danger/40 text-danger",
  avpubliserer: "border-border text-muted-foreground",
  avpublisert: "border-border text-muted-foreground",
};

const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });
const numFmt = new Intl.NumberFormat("nb-NO");

function daysUntil(date: string) {
  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Oslo" }));
  return Math.round((new Date(date).getTime() - today.getTime()) / 86_400_000);
}

function AnnonserPage() {
  const ads = useAds();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("aktive");

  const all = ads.data ?? [];
  const live = all.filter((a) => a.status === "publisert");
  const applicants = all.reduce((n, a) => n + a.applicantsTotal, 0);
  const waiting = all.flatMap((a) => a.publications).some((p) => p.state === "venter" && !p.manual);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Annonser"
        description={`${live.length} aktive annonser · ${numFmt.format(applicants)} søkere totalt`}
        source="Nav, Indeed, Finn og andre jobbplattformer"
        lastUpdated={ads.dataUpdatedAt ? new Date(ads.dataUpdatedAt) : undefined}
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
        {(list) => {
          const count = (v: View) => list.filter((a) => a.status === VIEW_STATUS[v]).length;
          const shown = list.filter((a) => a.status === VIEW_STATUS[view]);
          return (
            <>
              <Segmented<View>
                value={view}
                onChange={setView}
                ariaLabel="Vis annonser"
                layoutId="ads-view"
                options={[
                  { value: "aktive", label: `Aktive · ${count("aktive")}` },
                  { value: "utkast", label: `Utkast · ${count("utkast")}` },
                  { value: "avsluttet", label: `Avsluttet · ${count("avsluttet")}` },
                ]}
              />
              {waiting && view === "aktive" && <WaitingNotice onRefresh={() => ads.refetch()} />}
              {shown.length === 0
                ? <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{VIEW_EMPTY[view]}</p>
                : shown.map((ad) => <AdCard key={ad.id} ad={ad} />)}
            </>
          );
        }}
      </QueryBoundary>

      <NewAdDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/** A board is still answering. Refresh by itself a few times, then hand it to the user. */
function WaitingNotice({ onRefresh }: { onRefresh: () => void }) {
  const [tries, setTries] = React.useState(0);
  React.useEffect(() => {
    if (tries >= 6) return;
    const t = setTimeout(() => { onRefresh(); setTries((n) => n + 1); }, 4000);
    return () => clearTimeout(t);
  }, [tries, onRefresh]);
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm">
      <Mascot {...mascotFor("loading", "Venter på svar fra plattformene")} size={56} />
      <span className="flex-1">Noen plattformer har ikke svart ennå. Annonsen er lagret, og siden oppdateres av seg selv.</span>
      {tries >= 6 && <Button size="sm" variant="outline" onClick={() => { setTries(0); onRefresh(); }}>Oppdater</Button>}
    </div>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  const meta = useAdMeta();
  const publish = usePublishAd();
  const unpublish = useUnpublishAd();
  const [actionError, setActionError] = React.useState<string | null>(null);

  const live = ad.publications.filter((p) => !p.unpublishedAt);
  const missing = (meta.data?.boards ?? []).filter((b) => b.free && !live.some((p) => p.platform === b.key)).map((b) => b.key);
  const left = ad.deadline ? daysUntil(ad.deadline) : null;

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try { await fn(); } catch (e) { setActionError(errorMessage(e)); }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{ad.title}</h2>
              <Badge className={STATUS_TONE[ad.status]}>{AD_STATUS_LABEL[ad.status]}</Badge>
              {ad.unpublishedReason === "frist" && (
                <Badge variant="outline" className="gap-1 border-warning/40 text-warning-on-tint">
                  <CalendarX className="size-3" aria-hidden /> Fristen gikk ut
                </Badge>
              )}
              {ad.status === "publisert" && left !== null && left >= 0 && left <= 7 && (
                <Badge variant="outline" className="gap-1 border-warning/40 text-warning-on-tint">
                  <Clock className="size-3" aria-hidden /> {left === 0 ? "Stenger i dag" : `Stenger om ${left} dag${left === 1 ? "" : "er"}`}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ad.jobType} · {ad.location}{ad.campaign && ` · ${ad.campaign}`}{ad.createdBy && ` · laget av ${ad.createdBy}`}
              {ad.deadline && ` · søknadsfrist ${dayFmt.format(new Date(ad.deadline))}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ad.status === "publisert" && (
              <Button size="sm" variant="outline" disabled={unpublish.isPending}
                onClick={() => run(() => unpublish.mutateAsync({ id: ad.id }))}>
                Avpubliser
              </Button>
            )}
            {missing.length > 0 && !(ad.deadline && left !== null && left < 0) && (
              <Button size="sm" className="gap-1.5" disabled={publish.isPending}
                onClick={() => run(() => publish.mutateAsync({ id: ad.id, platforms: missing }))}>
                <Globe className="size-4" /> {ad.status === "publisert" ? "Publiser på flere" : "Publiser"}
              </Button>
            )}
          </div>
        </div>
        {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}

        {ad.publications.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            Ikke publisert ennå. Publiser for å få sporingslenker og søkertall per kanal.
          </p>
        ) : (
          <PublicationTable ad={ad} />
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Vis annonseteksten</summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-[13px] leading-relaxed">{ad.body}</p>
        </details>

        {live[0] && (
          <a
            href={new URL(live[0].trackingUrl).pathname + new URL(live[0].trackingUrl).search}
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

function PublicationTable({ ad }: { ad: Ad }) {
  const [copied, setCopied] = React.useState<string | null>(null);
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
    <>
    {/* Phone (IFK-08, 08 §2): one card per platform instead of a squashed table. */}
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border sm:hidden">
      {ad.publications.map((p) => (
        <li key={p.id} className={`flex flex-col gap-2 p-3 ${p.unpublishedAt ? "text-muted-foreground" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium">{p.platformName}</span>
            <span className="shrink-0 text-sm tabular-nums">{numFmt.format(p.applicants)} søkere</span>
          </div>
          <PublicationState ad={ad} p={p} />
          {p.externalId && <span className="font-mono text-xs text-muted-foreground">ID {p.externalId}</span>}
          <button
            type="button"
            onClick={() => copy(p.trackingUrl, p.id)}
            className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-border px-2 text-left font-mono text-xs text-muted-foreground"
            aria-label={`Kopier sporingslenken for ${p.platformName}`}
          >
            <span className="min-w-0 flex-1 truncate">{p.trackingUrl}</span>
            {copied === p.id ? <Check className="size-4 shrink-0 text-success" aria-hidden /> : <Copy className="size-4 shrink-0" aria-hidden />}
          </button>
        </li>
      ))}
      <li className="flex justify-between p-3 text-sm"><span className="text-muted-foreground">Totalt</span><span className="font-medium tabular-nums">{numFmt.format(ad.applicantsTotal)}</span></li>
    </ul>
    <div className="hidden overflow-x-auto sm:block">
      {/* Fixed columns: «Status» starts in the same place on every card, so the eye can run down the page. */}
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[34%] sm:w-[22%]" />
          <col className="w-[38%] sm:w-[28%]" />
          <col className="hidden sm:table-column sm:w-[14%]" />
          <col className="w-[13%] sm:w-[9%]" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Plattform</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="hidden pb-2 font-medium sm:table-cell">Ekstern ID</th>
            <th className="pb-2 text-right font-medium">Søkere</th>
            <th className="pb-2 pl-3 font-medium">Sporingslenke</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ad.publications.map((p) => (
            <tr key={p.id} className={p.unpublishedAt ? "text-muted-foreground" : undefined}>
              <td className="py-2 pr-2 align-top">{p.platformName}</td>
              <td className="py-2 pr-2 align-top"><PublicationState ad={ad} p={p} /></td>
              <td className="hidden py-2 align-top font-mono text-xs sm:table-cell">{p.externalId || "—"}</td>
              <td className="py-2 text-right align-top tabular-nums">{numFmt.format(p.applicants)}</td>
              <td className="py-2 pl-3 align-top">
                <button
                  type="button"
                  onClick={() => copy(p.trackingUrl, p.id)}
                  className="group flex w-full min-w-0 items-center gap-1.5 rounded px-1 text-left font-mono text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Kopier sporingslenken"
                  aria-label={`Kopier sporingslenken for ${p.platformName}`}
                >
                  <span className="truncate">{p.trackingUrl}</span>
                  {copied === p.id
                    ? <Check className="size-3 shrink-0 text-success" aria-hidden />
                    : <Copy className="size-3 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="pt-2 text-xs text-muted-foreground" colSpan={2}>Totalt</td>
            <td className="hidden sm:table-cell" />
            <td className="pt-2 text-right font-medium tabular-nums">{numFmt.format(ad.applicantsTotal)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
    </>
  );
}

/** The per-board state, with the one action that state needs. Crossfades on change. */
function PublicationState({ ad, p }: { ad: Ad; p: Publication }) {
  const reduce = useReducedMotion();
  const retry = useRetryPublication();
  const manual = useMarkManualPublished();
  const [externalId, setExternalId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const label = p.manual && p.state === "venter" ? "Venter på manuell publisering" : PUBLICATION_STATE_LABEL[p.state];

  return (
    <div className="flex flex-col gap-1.5">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={p.state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.12 : 0.2 }}
        >
          <Badge variant="outline" className={`gap-1 text-[11px] ${PUB_TONE[p.state]}`}>
            {p.state === "feilet" && <AlertTriangle className="size-3" aria-hidden />}
            {p.manual && p.state === "venter" && <Hand className="size-3" aria-hidden />}
            {label}
          </Badge>
        </motion.span>
      </AnimatePresence>
      {p.state === "feilet" && (
        <>
          {p.lastError && <span className="max-w-[18rem] text-xs text-danger">{p.lastError}</span>}
          <Button size="sm" variant="outline" className="h-8 w-fit gap-1" disabled={retry.isPending}
            onClick={() => retry.mutate({ id: ad.id, platform: p.platform })}>
            <RotateCcw className="size-3" /> Prøv igjen
          </Button>
        </>
      )}
      {p.manual && p.state === "venter" && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (!externalId.trim()) { setError("Lim inn annonse-ID-en fra plattformen."); return; }
            try { await manual.mutateAsync({ id: ad.id, platform: p.platform, externalId }); }
            catch (err) { setError(errorMessage(err)); }
          }}
        >
          <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder={`${p.platformName}-ID`}
            aria-label={`Annonse-ID fra ${p.platformName}`} className="h-8 w-[8.5rem] text-xs" />
          <Button size="sm" type="submit" variant="outline" className="h-8" disabled={manual.isPending}>Lagre</Button>
        </form>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Annonser() {
  return (
    <PermissionGate permission="ads.view">
      <AnnonserPage />
    </PermissionGate>
  );
}
