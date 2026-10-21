"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mascot } from "@/components/patterns/mascot";
import { WeekSlotPicker } from "./week-slot-picker";
import { useBookInterview, useLeaders } from "@/lib/api/interviews";
import { useCandidates } from "@/lib/api/recruitment";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Interview } from "@/types/interview";

/**
 * BOOK-01 … BOOK-05 in one form: candidate + leader → the leader's week → confirm.
 *
 * Used inline on /rekruttering/intervjuer and in BookInterviewDialog (opened from
 * the kanban when a card is dropped on «Intervju booket», agreed with A2). The
 * confirmation says, before the click, exactly who gets what — SMS to both,
 * e-mail with the calendar invitation, reminder the day before — because that is
 * the part of the feature that reduces no-shows.
 */

const OSLO = "Europe/Oslo";
const fullFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: OSLO, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const BOOKABLE = ["ny", "kontaktet", "kvalifisert"];

export function BookingForm({ candidateId: fixedCandidate, onBooked, compact }: {
  candidateId?: string; onBooked?: (iv: Interview) => void; compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const candidates = useCandidates();
  const leaders = useLeaders();
  const book = useBookInterview();

  const [selectedCandidate, setCandidateId] = React.useState("");
  const [selectedLeader, setLeaderId] = React.useState("");
  const candidateId = fixedCandidate ?? selectedCandidate;
  // The first leader until the recruiter picks one — derived, so it is right as soon as the list arrives.
  const leaderId = selectedLeader || leaders.data?.[0]?.id || "";
  const [location, setLocation] = React.useState("AB Marketing, Karl Johans gate 12, Oslo");
  const [reminder, setReminder] = React.useState(true);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [booked, setBooked] = React.useState<Interview | null>(null);

  const bookable = (candidates.data ?? []).filter((c) => BOOKABLE.includes(c.stageId) || c.id === fixedCandidate);
  const candidate = (candidates.data ?? []).find((c) => c.id === candidateId);
  const leader = leaders.data?.find((l) => l.id === leaderId);

  async function submit() {
    setError(null);
    if (!candidateId || !picked || !leaderId) {
      setError("Velg kandidat, leder og tidspunkt.");
      return;
    }
    try {
      const iv = await book.mutateAsync({ candidateId, leaderId, startsAt: picked, location, reminderEnabled: reminder });
      setBooked(iv);
      setPicked(null);
      onBooked?.(iv);
    } catch (err) {
      setError(errorMessage(err));
      // 409 slot_taken: someone booked it a moment ago — drop the pick so the refreshed week shows why.
      if (err instanceof ApiError && err.status === 409) setPicked(null);
    }
  }

  if (booked) {
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="flex flex-col items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4"
        role="status"
      >
        <div className="flex items-center gap-3">
          <Mascot state="win-small" size={56} label="Intervjuet er booket" />
          <div>
            <p className="font-medium">Intervjuet er booket</p>
            <p className="text-sm text-muted-foreground">
              {booked.candidateName} møter {booked.leader.name} {fullFmt.format(new Date(booked.startsAt))}, {booked.location}.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          SMS går til begge, e-post med kalenderinvitasjon til kandidaten{booked.reminderEnabled ? ", og påminnelse dagen før" : ""}.
          Status på hver melding vises på intervjuet.
        </p>
        {!fixedCandidate && (
          <Button size="sm" variant="outline" onClick={() => { setBooked(null); setCandidateId(""); }}>Book et nytt intervju</Button>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {!fixedCandidate && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iv-cand">Kandidat</Label>
            <Select value={candidateId} onValueChange={setCandidateId}>
              <SelectTrigger id="iv-cand"><SelectValue placeholder={candidates.isPending ? "Henter …" : "Velg kandidat"} /></SelectTrigger>
              <SelectContent>
                {bookable.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Ingen kandidater klare for intervju</div>}
                {bookable.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="iv-leader">Leder</Label>
          <Select value={leaderId} onValueChange={(v) => { setLeaderId(v); setPicked(null); }}>
            <SelectTrigger id="iv-leader"><SelectValue placeholder={leaders.isPending ? "Henter …" : "Velg leder"} /></SelectTrigger>
            <SelectContent>
              {(leaders.data ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}{l.teams.length ? ` · ${l.teams.join(", ")}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {leaders.isError && <p className="text-xs text-danger">Kunne ikke hente lederne. {errorMessage(leaders.error)}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="iv-loc">Sted</Label>
          <Input id="iv-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      {leaderId ? (
        <WeekSlotPicker leaderId={leaderId} leaderName={leader?.name} value={picked} onChange={setPicked} />
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Velg en leder for å se ledige tider.
        </p>
      )}

      <AnimatePresence initial={false}>
        {picked && (
          <motion.div
            key="confirm"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm">
                <span className="font-medium">{candidate?.name ?? "Kandidaten"}</span> møter{" "}
                <span className="font-medium">{leader?.name}</span>{" "}
                <span className="tabular-nums">{fullFmt.format(new Date(picked))}</span>, {location}.
              </p>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><MessageSquare className="size-3" aria-hidden /> SMS til kandidat og leder med tid, sted og kontaktinformasjon</li>
                <li className="flex items-center gap-1.5"><Mail className="size-3" aria-hidden /> E-post med kalenderinvitasjon og lenke for å flytte eller avbestille</li>
              </ul>
              {/* BOOK-05 — «stenge av og på»: the reminder, per booking. */}
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Switch checked={reminder} onCheckedChange={setReminder} id="iv-reminder" />
                <span>Påminnelse dagen før (SMS og e-post, med avbestillingslenke)</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-1.5" disabled={book.isPending} onClick={submit}>
                  <CalendarCheck className="size-4" />
                  {book.isPending ? "Booker …" : "Bekreft booking"}
                </Button>
                <Button variant="ghost" onClick={() => setPicked(null)}>Velg en annen tid</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
