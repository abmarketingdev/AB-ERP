"use client";

import * as React from "react";
import { FileText, UserRound } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChannelMark } from "@/components/patterns/channel-mark";
import type { Lead } from "@/types/lead";
import type { CandidateApplication } from "@/types/recruitment";

/*
 * Client 16.11: what a person answered in the application form — above all «Hvem tipset
 * deg?» — must be visible in the portal, not only in the e-mail. The inbox shows it on the
 * lead, and the candidate card keeps showing it after the lead is sent on.
 */

const when = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** «Tipset av Ola Nordmann» — one line, for table cells and cards. */
export function ReferredBy({ name, className = "" }: { name?: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span className={`inline-flex max-w-full items-center gap-1 text-xs ${className}`}>
      <UserRound className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">Tipset av</span>
      <span className="truncate font-medium text-foreground">{name}</span>
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** The facts of one application: form, channel, time, hear-about, referrer, the rest of the answers. */
function ApplicationFacts({ form, channel, receivedAt, hearAbout, referredBy, lines }: {
  form: string; channel: string; receivedAt: string; hearAbout?: string | null; referredBy?: string | null; lines: string[];
}) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact label="Skjema">{form || "—"}</Fact>
        <Fact label="Kanal"><span className="inline-flex items-center gap-1.5"><ChannelMark channel={channel} />{channel}</span></Fact>
        <Fact label="Mottatt"><span className="tabular-nums">{when.format(new Date(receivedAt))}</span></Fact>
        <Fact label="Hvor hørte du om oss">{hearAbout || <span className="text-muted-foreground">Ikke oppgitt</span>}</Fact>
        {referredBy && (
          <div className="sm:col-span-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">Tipset av</dt>
            <dd className="mt-1 inline-flex items-center gap-2 rounded-md border border-[var(--ab-accent-6)] bg-[var(--ab-accent-3)]/40 px-2.5 py-1 text-sm font-medium text-[var(--ab-accent-12)]">
              <UserRound className="size-3.5" aria-hidden /> {referredBy}
            </dd>
          </div>
        )}
      </dl>
      {lines.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">Svar i skjemaet</p>
          <ul className="mt-1 space-y-0.5 text-sm text-foreground">
            {lines.map((l, i) => <li key={i} className="break-words">{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

const HORTE = /^\s*Hørte om oss:/;

/** Inbox: a small «Søknad» button that opens what the person wrote. Hidden when there is nothing to show. */
export function LeadApplicationButton({ lead }: { lead: Lead }) {
  const [open, setOpen] = React.useState(false);
  const lines = (lead.note ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !HORTE.test(l));
  if (!lead.note && !lead.hearAbout && !lead.referredBy) return null;
  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="mt-1 h-7 gap-1 px-2 text-xs"
        onClick={() => setOpen(true)} aria-label={`Vis søknaden fra ${lead.name}`}>
        <FileText className="size-3.5" aria-hidden /> Søknad
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Søknad fra {lead.name}</DialogTitle>
            <DialogDescription>Det personen fylte ut i skjemaet.</DialogDescription>
          </DialogHeader>
          <ApplicationFacts form={lead.campaign} channel={lead.channel} receivedAt={lead.receivedAt}
            hearAbout={lead.hearAbout} referredBy={lead.referredBy} lines={lines} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Candidate card: every application behind the candidate (a re-application adds one). */
export function CandidateApplications({ applications }: { applications: CandidateApplication[] }) {
  if (applications.length === 0) return null;
  const newestFirst = [...applications].reverse();
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-foreground">{applications.length === 1 ? "Søknaden" : `Søknader (${applications.length})`}</h2>
      <p className="-mt-2 text-xs text-muted-foreground">Det kandidaten fylte ut i skjemaet, slik det kom inn i samleinnboksen.</p>
      <Card>
        <ul className="divide-y divide-border">
          {newestFirst.map((a) => (
            <li key={a.leadId} className="px-4 py-4">
              <ApplicationFacts form={a.form} channel={a.channel} receivedAt={a.receivedAt}
                hearAbout={a.hearAbout} referredBy={a.referredBy} lines={a.lines} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
