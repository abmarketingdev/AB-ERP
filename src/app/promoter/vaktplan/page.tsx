"use client";

import * as React from "react";
import { Repeat, Check, X, Clock } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useShifts, useSwapRequests, useRequestSwap } from "@/lib/api/srs";
import { useSession } from "@/lib/permissions";
import { errorMessage } from "@/lib/api/client";
import { DAY_KIND_LABEL, type Shift, type DayKind } from "@/types/schedule";

/**
 * BEM-06 / BEM-07 — den ansattes egen vaktplan for hele måneden, og vaktbytte.
 *
 * Colour never carries the meaning alone: every day shows its own label as
 * well, because the design system forbids colour as the sole signal and because
 * four kinds of day cannot be told apart by hue on a phone in daylight.
 *
 * A swap is a request. The cell says "bytte foreslått" until a leader decides,
 * which is BEM-07's whole point — showing it as already swapped would be a lie
 * the employee plans around.
 */

const KIND_TONE: Record<DayKind, string> = {
  arbeid: "border-[var(--ab-accent-9)]/35 bg-[var(--ab-accent-3)]/40",
  ferie: "border-success/35 bg-success/10",
  syk: "border-warning/35 bg-warning/10",
  fri: "border-border bg-muted/30",
};

const weekdayFmt = new Intl.DateTimeFormat("nb-NO", { weekday: "short" });
const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long" });
const DEMO_TODAY = "2026-08-20";

export default function Vaktplan() {
  const session = useSession();
  const name = session?.name ?? "Kari Nordmann";
  const shifts = useShifts({ employee: name });
  const swaps = useSwapRequests();
  const request = useRequestSwap();

  const [swapFrom, setSwapFrom] = React.useState<Shift | null>(null);
  const [swapTo, setSwapTo] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const mine = (shifts.data ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const myNames = new Set(mine.map((s) => s.employeeName));
  const mySwaps = (swaps.data ?? []).filter((s) => myNames.has(s.fromEmployee) || myNames.has(s.toEmployee));

  // Everyone else's future working days, as swap targets.
  const allShifts = useShifts({});
  const targets = (allShifts.data ?? []).filter(
    (s) => s.employeeName !== name && s.kind === "arbeid" && s.date > DEMO_TODAY,
  );

  const workDays = mine.filter((s) => s.kind === "arbeid").length;
  const vacation = mine.filter((s) => s.kind === "ferie").length;
  const sick = mine.filter((s) => s.kind === "syk").length;

  async function submitSwap() {
    setError(null);
    if (!swapFrom || !swapTo || !reason.trim()) {
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

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Min vaktplan"
        description={`${workDays} arbeidsdager · ${vacation} feriedager · ${sick} sykedager`}
        period={monthFmt.format(new Date(DEMO_TODAY))}
        lastUpdated={new Date()}
      />

      <Legend />

      <QueryBoundary
        query={shifts}
        skeleton={<Skeleton className="h-96 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen vakter satt opp"
        emptyDescription="Når lederen din setter opp vaktplanen, ser du den her."
        className="flex flex-col gap-6"
      >
        {() => (
          <>
            <ul className="flex flex-col gap-2">
              {mine.map((s) => {
                const past = s.date < DEMO_TODAY;
                const today = s.date === DEMO_TODAY;
                return (
                  <li key={s.id}>
                    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-3 ${KIND_TONE[s.kind]} ${past ? "opacity-70" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-sm capitalize tabular-nums">
                          {weekdayFmt.format(new Date(s.date))} {dayFmt.format(new Date(s.date))}
                        </span>
                        <Badge variant="outline">{DAY_KIND_LABEL[s.kind]}</Badge>
                        {today && <Badge className="bg-[var(--ab-accent-9)] text-[var(--primary-foreground)]">I dag</Badge>}
                        {s.swapPending && (
                          <Badge className="gap-1 bg-warning/10 text-warning-on-tint">
                            <Clock className="size-3" aria-hidden /> Bytte foreslått
                          </Badge>
                        )}
                        {s.attendance === "mott" && <Badge className="bg-success/10 text-success">Møtt</Badge>}
                        {s.attendance === "ikke-mott" && <Badge className="bg-danger/10 text-danger">Ikke møtt</Badge>}
                      </div>
                      {s.kind === "arbeid" && !past && !s.swapPending && (
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => { setSwapFrom(s); setError(null); }}>
                          <Repeat className="size-3.5" /> Be om bytte
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {mySwaps.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">Mine bytteforespørsler</h2>
                <Card>
                  <CardContent className="flex flex-col divide-y divide-border p-0">
                    {mySwaps.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                        <span className="tabular-nums">{dayFmt.format(new Date(s.fromDate))}</span>
                        <Repeat className="size-3.5 text-muted-foreground" aria-hidden />
                        <span className="tabular-nums">{dayFmt.format(new Date(s.toDate))}</span>
                        <span className="text-muted-foreground">med {s.toEmployee}</span>
                        <Badge className={
                          s.status === "godkjent" ? "bg-success/10 text-success"
                            : s.status === "avvist" ? "bg-danger/10 text-danger"
                              : "bg-warning/10 text-warning-on-tint"
                        }>
                          {s.status === "venter" ? "Venter på leder" : s.status === "godkjent" ? "Godkjent" : "Avvist"}
                        </Badge>
                        <span className="ml-auto text-xs text-muted-foreground">{s.reason}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}
      </QueryBoundary>

      {/* BEM-07 — the request, and the fact that it needs approval, stated. */}
      <Dialog open={Boolean(swapFrom)} onOpenChange={(o) => !o && setSwapFrom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Be om vaktbytte</DialogTitle>
            <DialogDescription>
              Byttet gjelder først når lederen din har godkjent det. Begge vaktene står som før
              til da.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm">
              Din vakt: <span className="font-medium">{swapFrom && dayFmt.format(new Date(swapFrom.date))}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="swap-to">Bytt med</Label>
              <Select value={swapTo} onValueChange={setSwapTo}>
                <SelectTrigger id="swap-to"><SelectValue placeholder="Velg en kollegas vakt" /></SelectTrigger>
                <SelectContent>
                  {targets.slice(0, 40).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.employeeName} — {dayFmt.format(new Date(t.date))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="swap-reason">Begrunnelse</Label>
              <Textarea id="swap-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSwapFrom(null)}>Avbryt</Button>
            <Button disabled={request.isPending} onClick={submitSwap}>Send forespørsel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(Object.keys(DAY_KIND_LABEL) as DayKind[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`size-3 rounded border ${KIND_TONE[k]}`} aria-hidden />
          {DAY_KIND_LABEL[k]}
        </li>
      ))}
      <li className="flex items-center gap-1.5"><Check className="size-3 text-success" aria-hidden /> Møtt</li>
      <li className="flex items-center gap-1.5"><X className="size-3 text-danger" aria-hidden /> Ikke møtt</li>
    </ul>
  );
}
