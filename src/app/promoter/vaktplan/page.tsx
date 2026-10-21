"use client";

import * as React from "react";
import { Repeat, Check, X, Clock, ChevronLeft, ChevronRight, Thermometer } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveSheet } from "@/components/patterns/responsive-sheet";
import { useShifts, useSwapRequests, useRequestSwap, useRespondSwap, useWithdrawSwap, useSetDayKind } from "@/lib/api/staffing";
import { errorMessage } from "@/lib/api/client";
import { DAY_KIND_LABEL, SWAP_STATUS_LABEL, type Shift, type SwapRequest } from "@/types/schedule";
import { cellStyle, LEGEND, monthBounds, shiftMonth, TODAY } from "@/lib/shift-cell";
import { PermissionGate } from "@/components/patterns/permission-gate";

/**
 * BEM-06 / BEM-07 — den ansattes egen vaktplan for hele måneden, og vaktbytte.
 *
 * Mobile first (IFK-08): one row per day, large tap targets. Vacation, sickness
 * and swaps have their own codes (BEM-06), shared with the leader calendar.
 * Colour never carries the meaning alone: every day shows its label as well.
 *
 * A swap is a request (BEM-07). The colleague accepts first, then the leader
 * decides, and nothing changes on either day until the leader has approved it —
 * the row says «bytte venter» meanwhile. Showing it as already swapped would be
 * a lie the employee plans around.
 *
 * Whose schedule this is, is the server's decision (the token). Colleagues'
 * days come back only as name and date, for choosing a swap.
 */

const weekdayFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", timeZone: "UTC" });
const day = (d: string) => new Date(`${d}T00:00:00Z`);

function VaktplanPage() {
  const [anchor, setAnchor] = React.useState(TODAY);
  const { from, to } = monthBounds(anchor);
  const shifts = useShifts({ from, to });
  const pool = useShifts({ from: TODAY, to: monthBounds(shiftMonth(TODAY, 1)).to, swapTargets: true });
  const swaps = useSwapRequests();
  const request = useRequestSwap();
  const setKind = useSetDayKind();

  const [swapFrom, setSwapFrom] = React.useState<Shift | null>(null);
  const [swapTo, setSwapTo] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [sick, setSick] = React.useState<Shift | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const mine = (shifts.data ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const myIds = new Set(mine.map((s) => s.id));
  const me = mine[0]?.employeeId ?? (pool.data ?? []).find((s) => s.attendanceHistory !== undefined)?.employeeId;
  const targets = (pool.data ?? []).filter((s) => !myIds.has(s.id) && s.employeeId !== me);
  const mySwaps = swaps.data ?? [];
  const incoming = mySwaps.filter((s) => s.status === "venter_kollega" && s.toEmployeeId === me);
  const outgoing = mySwaps.filter((s) => s.fromEmployeeId === me || (s.toEmployeeId === me && s.status !== "venter_kollega"));

  const workDays = mine.filter((s) => s.kind === "arbeid").length;
  const vacation = mine.filter((s) => s.kind === "ferie").length;
  const sickDays = mine.filter((s) => s.kind === "syk").length;

  async function submitSwap() {
    setError(null);
    if (!swapFrom || !swapTo || reason.trim().length < 3) {
      setError("Velg en vakt å bytte med, og skriv en kort begrunnelse.");
      return;
    }
    try {
      await request.mutateAsync({ fromShiftId: swapFrom.id, toShiftId: swapTo, reason: reason.trim() });
      setSwapFrom(null);
      setSwapTo("");
      setReason("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function reportSick() {
    if (!sick) return;
    setError(null);
    try {
      await setKind.mutateAsync({ id: sick.id, kind: "syk" });
      setSick(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Min vaktplan"
        description={`${workDays} arbeidsdager · ${vacation} feriedager · ${sickDays} sykedager`}
        period={monthFmt.format(day(from))}
        lastUpdated={shifts.dataUpdatedAt ? new Date(shifts.dataUpdatedAt) : new Date()}
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" aria-label="Forrige måned" onClick={() => setAnchor(shiftMonth(anchor, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Neste måned" onClick={() => setAnchor(shiftMonth(anchor, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <Legend />

      {incoming.length > 0 && (
        <Card className="border-warning/40">
          <CardContent className="flex flex-col gap-3 py-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Repeat className="size-4 text-muted-foreground" aria-hidden /> En kollega vil bytte vakt med deg
            </h2>
            <ul className="flex flex-col gap-3">{incoming.map((s) => <li key={s.id}><IncomingSwap swap={s} /></li>)}</ul>
          </CardContent>
        </Card>
      )}

      <QueryBoundary
        query={shifts}
        skeleton={<Skeleton className="h-96 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen vakter denne måneden"
        emptyDescription="Når lederen din setter opp vaktplanen, ser du den her."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            <ul className="flex flex-col gap-2">
              {mine.map((s) => {
                const past = s.date < TODAY;
                const { cls, label, title } = cellStyle(s);
                return (
                  <li key={s.id}>
                    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 ${past ? "opacity-75" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded text-xs font-medium ${cls}`} aria-hidden>{label}</span>
                        <div className="flex flex-col">
                          <span className="text-sm capitalize tabular-nums">{weekdayFmt.format(day(s.date))} {dayFmt.format(day(s.date))}</span>
                          <span className="text-xs text-muted-foreground">{title}</span>
                        </div>
                        {s.date === TODAY && <Badge className="bg-[var(--ab-accent-9)] text-[var(--primary-foreground)]">I dag</Badge>}
                        {s.swapPending && (
                          <Badge className="gap-1 bg-warning/10 text-warning-on-tint"><Clock className="size-3" aria-hidden /> Bytte venter</Badge>
                        )}
                      </div>
                      {s.kind === "arbeid" && !past && (
                        <div className="flex gap-1">
                          {!s.swapPending && s.date > TODAY && (
                            <Button size="sm" variant="ghost" className="min-h-10 gap-1.5" onClick={() => { setSwapFrom(s); setError(null); }}>
                              <Repeat className="size-3.5" /> Be om bytte
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="min-h-10 gap-1.5" onClick={() => { setSick(s); setError(null); }}>
                            <Thermometer className="size-3.5" /> Meld syk
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {outgoing.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Mine bytteforespørsler</h2>
                <Card>
                  <CardContent className="flex flex-col divide-y divide-border p-0">
                    {outgoing.map((s) => <OutgoingSwap key={s.id} swap={s} />)}
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}
      </QueryBoundary>

      {/* BEM-07 — the request, and the fact that it needs approval, stated. */}
      <ResponsiveSheet open={Boolean(swapFrom)} onOpenChange={(o) => !o && setSwapFrom(null)} title="Be om vaktbytte"
        description="Kollegaen din må si ja først, og deretter må lederen godkjenne. Begge vaktene står som før til da."
        footer={<>
          <Button variant="ghost" onClick={() => setSwapFrom(null)}>Avbryt</Button>
          <Button disabled={request.isPending} onClick={submitSwap}>Send forespørsel</Button>
        </>}>
        <div className="flex flex-col gap-4 py-2">
          <p className="text-sm">Din vakt: <span className="font-medium">{swapFrom && dayFmt.format(day(swapFrom.date))}</span></p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="swap-to">Bytt med</Label>
            <Select value={swapTo} onValueChange={setSwapTo}>
              <SelectTrigger id="swap-to" className="min-h-11"><SelectValue placeholder="Velg en kollegas vakt" /></SelectTrigger>
              <SelectContent>
                {targets.filter((t) => t.date !== swapFrom?.date).slice(0, 60).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.employeeName} — {dayFmt.format(day(t.date))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targets.length === 0 && <p className="text-xs text-muted-foreground">Ingen kolleger på teamet ditt har arbeidsdager du kan bytte til — du jobber allerede de dagene, eller ingen er satt opp.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="swap-reason">Begrunnelse</Label>
            <Textarea id="swap-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet open={Boolean(sick)} onOpenChange={(o) => !o && setSick(null)} title="Meld deg syk"
        description={sick ? `${weekdayFmt.format(day(sick.date))} ${dayFmt.format(day(sick.date))} blir registrert som sykedag. Lederen din ser det i kalenderen.` : undefined}
        footer={<>
          <Button variant="ghost" onClick={() => setSick(null)}>Avbryt</Button>
          <Button disabled={setKind.isPending} onClick={reportSick}>Meld syk</Button>
        </>}>
        {error ? <p className="text-sm text-danger" role="alert">{error}</p> : <span />}
      </ResponsiveSheet>
    </div>
  );
}

function IncomingSwap({ swap: s }: { swap: SwapRequest }) {
  const respond = useRespondSwap();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span><span className="font-medium">{s.fromEmployee}</span> vil ta din vakt {dayFmt.format(day(s.toDate))} og gi deg {dayFmt.format(day(s.fromDate))}.</span>
      <span className="text-xs text-muted-foreground">«{s.reason}»</span>
      <span className="ml-auto flex gap-2">
        <Button size="sm" className="min-h-10 gap-1.5" disabled={respond.isPending} onClick={() => respond.mutate({ id: s.id, accept: true })}>
          <Check className="size-3.5" /> Ja, send til leder
        </Button>
        <Button size="sm" variant="outline" className="min-h-10 gap-1.5" disabled={respond.isPending} onClick={() => respond.mutate({ id: s.id, accept: false })}>
          <X className="size-3.5" /> Nei
        </Button>
      </span>
      {respond.isError && <p className="w-full text-sm text-danger" role="alert">{errorMessage(respond.error)}</p>}
    </div>
  );
}

function OutgoingSwap({ swap: s }: { swap: SwapRequest }) {
  const withdraw = useWithdrawSwap();
  const open = s.status === "venter_kollega" || s.status === "venter_leder";
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <span className="tabular-nums">{dayFmt.format(day(s.fromDate))}</span>
      <Repeat className="size-3.5 text-muted-foreground" aria-label="byttes med" />
      <span className="tabular-nums">{dayFmt.format(day(s.toDate))}</span>
      <span className="text-muted-foreground">med {s.toEmployee}</span>
      <Badge className={s.status === "godkjent" ? "bg-success/10 text-success"
        : open ? "bg-warning/10 text-warning-on-tint" : "bg-muted text-muted-foreground"}>
        {SWAP_STATUS_LABEL[s.status]}
      </Badge>
      {open && (
        <Button size="sm" variant="ghost" className="ml-auto min-h-10" disabled={withdraw.isPending}
          onClick={() => withdraw.mutate({ id: s.id })}>Trekk tilbake</Button>
      )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Fargekoder">
      {LEGEND.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <span className={`flex size-4 items-center justify-center rounded text-[9px] ${i.cls}`} aria-hidden>{i.label}</span>
          {i.text === "Planlagt" ? DAY_KIND_LABEL.arbeid : i.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * §2.2 — this module is grantable per user in /admin/tilganger, so the page
 * has to actually check it. Without this the toggle is decoration.
 */
export default function Vaktplan() {
  return (
    <PermissionGate permission="schedule.view">
      <VaktplanPage />
    </PermissionGate>
  );
}
