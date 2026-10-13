"use client";

import * as React from "react";
import { CalendarCheck, MessageSquare, Mail, Ban, Clock } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInterviews, useLeaders, useSlots, useBookInterview } from "@/lib/api/srs";
import { useCandidates } from "@/lib/api/recruitment";
import { errorMessage } from "@/lib/api/client";
import { INTERVIEW_STATUS_LABEL, type Interview, type InterviewStatus } from "@/types/interview";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * BOOK-01 … BOOK-05 — bookingskjermen.
 *
 * The SRS's stated goal is fewer no-shows, which makes the messages part of the
 * feature rather than plumbing: BOOK-03 says what the SMS must contain, and
 * BOOK-05 says the reminder carries a cancellation link. So every message is
 * rendered in full on the booking, not summarised as "SMS sendt". A demo that
 * only claims a message was sent cannot be reviewed.
 */

const STATUS_TONE: Record<InterviewStatus, string> = {
  booket: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]",
  gjennomfort: "bg-success/10 text-success",
  avlyst: "bg-muted text-muted-foreground line-through",
  "no-show": "bg-danger/10 text-danger",
  ombooket: "bg-warning/10 text-warning-on-tint",
};

const dayHeader = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Oslo" });
const timeFmt = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });
const fullFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" });

function IntervjuerPage() {
  const candidates = useCandidates();
  const leaders = useLeaders();
  const interviews = useInterviews();
  const book = useBookInterview();

  const [leader, setLeader] = React.useState("");
  const [candidateId, setCandidateId] = React.useState("");
  const [location, setLocation] = React.useState("AB Marketing, Karl Johans gate 12, Oslo");
  const [reminder, setReminder] = React.useState(true);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!leader && leaders.data?.length) setLeader(leaders.data[0]);
  }, [leaders.data, leader]);

  const slots = useSlots(leader);

  // Only candidates it makes sense to book: the ones who have been qualified but
  // have not yet been interviewed.
  const bookable = (candidates.data ?? []).filter((c) =>
    ["ny", "kontaktet", "kvalifisert", "intervju-booket"].includes(c.stageId),
  );

  // Group the slots by day so the calendar reads as a week, not a list of times.
  const byDay = React.useMemo(() => {
    const map = new Map<string, { startsAt: string; available: boolean; reason: string | null }[]>();
    for (const s of slots.data ?? []) {
      const key = s.startsAt.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [slots.data]);

  async function submit() {
    setError(null);
    if (!candidateId || !picked) {
      setError("Velg både kandidat og tidspunkt.");
      return;
    }
    try {
      await book.mutateAsync({ candidateId, leader, startsAt: picked, location, reminderEnabled: reminder });
      setPicked(null);
      setCandidateId("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const upcoming = (interviews.data ?? [])
    .filter((iv) => iv.status === "booket")
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const past = (interviews.data ?? [])
    .filter((iv) => iv.status !== "booket")
    .sort((a, b) => (a.startsAt > b.startsAt ? -1 : 1));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Intervjuer"
        description={`${upcoming.length} kommende intervjuer`}
        source="Kalender, SMS og e-post"
        lastUpdated={new Date()}
      />

      {/* ── Book ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-5 py-5">
          <h2 className="text-sm font-medium">Book nytt intervju</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="iv-cand">Kandidat</Label>
              <Select value={candidateId} onValueChange={setCandidateId}>
                <SelectTrigger id="iv-cand"><SelectValue placeholder="Velg kandidat" /></SelectTrigger>
                <SelectContent>
                  {bookable.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="iv-leader">Leder</Label>
              <Select value={leader} onValueChange={(v) => { setLeader(v); setPicked(null); }}>
                <SelectTrigger id="iv-leader"><SelectValue placeholder="Velg leder" /></SelectTrigger>
                <SelectContent>
                  {(leaders.data ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="iv-loc">Sted</Label>
              <Input id="iv-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          {/* BOOK-01 — the leader's free slots, with every unavailable one
              explained rather than simply missing. */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Ledige tider hos {leader || "lederen"}</p>
            {slots.isPending ? (
              <div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-40" />)}</div>
            ) : byDay.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Ingen ledige tider de neste to ukene.
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {byDay.map(([day, times]) => (
                  <div key={day} className="w-[9.5rem] shrink-0 rounded-lg border border-border">
                    <p className="border-b border-border px-2.5 py-2 text-xs capitalize text-muted-foreground">
                      {dayHeader.format(new Date(day))}
                    </p>
                    <ul className="flex flex-col gap-1 p-1.5">
                      {times.map((s) => {
                        const active = picked === s.startsAt;
                        return (
                          <li key={s.startsAt}>
                            <button
                              type="button"
                              disabled={!s.available}
                              title={s.reason ?? undefined}
                              onClick={() => setPicked(s.startsAt)}
                              aria-pressed={active}
                              className={`w-full rounded-md px-2 py-1.5 text-left text-[12.5px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                active
                                  ? "bg-[var(--ab-accent-9)] text-[var(--primary-foreground)]"
                                  : s.available
                                    ? "hover:bg-secondary"
                                    : "cursor-not-allowed text-muted-foreground/60 line-through"
                              }`}
                            >
                              {timeFmt.format(new Date(s.startsAt))}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* BOOK-05 — the reminder can be switched off per booking, which is
                what "stenge av og på" in the requirement asks for. */}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={reminder} onCheckedChange={setReminder} id="iv-reminder" />
              <span>Send påminnelse dagen før, med avbestillingslenke</span>
            </label>
            <Button className="gap-1.5" disabled={book.isPending || !picked || !candidateId} onClick={submit}>
              <CalendarCheck className="size-4" />
              {book.isPending ? "Booker…" : picked ? `Book ${fullFmt.format(new Date(picked))}` : "Book intervju"}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </CardContent>
      </Card>

      {/* ── Lists ───────────────────────────────────────────────────────── */}
      <QueryBoundary
        query={interviews}
        skeleton={<Skeleton className="h-48 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen intervjuer ennå"
        emptyDescription="Book det første intervjuet over."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            <Section title="Kommende" items={upcoming} />
            <Section title="Tidligere" items={past} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Section({ title, items }: { title: string; items: Interview[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((iv) => <li key={iv.id}><InterviewCard interview={iv} /></li>)}
      </ul>
    </section>
  );
}

function InterviewCard({ interview: iv }: { interview: Interview }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{iv.candidateName}</span>
          <Badge className={STATUS_TONE[iv.status]}>{INTERVIEW_STATUS_LABEL[iv.status]}</Badge>
          <span className="text-sm tabular-nums text-muted-foreground">{fullFmt.format(new Date(iv.startsAt))}</span>
          <span className="text-sm text-muted-foreground">· {iv.leader}</span>
          {!iv.reminderEnabled && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Ban className="size-2.5" aria-hidden /> påminnelse av
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {iv.location} · booket av {iv.bookedBy}
          {iv.calendarEventId ? ` · kalenderhendelse ${iv.calendarEventId}` : " · ingen kalenderhendelse"}
        </p>

        {iv.attended !== null && (
          <p className="rounded-lg bg-muted/40 p-3 text-sm">
            <span className="font-medium">{iv.attended ? "Møtte" : "Møtte ikke"}.</span>
            {iv.assessment ? ` ${iv.assessment}` : ""}
          </p>
        )}

        {/* BOOK-03/04/05 — the actual text of every message, because what it
            says is the part that reduces no-shows. */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {iv.messages.length} melding{iv.messages.length === 1 ? "" : "er"} sendt
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {iv.messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-3">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {m.channel === "sms" ? <MessageSquare className="size-3" aria-hidden /> : <Mail className="size-3" aria-hidden />}
                  <span className="uppercase tracking-wide">{m.channel}</span>
                  <span>til {m.recipientRole}</span>
                  <span className="font-mono">{m.to}</span>
                  <Badge variant="outline" className="text-[10px]">{m.kind}</Badge>
                  <Clock className="size-3" aria-hidden />
                  <span className="tabular-nums">{fullFmt.format(new Date(m.sentAt))}</span>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Intervjuer() {
  return (
    <PermissionGate permission="interviews.view">
      <IntervjuerPage />
    </PermissionGate>
  );
}
