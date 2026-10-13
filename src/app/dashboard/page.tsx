"use client";

import * as React from "react";
import { Download, AlertTriangle, Clock } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecruitmentDashboard } from "@/lib/api/srs";
import { LEAD_CAMPAIGNS } from "@/mocks/leads";
import { TEAMS_SRS } from "@/mocks/srs-seed";
import { ROBUST_SALES_THRESHOLD, type FunnelStep, type NoShowRow } from "@/types/recruitment-dashboard";

/**
 * DASH-01 … DASH-08 — rekrutteringsdashboardet som erstatter PDF-rapportene.
 *
 * Every chart here is a **single series**, which is a deliberate consequence of
 * the design system: `02-design-system.md` encodes series by lightness rather
 * than hue so the charts survive greyscale and colour-blindness. That ramp is a
 * sequential one, and sequential ramps only mean anything for one measure at a
 * time. Where two measures would have to be compared, this uses a table instead
 * of inventing a second scale — never two y-axes.
 *
 * Colour appears in one other place only: a no-show rate over the threshold is
 * marked, and it carries an icon and the word as well, never the colour alone.
 */

const NO_SHOW_ALARM = 0.2;
/**
 * Below this many observations, a percentage is noise wearing a number's
 * clothes: one no-show out of one booking is "100 %", and flagging that as a
 * problem sends somebody to have a conversation about nothing. The bar is still
 * drawn — hiding the row would hide a real event — but the rate is shown with
 * its denominator and the alarm is withheld.
 */
const MIN_BASIS = 5;

const pct = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("nb-NO");
const dec = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });

/** Sequential steps, darkest = largest. Lightness-encoded, per the design system. */
const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
function rampAt(i: number, n: number) {
  return RAMP[Math.min(RAMP.length - 1, Math.floor((i / Math.max(1, n - 1)) * (RAMP.length - 1)))];
}

export default function Dashboard() {
  const [campaign, setCampaign] = React.useState("alle");
  const [team, setTeam] = React.useState("alle");
  const [days, setDays] = React.useState("90");

  const dash = useRecruitmentDashboard({
    campaign: campaign === "alle" ? undefined : campaign,
    team: team === "alle" ? undefined : team,
    days: Number(days),
  });

  function exportCsv() {
    const d = dash.data;
    if (!d) return;
    const rows: string[][] = [
      ["Trakt"], ["Steg", "Nådd", "Frafall før", "Konvertering"],
      ...d.funnel.map((f) => [f.label, String(f.reached), String(f.droppedBefore), pct.format(f.conversion)]),
      [], ["Kanalkvalitet"], ["Kanal", "Leads", "Ansatt", "Fortsatt ansatt", `Robuste (${ROBUST_SALES_THRESHOLD}+ salg)`],
      ...d.channelQuality.map((c) => [c.channel, String(c.leads), String(c.hired), String(c.retained), String(c.robust)]),
      [], ["Promotørkvalitet"], ["Promotør", "Leads", "Kvalifiserte", "Ansatte", "Oppmøtedager", "Salg", "Effektivitet"],
      ...d.promoterQuality.map((p) => [p.promoter, String(p.leads), String(p.qualified), String(p.hired), String(p.attendanceDays), String(p.sales), p.efficiency === null ? "—" : dec.format(p.efficiency)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    // Semicolon-separated and BOM-prefixed, because this is opened in Norwegian
    // Excel, where a comma is a decimal separator and UTF-8 without a BOM
    // mangles æ, ø and å.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rekruttering.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Rekrutteringsdashboard"
        description={dash.data ? `${num.format(dash.data.basis.candidates)} kandidater og ${num.format(dash.data.basis.leads)} leads i grunnlaget` : undefined}
        period={dash.data?.basis.period}
        source="Statusloggen"
        lastUpdated={new Date()}
        actions={
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!dash.data}>
            <Download className="size-4" /> Eksporter
          </Button>
        }
      />

      {/* DASH-07 — filters in one row above the charts. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Filter id="d-period" label="Periode" value={days} onChange={setDays}
          options={[{ v: "30", l: "Siste 30 dager" }, { v: "90", l: "Siste 90 dager" }, { v: "365", l: "Siste år" }]} />
        <Filter id="d-camp" label="Kampanje" value={campaign} onChange={setCampaign}
          options={[{ v: "alle", l: "Alle kampanjer" }, ...LEAD_CAMPAIGNS.map((c) => ({ v: c, l: c }))]} />
        <Filter id="d-team" label="Team" value={team} onChange={setTeam}
          options={[{ v: "alle", l: "Alle team" }, ...TEAMS_SRS.map((t) => ({ v: t, l: t }))]} />
      </div>

      <QueryBoundary
        query={dash}
        skeleton={<div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}</div>}
        className="flex flex-col gap-6"
      >
        {(d) => (
          <>
            {/* DASH-06 — stat tiles, not a chart: two numbers with no shape. */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Tid fra lead til intervju" value={d.timing.leadToInterviewDays === null ? "—" : `${dec.format(d.timing.leadToInterviewDays)} dager`} />
              <Stat label="Tid fra lead til ansatt" value={d.timing.leadToHireDays === null ? "—" : `${dec.format(d.timing.leadToHireDays)} dager`} />
              <Stat
                label="Samlet konvertering"
                value={d.funnel.length ? pct1.format(d.funnel[d.funnel.length - 1].conversion) : "—"}
                hint="fra lead til ansatt"
              />
            </div>

            <Funnel steps={d.funnel} />

            <div className="grid gap-4 lg:grid-cols-2">
              <NoShowChart title="Ikke møtt per kanal" rows={d.noShowByChannel} />
              <NoShowChart title="Ikke møtt per salgssjef" rows={d.noShowByLeader} />
            </div>

            <ChannelTable rows={d.channelQuality} />
            <PromoterTable rows={d.promoterQuality} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function Filter({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** DASH-05 — trakt fra lead til ansatt, med frafall mellom hvert steg. */
function Funnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.reached));
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <h2 className="text-sm font-medium">Trakt fra lead til ansatt</h2>
        <ul className="flex flex-col gap-2">
          {steps.map((s, i) => {
            const w = (s.reached / max) * 100;
            return (
              <li key={s.stageId} className="group flex items-center gap-3">
                <span className="w-32 shrink-0 text-right text-[13px] text-muted-foreground">{s.label}</span>
                <span className="relative flex h-6 flex-1 items-center">
                  <span
                    className="h-6 rounded-r-[4px] transition-[filter] group-hover:brightness-110"
                    style={{ width: `${Math.max(w, 0.8)}%`, background: rampAt(i, steps.length) }}
                    title={`${s.label}: ${num.format(s.reached)} kandidater · ${pct.format(s.conversion)} av toppen${s.droppedBefore ? ` · ${num.format(s.droppedBefore)} falt fra før dette steget` : ""}`}
                  />
                  {/* Direct labels rather than a value on every axis tick. */}
                  <span className="ml-2 text-[13px] tabular-nums">{num.format(s.reached)}</span>
                  {s.droppedBefore > 0 && (
                    <span className="ml-2 text-[11px] tabular-nums text-muted-foreground">
                      −{num.format(s.droppedBefore)}
                    </span>
                  )}
                </span>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {pct.format(s.conversion)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Tallene er hvor mange som noen gang har nådd steget, regnet fra statusloggen — ikke hvor
          mange som står der nå.
        </p>
      </CardContent>
    </Card>
  );
}

/** DASH-02 — ikke møtt, både til intervju og første arbeidsdag. */
function NoShowChart({ title, rows }: { title: string; rows: NoShowRow[] }) {
  const withData = rows.filter((r) => r.rate !== null);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <h2 className="text-sm font-medium">{title}</h2>
        {withData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen bookinger i perioden.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {withData.map((r) => {
              const v = r.rate ?? 0;
              const basis = r.interviewsBooked + r.firstDayExpected;
              const thin = basis < MIN_BASIS;
              const alarm = v >= NO_SHOW_ALARM && !thin;
              return (
                <li key={r.key} className="group flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-right text-[13px] text-muted-foreground" title={r.key}>{r.key}</span>
                  <span className="relative flex h-5 flex-1 items-center">
                    <span
                      className="h-5 rounded-r-[4px]"
                      style={{ width: `${Math.max(v * 100, 1)}%`, background: alarm ? "var(--danger)" : thin ? "var(--chart-5)" : "var(--chart-3)" }}
                      title={`${r.key}: ${r.interviewNoShows} av ${r.interviewsBooked} intervjuer og ${r.firstDayNoShows} av ${r.firstDayExpected} første arbeidsdager`}
                    />
                    <span className="ml-2 flex items-center gap-1.5 text-[13px] tabular-nums">
                      {pct.format(v)}
                      <span className="text-[11px] text-muted-foreground">
                        ({r.interviewNoShows + r.firstDayNoShows} av {basis})
                      </span>
                      {/* Colour is never the only signal. */}
                      {alarm && (
                        <span className="flex items-center gap-0.5 text-[11px] text-danger">
                          <AlertTriangle className="size-3" aria-hidden /> høyt
                        </span>
                      )}
                      {thin && v > 0 && (
                        <span className="text-[11px] text-muted-foreground">for lite grunnlag</span>
                      )}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Andelen dekker både intervju og første arbeidsdag. Over {pct.format(NO_SHOW_ALARM)} markeres som
          høyt, men bare når grunnlaget er minst {MIN_BASIS} bookinger.
        </p>
      </CardContent>
    </Card>
  );
}

/** DASH-04 — kanalkvalitet. A table, because four measures cannot share one scale. */
function ChannelTable({ rows }: { rows: { channel: string; leads: number; hired: number; retained: number; robust: number; hireRate: number | null; robustRate: number | null }[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <h2 className="text-sm font-medium">Kanalkvalitet</h2>
        <p className="text-xs text-muted-foreground">
          Hvilke kanaler gir kandidater som blir værende. «Robust» er {ROBUST_SALES_THRESHOLD} salg,
          slik SRS-en definerer det.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Kanal</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Ansatt</th>
                <th className="pb-2 pr-6 text-right font-medium">Ansettelsesrate</th>
                <th className="pb-2 text-right font-medium">Fortsatt ansatt</th>
                <th className="pb-2 text-right font-medium">Robuste</th>
                <th className="pb-2 text-right font-medium">Robustrate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.channel}>
                  <td className="py-2">{r.channel}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.leads)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.hired)}</td>
                  <td className="py-2 pr-6 text-right tabular-nums text-muted-foreground">{r.hireRate === null ? "—" : pct1.format(r.hireRate)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.retained)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.robust)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{r.robustRate === null ? "—" : pct.format(r.robustRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/** DASH-03 — promotørkvalitet, inkludert effektivitet mot oppmøtedager. */
function PromoterTable({ rows }: { rows: { promoter: string; leads: number; qualified: number; hired: number; attendanceDays: number; sales: number; efficiency: number | null }[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <h2 className="text-sm font-medium">Promotørkvalitet</h2>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          Effektivitet er salg per oppmøtedag. Mange oppmøtedager med få salg er svak leveranse —
          eller manglende oppfølging.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Promotør</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Kvalifiserte</th>
                <th className="pb-2 text-right font-medium">Ansatte</th>
                <th className="pb-2 text-right font-medium">Oppmøtedager</th>
                <th className="pb-2 text-right font-medium">Salg</th>
                <th className="pb-2 text-right font-medium">Effektivitet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.promoter}>
                  <td className="py-2">{r.promoter}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.leads)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.qualified)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.hired)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.attendanceDays)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.sales)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {r.efficiency === null ? (
                      <Badge variant="outline" className="text-[10px]">ingen oppmøte</Badge>
                    ) : dec.format(r.efficiency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
