"use client";

import * as React from "react";
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
  useLeads, useLeadCounts, useSendLeads, useAssignLeads, useDiscardLeads, type LeadQuery,
} from "@/lib/api/leads";
import { LEAD_STATUS_LABEL, LEAD_CHANNELS, CHANNEL_KIND, type Lead, type LeadStatus } from "@/types/lead";
import { LEAD_PROMOTERS, LEAD_RECRUITERS } from "@/mocks/leads";
import { MergeDuplicatesDialog } from "@/components/patterns/merge-duplicates-dialog";
import { AudienceExportDialog } from "@/components/patterns/audience-export";
import { ChannelMark, ChannelLabel } from "@/components/patterns/channel-mark";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * LEAD-01 — the samleinnboks.
 *
 * The one screen that is genuinely new in this SRS: every channel lands here
 * first, and nothing reaches the recruitment pipeline until somebody sends it
 * on. The table is therefore not a candidate list with a filter — it is a
 * worklist, and the primary action is a bulk one.
 *
 * Filtering and paging are server-side (see mocks/lead-query.ts). IFK-07 asks
 * for under two seconds with 10 000 leads, and the footer prints what the
 * request actually cost so that claim can be checked rather than asserted.
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

function SamleinnboksPage() {
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [channel, setChannel] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [promoter, setPromoter] = React.useState(ALL);
  const [assignedTo, setAssignedTo] = React.useState(ALL);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [duplicatesOnly, setDuplicatesOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [mergeFor, setMergeFor] = React.useState<Lead | null>(null);
  const [audienceOpen, setAudienceOpen] = React.useState(false);
  const [assignTarget, setAssignTarget] = React.useState(LEAD_RECRUITERS[0]);

  /*
   * Typing should not fire a request per keystroke against a 10 000-row corpus.
   * 250 ms is long enough to coalesce a word and short enough that the table
   * still feels like it is reacting to you.
   */
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

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

  // Any filter change invalidates the page you were on — page 7 of the old
  // result set is not page 7 of the new one.
  React.useEffect(() => {
    setPage(1);
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
    setQ(""); setChannel(ALL); setStatus(ALL); setPromoter(ALL);
    setAssignedTo(ALL); setFrom(""); setTo(""); setDuplicatesOnly(false);
  }

  async function runSend() {
    await send.mutateAsync({ ids: sendable.map((l) => l.id) });
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
            options={LEAD_CHANNELS.map((c) => ({ value: c, label: c, node: <ChannelLabel channel={c} /> }))} />
          <FilterSelect label="Status" value={status} onChange={setStatus}
            options={(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} />
          <FilterSelect label="Promotør" value={promoter} onChange={setPromoter}
            options={LEAD_PROMOTERS.map((p) => ({ value: p, label: p }))} />
          <FilterSelect label="Tildelt" value={assignedTo} onChange={setAssignedTo}
            options={[{ value: "__none__", label: "Ikke tildelt" }, ...LEAD_RECRUITERS.map((r) => ({ value: r, label: r }))]} />
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
                <SelectTrigger size="sm" className="w-[11rem]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_RECRUITERS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={busy}
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

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <QueryBoundary
        query={leads}
        skeleton={<TableSkeleton />}
        isEmpty={(d) => d.rows.length === 0}
        emptyTitle="Ingen leads matcher filteret"
        emptyDescription={
          activeFilters
            ? "Prøv å fjerne et filter, eller utvid datoperioden."
            : "Nye leads fra Meta, TikTok, Finn, Nav, Indeed, nettsiden og stand dukker opp her automatisk."
        }
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
                      <TableHead>Promotør</TableHead>
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
                          <Badge variant="outline" className={`gap-1.5 ${CHANNEL_TONE[CHANNEL_KIND[lead.channel]]}`}>
                            <ChannelMark channel={lead.channel} />
                            {lead.channel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.campaign}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {dateFmt.format(new Date(lead.receivedAt))}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.promoter ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.assignedTo ?? "—"}</TableCell>
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
      <SamleinnboksPage />
    </PermissionGate>
  );
}
