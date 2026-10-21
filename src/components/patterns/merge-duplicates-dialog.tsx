"use client";

import * as React from "react";
import { Check, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDismissDuplicate, useLeads, useMergeLeads } from "@/lib/api/leads";
import { errorMessage } from "@/lib/api/client";
import { LEAD_STATUS_LABEL, type Lead } from "@/types/lead";
import { ChannelMark } from "@/components/patterns/channel-mark";
import { contactLine } from "@/lib/phone";

/**
 * LEAD-07 — "oppdage duplikater på telefon og epost og la rekrutterer slå dem
 * sammen".
 *
 * The decision this screen exists to support is *which record survives*, so it
 * shows the candidates side by side with the fields that differ, rather than
 * asking for a yes/no on a merge whose outcome you cannot see. The default is
 * the one with the most complete record, not the oldest — an older row with a
 * missing e-mail is the worse one to keep.
 *
 * Merging is not deletion: the folded-away rows become `duplikat` and stay
 * visible under that filter. Somebody will ask why there were three records for
 * one person, and a deleted row cannot answer. An admin can undo a merge.
 *
 * The server decides the attribution channel, not this choice: whichever record is
 * kept, the person counts for the OLDEST lead's channel (master 21.10), and that
 * is stated here so the recruiter is not surprised by it.
 */
export function MergeDuplicatesDialog({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const merge = useMergeLeads();
  const dismiss = useDismissDuplicate();
  const [picked, setKeepId] = React.useState<string | null>(null);

  /*
   * The duplicates are fetched rather than passed in: the matches are computed
   * over the whole corpus, so the other records are almost never on the page
   * the recruiter is looking at.
   */
  const dupes = useLeads({ q: lead?.phone, page: 1 });
  const byEmail = useLeads({ q: lead?.email, page: 1 });

  const group = React.useMemo(() => {
    if (!lead) return [];
    const seen = new Map<string, Lead>();
    seen.set(lead.id, lead);
    for (const l of [...(dupes.data?.rows ?? []), ...(byEmail.data?.rows ?? [])]) {
      if (l.id === lead.id || lead.duplicateOf.includes(l.id)) seen.set(l.id, l);
    }
    return [...seen.values()];
  }, [lead, dupes.data, byEmail.data]);

  const loading = dupes.isPending || byEmail.isPending;

  /** Completeness beats age: more filled-in fields wins, ties go to the oldest. */
  const bestId = React.useMemo(() => {
    if (!group.length) return null;
    // A lead already sent on is a candidate: it must be the one kept (the server
    // refuses folding a candidate into an inbox lead).
    const score = (l: Lead) =>
      (l.candidateId ? 10 : 0) + (l.email ? 2 : 0) + (l.phone ? 2 : 0) + (l.promoter ? 1 : 0) +
      (l.assignedTo ? 1 : 0) + (l.consent.adAudience ? 1 : 0);
    return [...group].sort((a, b) => score(b) - score(a) || (a.receivedAt < b.receivedAt ? -1 : 1))[0].id;
  }, [group]);
  const keepId = picked && group.some((l) => l.id === picked) ? picked : bestId;

  const others = group.filter((l) => l.id !== keepId);

  const oldest = group.length ? [...group].sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : 1))[0] : null;

  async function run() {
    if (!keepId || !others.length) return;
    try {
      await merge.mutateAsync({ keepId, mergeIds: others.map((l) => l.id) });
      onClose();
    } catch { /* shown below from merge.error */ }
  }

  /** «Ikke duplikat» — the same phone or e-mail, but two different people. */
  async function notDuplicate() {
    if (!lead) return;
    try {
      for (const other of group.filter((l) => l.id !== lead.id)) {
        await dismiss.mutateAsync({ id: lead.id, otherId: other.id });
      }
      onClose();
    } catch { /* shown below */ }
  }

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Slå sammen duplikater</DialogTitle>
          <DialogDescription>
            Samme person er registrert fra flere kanaler. Velg hvilken oppføring som skal beholdes —
            de andre merkes som duplikat og blir liggende, de slettes ikke.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {group.map((l) => {
              const keep = l.id === keepId;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setKeepId(l.id)}
                  aria-pressed={keep}
                  className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                    keep ? "border-[var(--ab-accent-9)] bg-[var(--ab-accent-3)]/30" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {keep && <Check className="size-4 text-[var(--ab-accent-9)]" />}
                    <span className="font-medium">{l.name}</span>
                    <Badge variant="outline" className="gap-1.5"><ChannelMark channel={l.channel} />{l.channel}</Badge>
                    <Badge variant="outline">{LEAD_STATUS_LABEL[l.status]}</Badge>
                    {keep && <span className="ml-auto text-xs text-[var(--ab-accent-9)]">Beholdes</span>}
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground">
                    {contactLine(l.phone, l.email)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mottatt {new Intl.DateTimeFormat("nb-NO", { dateStyle: "long" }).format(new Date(l.receivedAt))}
                    {l.promoter ? ` · registrert av ${l.promoter}` : ""}
                    {l.assignedTo ? ` · tildelt ${l.assignedTo}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Samtykke: kontakt {l.consent.contact ? "ja" : "nei"} ·
                    {" "}annonsemålgrupper {l.consent.adAudience ? "ja" : "nei"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/*
          LEAD-10 — consents are not unioned: the person's latest answer per purpose
          wins, so a «nei» given later beats an older «ja». Stated before the button,
          not discovered after.
        */}
        {group.some((l) => l.consent.adAudience) && group.some((l) => !l.consent.adAudience) && (
          <p className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs text-warning-on-tint">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Oppføringene har ulikt svar på samtykke til annonsemålgrupper. Etter sammenslåing gjelder
            det siste svaret personen ga.
          </p>
        )}
        {oldest && (
          <p className="text-xs text-muted-foreground">
            Personen telles på kanalen der de først kom inn: <span className="font-medium">{oldest.channel}</span>.
          </p>
        )}
        {(merge.isError || dismiss.isError) && (
          <p role="alert" className="text-sm text-danger">{errorMessage(merge.error ?? dismiss.error)}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Avbryt</Button>
          <Button variant="outline" onClick={notDuplicate} disabled={dismiss.isPending || group.length < 2}>
            Ikke duplikat
          </Button>
          <Button onClick={run} disabled={!keepId || !others.length || merge.isPending}>
            {merge.isPending ? "Slår sammen…" : `Slå sammen ${others.length + 1} oppføringer`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
