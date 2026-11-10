"use client";

import * as React from "react";
import { ChevronDown, Mail, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidateMessages, type CandidateMessage } from "@/lib/api/recruitment";
import { showDate } from "@/lib/show-date";
import { formatPhone } from "@/lib/format";

/**
 * R8 (client 09.11) «Sendt til kandidaten»: every e-mail and SMS the candidate got —
 * booking, reminder, re-booking, cancellation, rejection — newest first, with when, to
 * what address and whether it went out. The text opens on click. Booking and opt-out
 * links arrive masked from the server: they are the candidate's, not ours.
 */

const STATUS_TONE: Record<string, string> = {
  delivered: "border-success/40 text-success",
  sent: "border-success/40 text-success",
  queued: "border-border text-muted-foreground",
  failed: "border-danger/40 text-danger",
  blocked_optout: "border-warning/40 text-warning-on-tint",
  blocked_off: "border-warning/40 text-warning-on-tint",
  cancelled: "border-border text-muted-foreground",
};

export function CandidateMessages({ candidateId }: { candidateId: string }) {
  const messages = useCandidateMessages(candidateId);
  return (
    <section className="flex flex-col gap-3" aria-labelledby="sendt-til-kandidaten">
      <div>
        <h2 id="sendt-til-kandidaten" className="text-sm font-medium text-foreground">Sendt til kandidaten</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">E-post og SMS fra systemet, nyeste først. Trykk for å lese teksten.</p>
      </div>
      {messages.isPending && messages.fetchStatus !== "idle" ? (
        <Skeleton className="h-20 rounded-lg" />
      ) : messages.isError ? (
        <p role="alert" className="text-sm text-danger">Kunne ikke hente meldingene. Last siden på nytt.</p>
      ) : (messages.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen meldinger sendt ennå.</p>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {(messages.data ?? []).map((m) => <MessageRow key={m.id} m={m} />)}
          </ul>
        </Card>
      )}
    </section>
  );
}

function MessageRow({ m }: { m: CandidateMessage }) {
  const [open, setOpen] = React.useState(false);
  const bodyId = `msg-${m.id}`;
  const Icon = m.channel === "sms" ? MessageSquare : Mail;
  const when = m.deliveredAt ?? m.sentAt ?? m.createdAt;
  const to = m.channel === "sms" ? formatPhone(m.to) : m.to;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 px-4 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="mt-0.5 size-4 text-muted-foreground" aria-label={m.channelLabel} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{m.label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[m.channelLabel, m.subject || null, to].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">{showDate(when, true)}</span>
          <span className="flex items-center gap-1">
            <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[m.status] ?? "border-border text-muted-foreground"}`}>
              {m.statusLabel}
            </Badge>
            <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
        </span>
      </button>
      {open && (
        <div id={bodyId} className="border-t border-border bg-muted/20 px-4 py-3">
          {m.subject && <p className="mb-1 text-sm font-medium">{m.subject}</p>}
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{m.body}</p>
          {m.error && <p className="mt-2 text-xs text-danger">Feil: {m.error}</p>}
          {m.sendAfter && m.status === "queued" && (
            <p className="mt-2 text-xs text-muted-foreground">Sendes tidligst {showDate(m.sendAfter, true)}.</p>
          )}
        </div>
      )}
    </li>
  );
}
