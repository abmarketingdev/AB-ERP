"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, ArrowRight, Users, Copy, Trash2, X, Share2 } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useLeads, useLeadCounts, useLeadMeta, useSendLeads, useAssignLeads, useDiscardLeads, type LeadQuery,
} from "@/lib/api/leads";
import { LEAD_STATUS_LABEL, type Lead, type LeadStatus } from "@/types/lead";
import { MergeDuplicatesDialog } from "@/components/patterns/merge-duplicates-dialog";
import { AudienceExportDialog } from "@/components/patterns/audience-export";
import { ChannelMark, ChannelLabel } from "@/components/patterns/channel-mark";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { errorMessage } from "@/lib/api/client";

/**
 * LEAD-01 — the samleinnboks.
 *
 * The one screen that is genuinely new in this SRS: every channel lands here
 * first, and nothing reaches the recruitment pipeline until somebody sends it
 * on. The table is therefore not a candidate list with a filter — it is a
 * worklist, and the primary action is a bulk one.
 *
 * Filtering and paging are server-side (recruitment-service, indexed per LEAD-08
 * filter). IFK-07 asks for under two seconds with 10 000 leads, and the footer
 * prints what the request actually cost so that claim can be checked rather than
 * asserted. Fifty rows a page is why the table is not virtualised: the DOM never
 * holds more than fifty, and a virtualiser over fifty rows adds work, not speed.
 *
 * Filters live in the URL (data contract l.210), so a filtered inbox can be
 * linked, bookmarked and survives a reload. Options come from `/leads/meta`.
 */

const PAGE_SIZE = 50;
const ALL = "alle";

const STATUS_TONE: Record<LeadStatus, string> = {
  ny: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  sendt: "bg-success/10 text-success",
  duplikat: "bg-warning/10 text-warning-on-tint",
  forkastet: "bg-muted text-muted-foreground line-through",
};

const CHANNEL_TONE: Record<string, string> = {
  betalt: "border-[var(--ab-accent-9)]/40",
  organisk: "border-success/40",
  stand: "border-warning/40",
};

const dateFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const numFmt = new Intl.NumberFormat("nb-NO");

/** One filter value, read from and written to the URL. */
function useUrlFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = (k: string, fallback = "") => params.get(k) ?? fallback;
  const set = React.useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, router, pathname]);
  return { get, set };
}

function SamleinnboksPage() {
  const url = useUrlFilters();
  const [q, setQ] = React.useState(url.get("q"));
  const debouncedQ = url.get("q");
  const channel = url.get("channel", ALL);
  const status = url.get("status", ALL);
  const promoter = url.get("promoter", ALL);
  const assignedTo = url.get("assignedTo", ALL);
  const from = url.get("from");
  const to = url.get("to");
  const duplicatesOnly = url.get("duplicates") === "1";
  const page = Math.max(1, Number(url.get("page", "1")) || 1);
  const setChannel = (v: string) => url.set({ channel: v, page: null });
  const setStatus = (v: string) => url.set({ status: v, page: null });
  const setPromoter = (v: string) => url.set({ promoter: v, page: null });
  const setAssignedTo = (v: string) => url.set({ assignedTo: v, page: null });
  const setFrom = (v: string) => url.set({ from: v, page: null });
  const setTo = (v: string) => url.set({ to: v, page: null });
  const setDuplicatesOnly = (v: boolean) => url.set({ duplicates: v ? "1" : null, page: null });
  const setPage = (fn: (p: number) => number) => url.set({ page: String(fn(page)) });
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [mergeFor, setMergeFor] = React.useState<Lead | null>(null);
  const [audienceOpen, setAudienceOpen] = React.useState(false);
  const meta = useLeadMeta();
  const [assignTarget, setAssignTarget] = React.useState("");
  const [lastSend, setLastSend] = React.useState<{ sent: number; skipped: number } | null>(null);
  const kindByName = React.useMemo(
    () => Object.fromEntries((meta.data?.channels ?? []).map((c) => [c.name, c.kind])), [meta.data]);

  /*
   * Typing should not fire a request per keystroke against a 10 000-row corpus.
   * 250 ms is long enough to coalesce a word and short enough that the table
   * still feels like it is reacting to you.
   */
  React.useEffect(() => {
    const t = setTimeout(() => { if (q !== debouncedQ) url.set({ q, page: null }); }, 250);
    return () => clearTimeout(t);
  }, [q, debouncedQ, url]);

  const filter: LeadQuery = React.useMemo(
    () => ({
      q: debouncedQ || undefined,
      channel: channel === ALL ? undefined : channel,
      status: status === ALL ? undefined : status,
      promoter: promoter === ALL ? undefined : promoter,
      assignedTo: assignedTo === ALL ? undefined : assignedTo,
      from: from || undefined,
      to: to || undefined,
      duplicates: duplicatesOnly || undefined,
      page,
    }),
    [debouncedQ, channel, status, promoter, assignedTo, from, to, duplicatesOnly, page],
  );

  // Any filter change resets the page (each setter clears `page` in the URL) and
  // the selection — page 7 of the old result set is not page 7 of the new one.
  React.useEffect(() => {
    setSelected(new Set());
  }, [debouncedQ, channel, status, promoter, assignedTo, from, to, duplicatesOnly]);

  const leads = useLeads(filter);
  const counts = useLeadCounts();
  const send = useSendLeads();
  const assign = useAssignLeads();
  const discard = useDiscardLeads();

  const rows = leads.data?.rows ?? [];
  const total = leads.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /*
   * Only "Ny" leads can be sent on, so the bulk bar counts those separately
   * from the selection. Selecting 40 rows and being told "Send 12" is clearer
   * than a button that silently skips 28.
   */
  const selectedRows = rows.filter((l) => selected.has(l.id));
  const sendable = selectedRows.filter((l) => l.status === "ny");
  const busy = send.isPending || assign.isPending || discard.isPending;

  const activeFilters =
    [channel, status, promoter, assignedTo].filter((v) => v !== ALL).length +
    (debouncedQ ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0) + (duplicatesOnly ? 1 : 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function clearFilters() {
    setQ("");
    url.set({ q: null, channel: null, status: null, promoter: null, assignedTo: null, from: null, to: null,
              duplicates: null, page: null });
  }

  async function runSend() {
    const result = await send.mutateAsync({ ids: sendable.map((l) => l.id) });
    setLastSend(result);
    setSelected(new Set());
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Samleinnboks"
        description={
          counts.data
            ? `${numFmt.format(counts.data.byStatus.ny ?? 0)} nye av ${numFmt.format(counts.data.total)} leads · ${numFmt.format(counts.data.duplicates)} mulige duplikater`
            : "Alle leads samles her før de sendes videre til rekruttering"
        }
        source="Meta, TikTok, Finn, Nav, Indeed, nettside og stand"
        lastUpdated={new Date()}
        actions={
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAudienceOpen(true)}>
            <Share2 className="size-4" /> Eksporter målgruppe
          </Button>
        }
      />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk på navn, e-post eller telefon"
            className="pl-9"
            aria-label="Søk i samleinnboksen"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect label="Kanal" value={channel} onChange={setChannel}
            options={(meta.data?.channels ?? []).map((c) => ({ value: c.key, label: c.name, node: <ChannelLabel channel={c.name} /> }))} />
          <FilterSelect label="Status" value={status} onChange={setStatus}
            options={(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} />
          <FilterSelect label="Rekruttert av" value={promoter} onChange={setPromoter}
            options={(meta.data?.promoters ?? []).map((p) => ({ value: p.id, label: p.name }))} />
          <FilterSelect label="Tildelt" value={assignedTo} onChange={setAssignedTo}
            options={[{ value: "__none__", label: "Admin-kø (ikke tildelt)" },
                      ...(meta.data?.recruiters ?? []).map((r) => ({ value: r.id, label: r.name }))]} />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-from" className="text-xs text-muted-foreground">Fra dato</Label>
            <Input id="lead-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[10.5rem]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lead-to" className="text-xs text-muted-foreground">Til dato</Label>
            <Input id="lead-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[10.5rem]" />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <Checkbox checked={duplicatesOnly} onCheckedChange={(v) => setDuplicatesOnly(Boolean(v))} />
            Bare mulige duplikater
          </label>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
              <X className="size-4" /> Nullstill {activeFilters} filter
            </Button>
          )}
        </div>
      </div>

      {/* ── Bulk actions (LEAD-08, LEAD-09) ─────────────────────────────── */}
      {selected.size > 0 && (
        <Card className="border-[var(--ab-accent-9)]/40">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <span className="text-sm font-medium">{selected.size} valgt</span>
            <Button size="sm" className="gap-1.5" disabled={!sendable.length || busy} onClick={runSend}>
              <ArrowRight className="size-4" />
              Send {sendable.length} til rekruttering
            </Button>
            <div className="flex items-center gap-2">
              <Select value={assignTarget} onValueChange={setAssignTarget}>
                <SelectTrigger size="sm" className="w-[11rem]" aria-label="Tildel til"><SelectValue placeholder="Velg kollega" /></SelectTrigger>
                <SelectContent>
                  {(meta.data?.recruiters ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={busy || !assignTarget}
                onClick={async () => { await assign.mutateAsync({ ids: [...selected], assignTo: assignTarget }); setSelected(new Set()); }}>
                <Users className="size-4" /> Tildel
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="gap-1.5 text-danger" disabled={busy}
              onClick={async () => { await discard.mutateAsync({ ids: [...selected] }); setSelected(new Set()); }}>
              <Trash2 className="size-4" /> Forkast
            </Button>
            {sendable.length < selected.size && (
              <span className="text-xs text-muted-foreground">
                {selected.size - sendable.length} er allerede behandlet og hoppes over
              </span>
            )}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
              Avbryt valg
            </Button>
          </CardContent>
        </Card>
      )}

      {lastSend && (
        <p role="status" className="text-sm text-muted-foreground">
          {lastSend.sent === 1 ? "1 lead sendt" : `${lastSend.sent} leads sendt`} til rekruttering
          {lastSend.skipped > 0 && ` · ${lastSend.skipped} hoppet over (allerede behandlet eller duplikat av en kandidat — slå sammen først)`}
        </p>
      )}

      {(send.isError || assign.isError || discard.isError) && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(send.error ?? assign.error ?? discard.error)}
        </p>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <QueryBoundary
        query={leads}
        skeleton={<TableSkeleton />}
        isEmpty={(d) => d.rows.length === 0}
        emptyTitle="Ingen leads matcher filteret"
        emptyDescription={
          activeFilters
            ? "Prøv å fjerne et filter, eller utvid datoperioden."
            : "Alt er sendt videre. Nye leads fra Meta, TikTok, Finn, Nav, Indeed, nettsiden og stand dukker opp her automatisk."
        }
        emptyPose={activeFilters ? undefined : "hammock"}
      >
        {() => (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          aria-label="Velg alle på siden"
                          checked={rows.length > 0 && selected.size === rows.length}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>Navn</TableHead>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Kampanje</TableHead>
                      <TableHead>Mottatt</TableHead>
                      <TableHead>Rekruttert av</TableHead>
                      <TableHead>Tildelt</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Duplikat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((lead) => (
                      <TableRow key={lead.id} data-state={selected.has(lead.id) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Velg ${lead.name}`}
                            checked={selected.has(lead.id)}
                            onCheckedChange={() => toggle(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">{lead.phone} · {lead.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1.5 ${CHANNEL_TONE[kindByName[lead.channel] ?? "organisk"]}`}>
                            <ChannelMark channel={lead.channel} />
                            {lead.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.campaign}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {dateFmt.format(new Date(lead.receivedAt))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.promoter ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.assignedTo ?? "Admin-kø"}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_TONE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {lead.duplicateOf.length > 0 ? (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMergeFor(lead)}>
                              <Copy className="size-3.5" /> {lead.duplicateOf.length}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paging + the IFK-07 timing, stated rather than claimed. */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  Viser {numFmt.format((page - 1) * PAGE_SIZE + 1)}–
                  {numFmt.format(Math.min(page * PAGE_SIZE, total))} av {numFmt.format(total)}
                  {leads.data ? ` · hentet på ${leads.data.tookMs} ms` : ""}
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || leads.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}>Forrige</Button>
                  <span className="tabular-nums text-muted-foreground">Side {page} av {numFmt.format(pages)}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages || leads.isFetching}
                    onClick={() => setPage((p) => p + 1)}>Neste</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      <MergeDuplicatesDialog lead={mergeFor} onClose={() => setMergeFor(null)} />
      <AudienceExportDialog open={audienceOpen} onClose={() => setAudienceOpen(false)} />
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; node?: React.ReactNode }[];
}) {
  /*
   * The label has to be tied to the trigger with htmlFor/id. A bare <Label>
   * next to a Radix Select looks right and is useless: a screen reader
   * announces the control as "Alle, combobox" with no indication of what it
   * filters, and the design checklist requires every form control to be
   * associated with its label.
   */
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.node ?? o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </CardContent>
    </Card>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Samleinnboks() {
  return (
    <PermissionGate permission="leads.view">
      {/* useSearchParams needs a Suspense boundary to render statically (Next 16). */}
      <React.Suspense fallback={<TableSkeleton />}>
        <SamleinnboksPage />
      </React.Suspense>
    </PermissionGate>
  );
}
