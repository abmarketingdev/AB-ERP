"use client";

import * as React from "react";
import { TrendingDown, Check, X, Repeat, AlertTriangle, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { useMascotOnDone } from "@/lib/use-mascot";
import { Mascot } from "@/components/patterns/mascot";
import { useShifts, useSwapRequests, useDecideSwap, useFollowUpAbsence, useForecast, useRecordAttendance } from "@/lib/api/staffing";
import { ApiError, errorMessage } from "@/lib/api/client";
import { SWAP_STATUS_LABEL, type Shift } from "@/types/schedule";
import { cellStyle, LEGEND, monthBounds, shiftMonth, TODAY } from "@/lib/shift-cell";
import { SlackPreview } from "@/components/patterns/slack-preview";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * BEM-01 … BEM-05 — lederkalenderen.
 *
 * "Blå for planlagt arbeidsdag, grønn for møtt og rød for ikke møtt." That is
 * three states and two different things: blue is a plan about the future, green
 * and red are facts about the past. The server refuses attendance on a future
 * day, and a past working day nobody registered stays blue — a cell that turned
 * green on its own would be claiming to know something it cannot.
 *
 * A leader registers attendance here, on a phone (IFK-08): tap the day, tap
 * «Møtt» or «Ikke møtt». A correction is a new entry with a reason, never an edit
 * — the history is shown in the dialog. A first working day stays locked to
 * «ikke møtt» until the contract is signed (ONB-03, A4 decides).
 *
 * Which teams appear is the server's decision (the leader's own teams).
 */

const pctFmt = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 0 });
const dayNum = new Intl.DateTimeFormat("nb-NO", { day: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("nb-NO", { weekday: "narrow", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });
const stamp = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (d: string) => new Date(`${d}T00:00:00Z`);

function OppmotePage() {
  const [anchor, setAnchor] = React.useState(TODAY);
  const [team, setTeam] = React.useState("alle");
  const { from, to } = monthBounds(anchor);
  const shifts = useShifts({ from, to, teamId: team === "alle" ? undefined : team });
  const swaps = useSwapRequests();
  const [target, setTarget] = React.useState("");
  const forecast = useForecast({ teamId: team === "alle" ? undefined : team, target: Number(target) || undefined });
  const decide = useDecideSwap();
  const [open, setOpen] = React.useState<Shift | null>(null);

  const rows = React.useMemo(() => shifts.data ?? [], [shifts.data]);
  const teams = React.useMemo(() => [...new Map(rows.map((s) => [s.teamId, s.team])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "nb")), [rows]);
  const dates = React.useMemo(() => [...new Set(rows.map((s) => s.date))].sort(), [rows]);
  const people = React.useMemo(() => {
    const map = new Map<string, { name: string; days: Shift[] }>();
    for (const s of rows) {
      const cur = map.get(s.employeeId) ?? { name: s.employeeName, days: [] };
      cur.days.push(s);
      map.set(s.employeeId, cur);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, "nb"));
  }, [rows]);

  const toDecide = (swaps.data ?? []).filter((s) => s.status === "venter_leder");
  const withColleague = (swaps.data ?? []).filter((s) => s.status === "venter_kollega");
  const missed = rows.filter((s) => s.attendance === "ikke-mott");
  const unaddressed = missed.filter((s) => !(s.followUps ?? []).length);
  const todayOpen = rows.filter((s) => s.date === TODAY && s.attendance === "planlagt");
  const todayDone = rows.filter((s) => s.date === TODAY && (s.attendance === "mott" || s.attendance === "ikke-mott"));
  const current = open ? rows.find((s) => s.id === open.id) ?? open : null;
  // Past working days nobody registered: still blue, but the leader should know they owe them.
  const unregistered = rows.filter((s) => s.kind === "arbeid" && s.date < TODAY && s.attendance === "planlagt");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Oppmøte"
        description={`${missed.length} fravær i ${monthFmt.format(day(from))} · ${unaddressed.length} ikke fulgt opp${unregistered.length ? ` · ${unregistered.length} tidligere dager uten registrering` : ""}`}
        source="Vaktplan og registrert oppmøte"
        lastUpdated={shifts.dataUpdatedAt ? new Date(shifts.dataUpdatedAt) : new Date()}
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Forrige måned" onClick={() => setAnchor(shiftMonth(anchor, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[8.5rem] text-center text-sm capitalize tabular-nums">{monthFmt.format(day(from))}</span>
            <Button size="icon" variant="outline" aria-label="Neste måned" onClick={() => setAnchor(shiftMonth(anchor, 1))}>
              <ChevronRight className="size-4" />
            </Button>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger size="sm" className="w-[11rem]" aria-label="Team"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle mine team</SelectItem>
                {teams.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* The leader's main daily action, first and one tap per person (IFK-08). */}
      {anchor.slice(0, 7) === TODAY.slice(0, 7) && todayOpen.length > 0 && <TodayCard days={todayOpen} />}

      <TodayDone done={todayDone.length > 0 && todayOpen.length === 0} count={todayDone.length} />

      {/* BEM-07 — the leader decides only after the colleague has accepted. */}
      {(toDecide.length > 0 || withColleague.length > 0) && (
        <Card className={toDecide.length ? "border-warning/40" : undefined}>
          <CardContent className="flex flex-col gap-3 py-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Repeat className="size-4 text-muted-foreground" aria-hidden />
              {toDecide.length} vaktbytte venter på deg
              {withColleague.length > 0 && <span className="font-normal text-muted-foreground">· {withColleague.length} venter på kollega</span>}
            </h2>
            <ul className="flex flex-col divide-y divide-border">
              {[...toDecide, ...withColleague].map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="font-medium">{s.fromEmployee}</span>
                  <span className="text-muted-foreground tabular-nums">{fullDay.format(day(s.fromDate))}</span>
                  <Repeat className="size-3.5 text-muted-foreground" aria-label="bytter med" />
                  <span className="font-medium">{s.toEmployee}</span>
                  <span className="text-muted-foreground tabular-nums">{fullDay.format(day(s.toDate))}</span>
                  <span className="text-xs text-muted-foreground">«{s.reason}»</span>
                  {s.status === "venter_leder" ? (
                    <span className="ml-auto flex gap-2">
                      <Button size="sm" className="min-h-10 gap-1.5" disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: s.id, approve: true })}>
                        <Check className="size-3.5" /> Godkjenn
                      </Button>
                      <Button size="sm" variant="outline" className="min-h-10 gap-1.5 text-danger" disabled={decide.isPending}
                        onClick={() => decide.mutate({ id: s.id, approve: false })}>
                        <X className="size-3.5" /> Avvis
                      </Button>
                    </span>
                  ) : (
                    <Badge variant="outline" className="ml-auto">{SWAP_STATUS_LABEL[s.status]}</Badge>
                  )}
                </li>
              ))}
            </ul>
            {decide.isError && <p className="text-sm text-danger" role="alert">{errorMessage(decide.error)}</p>}
          </CardContent>
        </Card>
      )}

      {/* BEM-01 / BEM-02 — the grid (desktop) and per-person week strips (phone). */}
      <QueryBoundary
        query={shifts}
        skeleton={<Skeleton className="h-80 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen vakter denne måneden"
        emptyDescription="Når vaktplanen for teamet ditt er satt opp, vises oppmøtet her."
      >
        {() => (
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <Legend />
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-separate border-spacing-0.5 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left text-xs font-medium text-muted-foreground">Ansatt</th>
                      {dates.map((d) => (
                        <th key={d} className="px-0.5 py-1 text-center text-[10px] font-normal text-muted-foreground">
                          <span className="block capitalize">{weekday.format(day(d))}</span>
                          <span className="block tabular-nums">{dayNum.format(day(d))}</span>
                        </th>
                      ))}
                      <th className="px-2 py-1 text-right text-[10px] font-normal text-muted-foreground">Møtt / planlagt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map(([id, p]) => {
                      const byDate = new Map(p.days.map((s) => [s.date, s]));
                      const planned = p.days.filter((s) => s.kind === "arbeid" && s.date <= TODAY).length;
                      const came = p.days.filter((s) => s.attendance === "mott").length;
                      return (
                        <tr key={id}>
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 text-xs">{p.name}</td>
                          {dates.map((d) => (
                            <td key={d} className="p-0"><Cell s={byDate.get(d)} name={p.name} date={d} size="h-7 w-full min-w-6" onOpen={setOpen} /></td>
                          ))}
                          <td className="px-2 text-right text-xs tabular-nums text-muted-foreground">{came} / {planned}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="flex flex-col gap-3 md:hidden">
                {people.map(([id, p]) => {
                  const week = p.days.filter((s) => Math.abs(day(s.date).getTime() - day(TODAY).getTime()) <= 3 * 86_400_000);
                  return (
                    <li key={id} className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-sm font-medium">{p.name}</p>
                      <div className="flex gap-1.5 overflow-x-auto">
                        {week.map((s) => (
                          <div key={s.id} className="flex flex-col items-center gap-1">
                            <span className="text-[10px] capitalize text-muted-foreground">{weekday.format(day(s.date))} {dayNum.format(day(s.date))}</span>
                            <Cell s={s} name={p.name} date={s.date} size="size-10 text-xs" onOpen={setOpen} />
                          </div>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                Trykk på en dag for å registrere oppmøte. På en rød dag kan du følge opp fraværet. Grønn ramme = fulgt opp.
              </p>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      {/* BEM-03 / BEM-04 — the forecast, with its range and how much history it rests on. */}
      <QueryBoundary query={forecast} skeleton={<Skeleton className="h-32 w-full rounded-lg" />} isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen prognose ennå" emptyDescription="Prognosen bygger på registrert oppmøte. Registrer noen uker, så kommer den.">
        {(list) => (
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-medium">
                    <TrendingDown className="size-4 text-muted-foreground" aria-hidden />
                    Reelt behov for dagsverk, neste fire uker
                  </h2>
                  <p className="mt-1 max-w-prose text-xs text-muted-foreground">{list[0]?.explanation}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="fc-target" className="text-xs">Mål: dagsverk vi trenger</Label>
                  <Input id="fc-target" type="number" inputMode="numeric" className="h-9 w-28" value={target}
                    onChange={(e) => setTarget(e.target.value)} placeholder="f.eks. 120" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-medium">Team</th>
                      <th className="pb-2 text-right font-medium">Planlagt</th>
                      <th className="pb-2 text-right font-medium">Forventet levert</th>
                      <th className="pb-2 text-right font-medium">Oppmøtegrad</th>
                      {target && <th className="pb-2 text-right font-medium">Må planlegges</th>}
                      <th className="pb-2 pl-6 font-medium">Grunnlag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {list.map((f) => (
                      <tr key={f.teamId}>
                        <td className="py-2">{f.team}</td>
                        <td className="py-2 text-right tabular-nums">{f.plannedDays}</td>
                        <td className="py-2 text-right tabular-nums">
                          {f.basisDays === 0 ? <span className="text-muted-foreground">—</span> : (
                            <>
                              <span className={f.reliable ? "font-medium" : "text-muted-foreground"}>
                                {f.reliable ? "" : "≈ "}{f.expectedDays.toLocaleString("nb-NO")}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">({f.expectedLow}–{f.expectedHigh})</span>
                            </>
                          )}
                        </td>
                        {/* With no registered history the rate is only the model's starting
                            guess (50 %) — never shown as if it were a fact. */}
                        <td className="py-2 text-right tabular-nums">
                          {f.basisDays === 0 ? <span className="text-muted-foreground">—</span>
                            : <span className={f.reliable ? "" : "text-muted-foreground"}>{f.reliable ? "" : "≈ "}{pctFmt.format(f.showRate)}</span>}
                        </td>
                        {target && <td className="py-2 text-right tabular-nums">{f.basisDays === 0 ? "—" : f.neededForTarget ?? "—"}</td>}
                        <td className="py-2 pl-6 text-xs text-muted-foreground">
                          {f.basisDays === 0 ? "Ingen registrert oppmøte ennå — prognosen kommer når det finnes historikk."
                            : `${f.basisDays} registrerte dager, ${f.windowWeeks} uker`}
                          {!f.reliable && f.basisDays > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-warning-on-tint">
                              <AlertTriangle className="size-3" aria-hidden /> lite historikk — usikkert
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Tallet i parentes er et 80 %-intervall: med lite historikk blir det bredere.</p>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      <SlackPreview kind="absence" />

      {/* Keyed by the day, so each day opens with a clean form. */}
      {current && <DayDialog key={current.id} shift={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Pandi once when the last of today's registrations is made — not on every visit. */
function TodayDone({ done, count }: { done: boolean; count: number }) {
  const { key, ...mascot } = useMascotOnDone(done);
  if (!done) return null;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <Mascot key={key} {...mascot} size={56} label="Dagens oppmøte er registrert" />
        <p className="text-sm">Dagens oppmøte er registrert for alle {count}.</p>
      </CardContent>
    </Card>
  );
}

function TodayCard({ days }: { days: Shift[] }) {
  const record = useRecordAttendance();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  async function mark(s: Shift, status: "mott" | "ikke-mott") {
    setBusy(s.id);
    setError(null);
    try {
      await record.mutateAsync({ id: s.id, status });
    } catch (err) {
      setError(`${s.employeeName}: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card className="border-[oklch(0.62_0.12_255)]/50">
      <CardContent className="flex flex-col gap-3 py-4">
        <h2 className="text-sm font-medium">Registrer dagens oppmøte · {days.length} igjen</h2>
        <ul className="flex flex-col divide-y divide-border">
          {days.map((s) => {
            const locked = Boolean(s.clearance && !s.clearance.cleared);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2 text-sm">
                  {s.employeeName}
                  {s.source === "first_day" && <Badge variant="outline" className="text-[10px]">første dag</Badge>}
                  {locked && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" aria-hidden /> venter på signert kontrakt</span>}
                </span>
                <span className="flex gap-2">
                  <Button size="sm" className="min-h-11 min-w-24 gap-1.5" disabled={busy === s.id || locked}
                    onClick={() => mark(s, "mott")}><Check className="size-4" /> Møtt</Button>
                  <Button size="sm" variant="outline" className="min-h-11 min-w-24 gap-1.5 text-danger" disabled={busy === s.id}
                    onClick={() => mark(s, "ikke-mott")}><X className="size-4" /> Ikke møtt</Button>
                </span>
              </li>
            );
          })}
        </ul>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}

function Cell({ s, name, date, size, onOpen }: { s?: Shift; name: string; date: string; size: string; onOpen: (s: Shift) => void }) {
  const { cls, label, title } = cellStyle(s);
  const actionable = Boolean(s && s.kind === "arbeid" && s.date <= TODAY);
  const followed = Boolean(s?.followUps?.length);
  const locked = s?.clearance && !s.clearance.cleared;
  return (
    <button
      type="button"
      disabled={!actionable}
      onClick={() => s && onOpen(s)}
      aria-label={`${name}, ${fullDay.format(day(date))}: ${title}${followed ? ", fulgt opp" : ""}`}
      title={`${name} — ${fullDay.format(day(date))}: ${title}${followed ? " (fulgt opp)" : ""}`}
      className={`relative flex ${size} items-center justify-center rounded text-[10px] tabular-nums ${cls} ${date === TODAY ? "ring-1 ring-[var(--ab-accent-9)]" : ""} ${actionable ? "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "cursor-default"} ${followed ? "ring-1 ring-success/60" : ""}`}
    >
      {label}
      {locked && <Lock className="absolute -right-0.5 -top-0.5 size-2.5 text-muted-foreground" aria-hidden />}
    </button>
  );
}

/** One day: register, correct (with a reason), or follow up an absence. */
function DayDialog({ shift: s, onClose }: { shift: Shift | null; onClose: () => void }) {
  const record = useRecordAttendance();
  const followUp = useFollowUpAbsence();
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [reasons, setReasons] = React.useState<{ code: string; label: string }[]>([]);

  if (!s) return null;
  const current = s.attendance === "mott" || s.attendance === "ikke-mott" ? s.attendance : null;
  const locked = s.clearance && !s.clearance.cleared;

  async function mark(status: "mott" | "ikke-mott") {
    setError(null);
    try {
      await record.mutateAsync({ id: s!.id, status, reason: current ? reason.trim() : undefined });
      setReason("");
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { reasons?: { code: string; label: string }[] }) : null;
      setReasons(body?.reasons ?? []);
      setError(errorMessage(err));
    }
  }

  async function saveFollowUp() {
    setError(null);
    try {
      await followUp.mutateAsync({ id: s!.id, note: note.trim() });
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <ResponsiveSheet open onOpenChange={(o) => !o && onClose()} title={s.employeeName}
      description={`${fullDay.format(day(s.date))}${s.source === "first_day" ? " · første arbeidsdag" : ""}`}
      footer={<Button variant="ghost" onClick={onClose}>Lukk</Button>}>
        <div className="flex flex-col gap-4 py-2">
          {locked && (
            <p className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              Venter på signert kontrakt: kan registreres som ikke møtt, men ikke som møtt før kontrakten er signert.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className="min-h-12 gap-2" variant={current === "mott" ? "default" : "outline"} disabled={record.isPending || current === "mott"}
              onClick={() => mark("mott")}><Check className="size-4" /> Møtt</Button>
            <Button className="min-h-12 gap-2 text-danger" variant={current === "ikke-mott" ? "default" : "outline"}
              disabled={record.isPending || current === "ikke-mott"} onClick={() => mark("ikke-mott")}><X className="size-4" /> Ikke møtt</Button>
          </div>
          {current && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="att-reason">Årsak hvis du retter registreringen</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="att-reason" className="min-h-10"><SelectValue placeholder="Velg årsak" /></SelectTrigger>
                <SelectContent>
                  {(s.correctionReasons ?? []).map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Skriv det du vil si om fraværet i oppfølgingen under — det kan slettes ved personvernforespørsel.</p>
            </div>
          )}
          {(s.attendanceHistory ?? []).length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {(s.attendanceHistory ?? []).map((h, i) => (
                <li key={i}>{stamp.format(new Date(h.at))} · {h.by}: {h.status === "mott" ? "møtt" : "ikke møtt"}
                  {h.correction && <> — rettet{h.reason ? `: «${h.reason}»` : ""}</>}</li>
              ))}
            </ul>
          )}
          {current === "ikke-mott" && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {(s.followUps ?? []).map((f, i) => (
                <p key={i} className="rounded-lg bg-muted/40 p-2.5 text-sm">
                  <span className="text-muted-foreground">{f.by}, {stamp.format(new Date(f.at))}: </span>{f.note}
                </p>
              ))}
              <Label htmlFor="fu-note">Følg opp fraværet — hva ble gjort?</Label>
              <Textarea id="fu-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button className="min-h-10 w-fit" disabled={followUp.isPending || note.trim().length < 3} onClick={saveFollowUp}>
                Lagre oppfølging
              </Button>
            </div>
          )}
          {error && (
            <div className="text-sm text-danger" role="alert">
              {error}
              {reasons.length > 0 && <ul className="mt-1 list-disc pl-5">{reasons.map((r) => <li key={r.code}>{r.label}</li>)}</ul>}
            </div>
          )}
        </div>
    </ResponsiveSheet>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {LEGEND.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <span className={`flex size-4 items-center justify-center rounded text-[9px] ${i.cls}`} aria-hidden>{i.label}</span>
          {i.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Oppmote() {
  return (
    <PermissionGate permission="leader.view">
      <OppmotePage />
    </PermissionGate>
  );
}
