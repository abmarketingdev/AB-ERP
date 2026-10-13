"use client";

import * as React from "react";
import { TrendingDown, Check, X, Repeat, AlertTriangle } from "lucide-react";
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
import { useShifts, useSwapRequests, useDecideSwap, useFollowUpAbsence, useForecast } from "@/lib/api/srs";
import { errorMessage } from "@/lib/api/client";
import { ATTENDANCE_LABEL, DAY_KIND_LABEL, type Shift } from "@/types/schedule";

/**
 * BEM-01 … BEM-04 — lederkalenderen.
 *
 * "Blå for planlagt arbeidsdag, grønn for møtt og rød for ikke møtt." That is
 * three states and two different things: blue is a plan about the future, green
 * and red are facts about the past. The grid therefore never colours a future
 * day green or red, and never leaves a past working day blue — a cell that did
 * would be claiming to know something it cannot.
 *
 * Colour is not the only signal anywhere: every cell carries a letter and a
 * title, so the grid is readable in greyscale and by a screen reader.
 */

const pctFmt = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 0 });
const dayNum = new Intl.DateTimeFormat("nb-NO", { day: "numeric" });
const weekday = new Intl.DateTimeFormat("nb-NO", { weekday: "narrow" });
const fullDay = new Intl.DateTimeFormat("nb-NO", { weekday: "long", day: "numeric", month: "long" });
const DEMO_TODAY = "2026-08-20";

function cellStyle(s: Shift | undefined) {
  if (!s) return { cls: "bg-transparent", label: "", title: "Ingen vakt" };
  if (s.kind === "ferie") return { cls: "bg-success/15 text-success", label: "F", title: "Ferie" };
  if (s.kind === "syk") return { cls: "bg-warning/15 text-warning-on-tint", label: "S", title: "Sykedag" };
  if (s.kind === "fri") return { cls: "bg-muted/40 text-muted-foreground", label: "·", title: "Fri" };
  if (s.attendance === "mott") return { cls: "bg-success/25 text-success", label: "M", title: "Møtt" };
  if (s.attendance === "ikke-mott") return { cls: "bg-danger/25 text-danger", label: "I", title: "Ikke møtt" };
  return { cls: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]", label: "P", title: "Planlagt arbeidsdag" };
}

export default function Oppmote() {
  const [team, setTeam] = React.useState("alle");
  const shifts = useShifts(team === "alle" ? {} : { team });
  const swaps = useSwapRequests();
  const forecast = useForecast();
  const decide = useDecideSwap();
  const followUp = useFollowUpAbsence();

  const [absence, setAbsence] = React.useState<Shift | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const rows = shifts.data ?? [];
  const teams = React.useMemo(() => [...new Set(rows.map((s) => s.team))].sort(), [rows]);
  const dates = React.useMemo(() => [...new Set(rows.map((s) => s.date))].sort(), [rows]);
  const people = React.useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of rows) {
      const arr = map.get(s.employeeName) ?? [];
      arr.push(s);
      map.set(s.employeeName, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "nb"));
  }, [rows]);

  const pendingSwaps = (swaps.data ?? []).filter((s) => s.status === "venter");
  const missed = rows.filter((s) => s.attendance === "ikke-mott");
  const unaddressed = missed.filter((s) => !s.followUp);

  async function saveFollowUp() {
    setError(null);
    if (!absence || !note.trim()) { setError("Skriv hva som ble gjort."); return; }
    try {
      await followUp.mutateAsync({ id: absence.id, note: note.trim() });
      setAbsence(null);
      setNote("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Oppmøte"
        description={`${missed.length} fravær siste fire uker · ${unaddressed.length} ikke fulgt opp`}
        source="Vaktplan og registrert oppmøte"
        lastUpdated={new Date()}
        actions={
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger size="sm" className="w-[11rem]" aria-label="Team"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle team</SelectItem>
              {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {/* BEM-07 — swaps wait for a decision here. */}
      {pendingSwaps.length > 0 && (
        <Card className="border-warning/40">
          <CardContent className="flex flex-col gap-3 py-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Repeat className="size-4 text-muted-foreground" aria-hidden />
              {pendingSwaps.length} vaktbytte venter på deg
            </h2>
            <ul className="flex flex-col divide-y divide-border">
              {pendingSwaps.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="font-medium">{s.fromEmployee}</span>
                  <span className="text-muted-foreground tabular-nums">{fullDay.format(new Date(s.fromDate))}</span>
                  <Repeat className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{s.toEmployee}</span>
                  <span className="text-muted-foreground tabular-nums">{fullDay.format(new Date(s.toDate))}</span>
                  <span className="text-xs text-muted-foreground">«{s.reason}»</span>
                  <span className="ml-auto flex gap-2">
                    <Button size="sm" className="gap-1.5" disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: s.id, approve: true })}>
                      <Check className="size-3.5" /> Godkjenn
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-danger" disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: s.id, approve: false })}>
                      <X className="size-3.5" /> Avvis
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* BEM-03 / BEM-04 — the forecast, with both numbers it is made of. */}
      <QueryBoundary query={forecast} skeleton={<Skeleton className="h-32 w-full rounded-lg" />} isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen prognose ennå" emptyDescription="Prognosen bygger på registrert oppmøte.">
        {(list) => (
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="size-4 text-muted-foreground" aria-hidden />
                Reelt behov for dagsverk
              </h2>
              <p className="text-xs text-muted-foreground">
                Regnet fra historisk oppmøte, uavhengig av tilgjengeligheten de ansatte selv oppgir.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-medium">Team</th>
                      <th className="pb-2 text-right font-medium">Planlagte dagsverk</th>
                      <th className="pb-2 text-right font-medium">Forventet levert</th>
                      <th className="pb-2 pr-6 text-right font-medium">Oppmøtegrad</th>
                      <th className="pb-2 font-medium">Grunnlag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {list.map((f) => (
                      <tr key={f.team}>
                        <td className="py-2">{f.team}</td>
                        <td className="py-2 text-right tabular-nums">{f.plannedDays}</td>
                        <td className="py-2 text-right font-medium tabular-nums">{f.expectedDays}</td>
                        <td className="py-2 pr-6 text-right tabular-nums">{pctFmt.format(f.showRate)}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {f.basisDays} registrerte dager
                          {!f.reliable && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-warning-on-tint">
                              <AlertTriangle className="size-3" aria-hidden /> for lite til å stole på
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      {/* BEM-01 / BEM-02 — the grid, and follow-up straight from a cell. */}
      <QueryBoundary
        query={shifts}
        skeleton={<Skeleton className="h-80 w-full rounded-lg" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen vakter i perioden"
        emptyDescription="Sett opp vaktplanen for å se oppmøtet her."
      >
        {() => (
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <Legend />
              <div className="overflow-x-auto">
                <table className="border-separate border-spacing-0.5 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left text-xs font-medium text-muted-foreground">Ansatt</th>
                      {dates.map((d) => (
                        <th key={d} className="px-0.5 py-1 text-center text-[10px] font-normal text-muted-foreground">
                          <span className="block capitalize">{weekday.format(new Date(d))}</span>
                          <span className="block tabular-nums">{dayNum.format(new Date(d))}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map(([name, own]) => {
                      const byDate = new Map(own.map((s) => [s.date, s]));
                      return (
                        <tr key={name}>
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1 text-xs">{name}</td>
                          {dates.map((d) => {
                            const s = byDate.get(d);
                            const { cls, label, title } = cellStyle(s);
                            const clickable = s?.attendance === "ikke-mott";
                            const isToday = d === DEMO_TODAY;
                            return (
                              <td key={d} className="p-0">
                                <button
                                  type="button"
                                  disabled={!clickable}
                                  onClick={() => { if (s) { setAbsence(s); setNote(s.followUp?.note ?? ""); setError(null); } }}
                                  title={`${name} — ${fullDay.format(new Date(d))}: ${title}${s?.followUp ? " (fulgt opp)" : ""}`}
                                  className={`flex size-6 items-center justify-center rounded text-[10px] tabular-nums ${cls} ${isToday ? "ring-1 ring-[var(--ab-accent-9)]" : ""} ${clickable ? "cursor-pointer hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "cursor-default"} ${s?.followUp ? "ring-1 ring-success/50" : ""}`}
                                >
                                  {label}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Klikk på en rød dag for å følge opp fraværet. Grønn ramme betyr at det er fulgt opp.
              </p>
            </CardContent>
          </Card>
        )}
      </QueryBoundary>

      <Dialog open={Boolean(absence)} onOpenChange={(o) => !o && setAbsence(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Følg opp fravær</DialogTitle>
            <DialogDescription>
              {absence && `${absence.employeeName} møtte ikke ${fullDay.format(new Date(absence.date))}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {absence?.followUp && (
              <p className="rounded-lg bg-muted/40 p-3 text-sm">
                Allerede fulgt opp av {absence.followUp.by}: {absence.followUp.note}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fu-note">Hva ble gjort?</Label>
              <Textarea id="fu-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbsence(null)}>Avbryt</Button>
            <Button disabled={followUp.isPending} onClick={saveFollowUp}>Lagre oppfølging</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Legend() {
  const items = [
    { cls: "bg-[var(--ab-accent-3)] text-[var(--ab-accent-12)]", label: "P", text: ATTENDANCE_LABEL.planlagt },
    { cls: "bg-success/25 text-success", label: "M", text: ATTENDANCE_LABEL.mott },
    { cls: "bg-danger/25 text-danger", label: "I", text: ATTENDANCE_LABEL["ikke-mott"] },
    { cls: "bg-success/15 text-success", label: "F", text: DAY_KIND_LABEL.ferie },
    { cls: "bg-warning/15 text-warning-on-tint", label: "S", text: DAY_KIND_LABEL.syk },
    { cls: "bg-muted/40 text-muted-foreground", label: "·", text: DAY_KIND_LABEL.fri },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={`flex size-4 items-center justify-center rounded text-[9px] ${i.cls}`} aria-hidden>{i.label}</span>
          {i.text}
        </li>
      ))}
    </ul>
  );
}
