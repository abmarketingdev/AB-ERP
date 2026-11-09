"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/client";
import { useRecruitedBy, useSetBonusAmount, type RecruitedBy, type RecruitedByRow } from "@/lib/api/recruited-by";
import { TODAY } from "@/lib/shift-cell";

/**
 * R4a (client 09.11): «Den som har lagd leadet, får bonusen». One row per person who
 * registered leads (stand form or «Ny kandidat»), for one month: leads registered, sent
 * to approval, approved, started. Reassigning a candidate never moves the credit.
 *
 * «Opptjent bonus» only appears when an admin has set an amount per approved candidate;
 * 0 means off. Nothing is paid from here — the figure is for the people who decide payout.
 */

const num = new Intl.NumberFormat("nb-NO");
const kr = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const s = monthFmt.format(new Date(y, m - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function RecruitedByPage() {
  const current = TODAY.slice(0, 7);
  const [month, setMonth] = React.useState(current);
  const data = useRecruitedBy(month);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Rekruttert av"
        description="Hvem som har registrert leadene, og hvor langt kandidatene deres har kommet. Den som registrerte leadet beholder æren, også om kandidaten flyttes til en annen."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Forrige måned" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[9.5rem] text-center text-sm font-medium tabular-nums" aria-live="polite">{monthLabel(month)}</span>
            <Button variant="outline" size="icon" aria-label="Neste måned" disabled={month >= current}
              onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />
      <QueryBoundary query={data} skeleton={<Skeleton className="h-64 w-full rounded-lg" />}>
        {(d) => <Content d={d} />}
      </QueryBoundary>
    </div>
  );
}

const COLUMNS: { key: keyof Pick<RecruitedByRow, "leads" | "sent" | "approved" | "started">; label: string; hint: string }[] = [
  { key: "leads", label: "Leads registrert", hint: "Leads personen registrerte i måneden" },
  { key: "sent", label: "Sendt til godkjenning", hint: "Kandidatene deres sendt til godkjenning i måneden" },
  { key: "approved", label: "Godkjent", hint: "Godkjent av Ole i måneden" },
  { key: "started", label: "Startet", hint: "Ble ansatt i måneden" },
];

function Content({ d }: { d: RecruitedBy }) {
  const showBonus = d.amountPerApproved > 0;
  return (
    <>
      {/* Keyed on the stored amount, so a saved value resets the field without an effect. */}
      {d.canSetAmount && <BonusSetting key={d.amountPerApproved} d={d} />}

      {d.rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {d.scope === "own" ? "Du har ikke registrert noen leads i denne måneden." : "Ingen leads registrert av noen i denne måneden."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Phone: one card per person. */}
          <ul className="flex flex-col gap-2 sm:hidden">
            {d.rows.map((r) => (
              <li key={r.userId}>
                <Card>
                  <CardContent className="flex flex-col gap-2 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{r.name}</p>
                      {showBonus && <p className="shrink-0 text-sm font-medium tabular-nums">{kr.format(r.bonus ?? 0)}</p>}
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-center">
                      {COLUMNS.map((c) => (
                        <div key={c.key} className="rounded-md bg-muted/50 px-1 py-1.5">
                          <dd className="text-base font-medium tabular-nums">{num.format(r[c.key])}</dd>
                          <dt className="text-[11px] leading-tight text-muted-foreground">{c.label}</dt>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="max-sm:hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rekruttert av</TableHead>
                    {COLUMNS.map((c) => <TableHead key={c.key} className="text-right" title={c.hint}>{c.label}</TableHead>)}
                    {showBonus && <TableHead className="text-right">Opptjent bonus</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.rows.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      {COLUMNS.map((c) => <TableCell key={c.key} className="text-right tabular-nums">{num.format(r[c.key])}</TableCell>)}
                      {showBonus && <TableCell className="text-right font-medium tabular-nums">{kr.format(r.bonus ?? 0)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                {d.scope === "all" && d.rows.length > 1 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell>Totalt</TableCell>
                      {COLUMNS.map((c) => <TableCell key={c.key} className="text-right tabular-nums">{num.format(d.totals[c.key])}</TableCell>)}
                      {showBonus && <TableCell className="text-right tabular-nums">{kr.format(d.totals.bonus ?? 0)}</TableCell>}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Tallene gjelder hendelser i {monthLabel(d.month).toLowerCase()}: et lead telles måneden det ble registrert, en kandidat måneden den ble sendt, godkjent eller startet.
        {showBonus
          ? ` Opptjent bonus = godkjente × ${kr.format(d.amountPerApproved)}. Ingenting utbetales herfra.`
          : " Bonus vises når en administrator har satt et beløp per godkjent kandidat."}
      </p>
    </>
  );
}

function BonusSetting({ d }: { d: RecruitedBy }) {
  const save = useSetBonusAmount();
  const [value, setValue] = React.useState(String(d.amountPerApproved));
  const [saved, setSaved] = React.useState(false);
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            setSaved(false);
            save.mutate({ month: d.month, amount: parsed }, { onSuccess: () => setSaved(true) });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bonus-amount">Bonus per godkjent kandidat (kr)</Label>
            <Input id="bonus-amount" inputMode="numeric" className="w-40 tabular-nums" value={value}
              aria-invalid={!valid} onChange={(e) => { setValue(e.target.value.replace(/\s/g, "")); setSaved(false); }} />
          </div>
          <Button type="submit" disabled={!valid || save.isPending || parsed === d.amountPerApproved}>
            {save.isPending ? "Lagrer…" : "Lagre"}
          </Button>
          <p className="basis-full text-xs text-muted-foreground">0 = av. Gjelder alle måneder; bare administratorer kan endre beløpet.</p>
        </form>
        {!valid && <p className="text-sm text-danger">Skriv et helt beløp mellom 0 og 100 000 kr.</p>}
        {saved && <p className="text-sm text-success" role="status">Lagret.</p>}
        {save.isError && <p className="text-sm text-danger" role="alert">{errorMessage(save.error)}</p>}
      </CardContent>
    </Card>
  );
}

export default function Page() {
  return (
    <PermissionGate permission="recruitdash.view">
      <RecruitedByPage />
    </PermissionGate>
  );
}
