"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CalendarCheck, ChevronDown, Clock, Mail, MessageSquare, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WeekSlotPicker } from "./week-slot-picker";
import { ConfirmStep } from "@/components/patterns/confirm-step";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCancelInterview, useKommerIkke, useLeaders, useOffices, useRebookInterview, useSetReminder } from "@/lib/api/interviews";
import { useHasPermission } from "@/lib/permissions";
import { LeaderPicker } from "./leader-picker";
import { errorMessage } from "@/lib/api/client";
import {
  CALENDAR_STATE_LABEL, INTERVIEW_STATUS_LABEL, MESSAGE_STATUS_LABEL,
  type CalendarState, type Interview, type InterviewStatus, type MessageStatus,
} from "@/types/interview";

/**
 * One interview, for the recruiter: what was booked, whether the calendar has
 * it, every message with its text AND its delivery status (BOOK-03 says what the
 * SMS must contain; «Levert» says it arrived), and the three things a recruiter
 * does to a booking — move it (BOOK-07), cancel it (BOOK-06), switch the
 * reminder (BOOK-05).
 */

const OSLO = "Europe/Oslo";
const fullFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const shortFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const STATUS_TONE: Record<InterviewStatus, string> = {
  booket: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  gjennomfort: "bg-success/10 text-success",
  avlyst: "bg-muted text-muted-foreground",
  "no-show": "bg-danger/10 text-danger",
  ombooket: "bg-muted text-muted-foreground",
};
const CAL_TONE: Record<CalendarState, string> = {
  venter: "text-warning-on-tint", synket: "text-success", feilet: "text-danger", avlyst: "text-muted-foreground",
};
const MSG_TONE: Record<MessageStatus, string> = {
  queued: "border-border text-muted-foreground", sent: "border-border text-muted-foreground",
  delivered: "border-success/40 text-success", failed: "border-danger/40 text-danger",
  blocked_optout: "border-warning/40 text-warning-on-tint", cancelled: "border-border text-muted-foreground",
};
const ROLE_LABEL = { kandidat: "kandidat", leder: "leder", rekrutterer: "rekrutterer" } as const;
const KIND_LABEL = { bekreftelse: "bekreftelse", paaminnelse: "påminnelse", avlysning: "avlysning", ombooking: "ombooking",
  "kansellering-kvittering": "kvittering" } as const;

const rowTime = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * «Kommende» for a recruiter: one dense row per interview (tid · kandidat · leder · status ·
 * handlinger), details on expand. A recruiter scans many bookings; the full card is for one.
 */
export function InterviewRow({ interview: iv }: { interview: Interview }) {
  const [open, setOpen] = React.useState(false);
  const [rebookOpen, setRebookOpen] = React.useState(false);
  // A blocked message is the person's own choice (§8.1 l.743), not a delivery failure.
  const failed = iv.messages.filter((m) => m.status === "failed").length;
  const optedOut = iv.messages.filter((m) => m.status === "blocked_optout").length;
  const detailsId = `iv-details-${iv.id}`;
  return (
    <li className="flex flex-col">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[9.5rem_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]">
        <span className="text-sm tabular-nums sm:order-none">{rowTime.format(new Date(iv.startsAt))}</span>
        <span className="col-start-1 row-start-2 min-w-0 truncate font-medium sm:col-start-auto sm:row-start-auto">{iv.candidateName}</span>
        <span className="hidden min-w-0 truncate text-sm text-muted-foreground sm:block">{iv.leader.name}</span>
        <span className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end sm:col-start-auto sm:row-start-auto">
          {iv.calendarState === "feilet" && (
            // An icon alone carries no meaning (08 §2): the words go with it.
            <Badge variant="outline" className="gap-1 border-danger/40 text-[10px] text-danger">
              <AlertTriangle className="size-3" aria-hidden /> {CALENDAR_STATE_LABEL.feilet}
            </Badge>
          )}
          {failed > 0 && <Badge variant="outline" className="border-danger/40 text-[10px] text-danger">{failed} ikke levert</Badge>}
          {optedOut > 0 && (
            <Badge variant="outline" className="border-warning/40 text-[10px] text-warning-on-tint" title="Mottakeren har meldt seg av SMS">
              {optedOut} avmeldt SMS
            </Badge>
          )}
          <Badge className={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABEL[iv.status]}</Badge>
        </span>
        <span className="col-start-2 row-start-2 flex items-center gap-1 justify-self-end sm:col-start-auto sm:row-start-auto">
          <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setRebookOpen(true)} aria-label={`Ombook intervjuet med ${iv.candidateName}`}>
            <RotateCcw className="size-3.5" /> <span className="hidden md:inline">Ombook</span>
          </Button>
          <Button size="icon" variant="ghost" className="size-9" aria-expanded={open} aria-controls={detailsId}
            aria-label={open ? "Skjul detaljer" : "Vis detaljer"} onClick={() => setOpen((o) => !o)}>
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </span>
      </div>
      {open && (
        <div id={detailsId} className="border-t border-border bg-muted/20 px-4 py-3">
          <InterviewDetails iv={iv} />
        </div>
      )}
      <RebookDialog iv={iv} open={rebookOpen} onOpenChange={setRebookOpen} />
    </li>
  );
}

function InterviewDetails({ iv }: { iv: Interview }) {
  const setReminder = useSetReminder();
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{fullFmt.format(new Date(iv.startsAt))}</span>
        <span>· {iv.location}</span>
        <span>· leder {iv.leader.name}</span>
        <span>· booket av {iv.bookedBy}</span>
        <span className={`flex items-center gap-1 ${CAL_TONE[iv.calendarState]}`}>
          · {iv.calendarState === "feilet" ? <AlertTriangle className="size-3" aria-hidden /> : <CalendarCheck className="size-3" aria-hidden />}
          {CALENDAR_STATE_LABEL[iv.calendarState]}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <CancelStep iv={iv} />
        {iv.status === "booket" && <KommerIkkeStep iv={iv} />}
        <label className="ml-auto flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={iv.reminderEnabled} disabled={setReminder.isPending}
            onCheckedChange={(v) => setReminder.mutate({ id: iv.id, reminderEnabled: v })} aria-label="Påminnelse dagen før" />
          Påminnelse dagen før{iv.reminderSentAt ? " (sendt)" : ""}
        </label>
      </div>
      <MessageList iv={iv} />
    </div>
  );
}

export function InterviewCard({ interview: iv }: { interview: Interview }) {
  const reduce = useReducedMotion();
  const setReminder = useSetReminder();
  const [rebookOpen, setRebookOpen] = React.useState(false);
  const open = iv.status === "booket";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{iv.candidateName}</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={iv.status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.2 }}>
              <Badge className={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABEL[iv.status]}</Badge>
            </motion.span>
          </AnimatePresence>
          <span className="text-sm tabular-nums text-muted-foreground">{fullFmt.format(new Date(iv.startsAt))}</span>
          <span className="text-sm text-muted-foreground">· {iv.leader.name}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{iv.location}</span>
          <span>· booket av {iv.bookedBy}</span>
          {iv.status !== "ombooket" && (
            <span className={`flex items-center gap-1 ${CAL_TONE[iv.calendarState]}`}>
              · {iv.calendarState === "feilet" ? <AlertTriangle className="size-3" aria-hidden /> : <CalendarCheck className="size-3" aria-hidden />}
              {CALENDAR_STATE_LABEL[iv.calendarState]}
            </span>
          )}
          {iv.cancelledBy && <span>· avlyst av {iv.cancelledBy === "kandidat" ? "kandidaten via lenken" : iv.cancelledBy}</span>}
        </p>

        {iv.attended !== null && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p>
              <span className="font-medium">{iv.attended ? "Møtte" : "Møtte ikke"}.</span>
              {iv.rating ? <span className="ml-1 text-muted-foreground">Vurdering {iv.rating}/5.</span> : null}
              {iv.recommend !== null ? <span className="ml-1 text-muted-foreground">{iv.recommend ? "Anbefales videre." : "Anbefales ikke videre."}</span> : null}
            </p>
            {iv.assessment && <p className="mt-1 whitespace-pre-wrap">{iv.assessment}</p>}
          </div>
        )}

        {open && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRebookOpen(true)}>
              <RotateCcw className="size-3.5" /> Ombook
            </Button>
            <CancelStep iv={iv} />
            <KommerIkkeStep iv={iv} />
            <label className="ml-auto flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={iv.reminderEnabled} disabled={setReminder.isPending}
                onCheckedChange={(v) => setReminder.mutate({ id: iv.id, reminderEnabled: v })} aria-label="Påminnelse dagen før" />
              Påminnelse dagen før{iv.reminderSentAt ? " (sendt)" : ""}
            </label>
          </div>
        )}

        <MessageList iv={iv} />
      </CardContent>

      <RebookDialog iv={iv} open={rebookOpen} onOpenChange={setRebookOpen} />
    </Card>
  );
}

export function RebookDialog({ iv, open, onOpenChange }: { iv: Interview; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        {open && <RebookBody iv={iv} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function RebookBody({ iv, onDone }: { iv: Interview; onDone: () => void }) {
  const rebook = useRebookInterview();
  // Any recruiter may hand the interview to any sales leader (client 2026-11-06); a sales
  // leader booking for himself (booking.own) keeps it on his own calendar.
  const canMove = useHasPermission("booking.write");
  const leaders = useLeaders();
  // C5 (client 10.11): narrow the leader list to an office's city, as in the booking form.
  const offices = useOffices();
  const [office, setOffice] = React.useState("alle");
  const city = (offices.data ?? []).find((o) => o.key === office)?.city ?? null;
  const pool = (leaders.data ?? []).filter((l) => city === null || l.cities.includes(city));
  const [leaderId, setLeaderId] = React.useState(iv.leader.id);
  const leader = leaders.data?.find((l) => l.id === leaderId) ?? (leaderId === iv.leader.id ? iv.leader : null);
  const changed = leaderId !== iv.leader.id;
  const [picked, setPicked] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const label = !picked ? (changed ? "Velg tid hos ny leder" : "Velg en ny tid")
    : changed ? `Gi til ${leader?.name ?? "ny leder"} · ${fullFmt.format(new Date(picked))}`
    : `Flytt til ${fullFmt.format(new Date(picked))}`;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Ombook intervjuet med {iv.candidateName}</DialogTitle>
        <DialogDescription>
          Nå: {fullFmt.format(new Date(iv.startsAt))} hos {iv.leader.name}.{" "}
          {changed
            ? "Intervjuet fjernes fra kalenderen til den gamle lederen og legges i den nyes. Begge ledere varsles; kandidaten får bare SMS hvis tiden endres."
            : "Kalenderhendelsen flyttes, og begge får ny SMS."}
        </DialogDescription>
      </DialogHeader>
      {canMove && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-40 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Kontor</span>
            <Select value={office} onValueChange={setOffice}>
              <SelectTrigger aria-label="Kontor" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle kontorer</SelectItem>
                {(offices.data ?? []).map((o) => <SelectItem key={o.key} value={o.key}>{o.city}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-64 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Leder</span>
            <LeaderPicker
              ariaLabel="Velg leder"
              value={leaderId}
              onChange={(v) => { setLeaderId(v); setPicked(null); setError(null); }}
              leaders={[
                ...(pool.some((l) => l.id === iv.leader.id) ? [] : [{ id: iv.leader.id, name: iv.leader.name, suffix: " (nå)" }]),
                ...pool.map((l) => ({ id: l.id, name: l.name, teams: l.teams, suffix: l.id === iv.leader.id ? " (nå)" : "" })),
              ]}
            />
            {city && pool.length === 0 && <span className="text-xs text-warning-on-tint">Ingen team i {city} ennå.</span>}
          </div>
          {changed && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setPicked(iv.startsAt)}>
              Behold samme tid ({fullFmt.format(new Date(iv.startsAt))})
            </Button>
          )}
        </div>
      )}
      <WeekSlotPicker key={leaderId} leaderId={leaderId} leaderName={leader?.name ?? ""} value={picked} onChange={setPicked} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>Avbryt</Button>
        <Button disabled={!picked || rebook.isPending} onClick={async () => {
          if (!picked) return;
          setError(null);
          try { await rebook.mutateAsync({ id: iv.id, startsAt: picked, leaderId: changed ? leaderId : undefined }); onDone(); }
          catch (e) { setError(errorMessage(e)); setPicked(null); }
        }}>
          {rebook.isPending ? "Flytter …" : label}
        </Button>
      </DialogFooter>
    </>
  );
}

/** BOOK-06 by staff: a confirmation step in the card (never confirm()), with the consequence spelled out. */
export function CancelStep({ iv }: { iv: Interview }) {
  const cancel = useCancelInterview();
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <ConfirmStep
        trigger="Avlys"
        consequence={`${iv.candidateName} får SMS om at intervjuet er avlyst, lederen varsles, og hendelsen fjernes fra kalenderen. Kandidaten settes tilbake til «Kvalifisert».`}
        confirmLabel="Avlys intervjuet"
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate({ id: iv.id }, { onError: (e) => setError(errorMessage(e)) })}
      />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** R6 «Kommer ikke» (client 09.11): the candidate has said they will not come. One confirmed
 *  click: the interview is cancelled as by the candidate and the candidate leaves the process. */
export function KommerIkkeStep({ iv, onDone, size = "default" }: {
  iv: Pick<Interview, "id" | "candidateName">; onDone?: () => void; size?: "sm" | "default";
}) {
  // A centred modal like the rest of the ERP's confirmations — never an inline panel, which
  // pushed the candidate page header apart (Hassan 10.11).
  const kommerIkke = useKommerIkke();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <>
      <Button size={size} variant="outline" className="border-danger/40 text-danger hover:bg-danger/10"
        onClick={() => { setError(null); setOpen(true); }}>
        Kommer ikke
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!kommerIkke.isPending) setOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kommer ikke?</DialogTitle>
            <DialogDescription>
              Bruk dette når {iv.candidateName} har gitt beskjed om å ikke komme. Intervjuet avlyses (lederen varsles,
              hendelsen fjernes fra kalenderen), kandidaten får bekreftelse på avbestillingen og settes til
              «Kommer ikke», ut av prosessen.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" disabled={kommerIkke.isPending} onClick={() => setOpen(false)}>Avbryt</Button>
            <Button variant="destructive" disabled={kommerIkke.isPending}
              onClick={() => kommerIkke.mutate({ id: iv.id }, {
                onSuccess: () => { setOpen(false); onDone?.(); },
                onError: (e) => setError(errorMessage(e)),
              })}>
              {kommerIkke.isPending ? "Lagrer …" : "Kandidaten kommer ikke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MessageList({ iv }: { iv: Interview }) {
  const failed = iv.messages.filter((m) => m.status === "failed").length;
  return (
    <details className="text-sm" open={failed > 0}>
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {iv.messages.length} melding{iv.messages.length === 1 ? "" : "er"}
        {failed > 0 && <span className="ml-1 text-danger">· {failed} ikke levert</span>}
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {iv.messages.length === 0 && <li className="text-xs text-muted-foreground">Ingen meldinger på denne bookingen.</li>}
        {iv.messages.map((m) => (
          <li key={m.id} className="rounded-lg border border-border p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {m.channel === "sms" ? <MessageSquare className="size-3" aria-hidden /> : <Mail className="size-3" aria-hidden />}
              <span>{m.channel === "sms" ? "SMS" : "E-post"} til {ROLE_LABEL[m.recipientRole]}</span>
              <span className="font-mono">{m.to}</span>
              <span>· {KIND_LABEL[m.kind] ?? m.kind}</span>
              <Badge variant="outline" className={`text-[10px] ${MSG_TONE[m.status]}`}>{MESSAGE_STATUS_LABEL[m.status]}</Badge>
              <Clock className="size-3" aria-hidden />
              <span className="tabular-nums">
                {m.sendAfter && m.status === "queued" ? `sendes ${shortFmt.format(new Date(m.sendAfter))}` : shortFmt.format(new Date(m.sentAt))}
              </span>
            </p>
            {m.subject && <p className="mt-2 text-[13px] font-medium">{m.subject}</p>}
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
            {m.error && <p className="mt-1 text-xs text-danger">{m.error}</p>}
          </li>
        ))}
      </ul>
    </details>
  );
}
