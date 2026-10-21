"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, Mail, FileSpreadsheet, Printer } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mascot } from "@/components/patterns/mascot";
import { mascotFor } from "@/lib/use-mascot";
import { DatePicker } from "@/components/patterns/date-picker";
import { SelectableButton } from "@/components/patterns/selectable-button";
import { PermissionGate } from "@/components/patterns/permission-gate";
import { ChannelMark } from "@/components/patterns/channel-mark";
import {
  downloadDashboard, useDashboardFilters, useRecruitmentDashboard, useReportSubscription, useSetReportSubscription,
} from "@/lib/api/recruitment-dashboard";
import { useAccess } from "@/lib/use-access";
import { errorMessage } from "@/lib/api/client";
import { TODAY } from "@/lib/shift-cell";
import {
  ROBUST_SALES_THRESHOLD, type ChannelQualityRow, type DashboardFilter, type FunnelStep, type NoShowRow,
  type PromoterQualityRow, type RecruitmentDashboard,
} from "@/types/recruitment-dashboard";

/**
 * DASH-01 … DASH-08 — rekrutteringsdashboardet som erstatter PDF-rapportene.
 *
 * Every figure is computed by recruitment-service from the status log (§5 l.614,
 * §8.1 l.753); this page filters and renders, it never recomputes. The rule
 * behind each number is in the KPI dictionary (/admin/kpi-ordbok) and its
 * version is printed in the footer.
 *
 * Every chart is a **single series**, which is a deliberate consequence of the
 * design system: series are encoded by lightness, and a sequential ramp only
 * means anything for one measure at a time. Where measures must be compared, a
 * table is used — never two y-axes.
 *
 * The no-show alarm is the server's (`alarm`): it is withheld below a minimum
 * number of observations, and the rate is then shown with its denominator. A
 * percentage of one booking is noise wearing a number's clothes.
 *
 * Filters live in the URL (03-data-contract), so a link shows the same view.
 * Wording follows SRS l.4: «godkjente avtaler», never money.
 */

const pct = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("nb-NO");
const dec = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const NO_SHOW_ALARM = 0.2;

const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
function rampAt(i: number, n: number) {
  return RAMP[Math.min(RAMP.length - 1, Math.floor((i / Math.max(1, n - 1)) * (RAMP.length - 1)))];
}

function minus(days: number) {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const PERIODS = [
  { v: "30", l: "Siste 30 dager" }, { v: "90", l: "Siste 90 dager" }, { v: "365", l: "Siste år" },
  { v: "egen", l: "Egendefinert" },
];

type UrlFilter = DashboardFilter & { days: string; groupBy: "uke" | "maned" };

function useUrlFilter(): [UrlFilter, (patch: Record<string, string>) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const days = sp.get("periode") ?? "90";
  const custom = days === "egen";
  const filter: UrlFilter = {
    days,
    from: custom ? sp.get("fra") || minus(89) : minus(Number(days) - 1),
    to: custom ? sp.get("til") || TODAY : TODAY,
    region: sp.get("region") ?? undefined, teamId: sp.get("team") ?? undefined, channel: sp.get("kanal") ?? undefined,
    includeImported: sp.get("importerte") === "1", includeSimulated: sp.get("simulerte") === "1", groupBy: (sp.get("per") === "maned" ? "maned" : "uke") as "uke" | "maned",
  };
  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "alle") next.delete(k); else next.set(k, v);
    }
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };
  return [filter, set];
}

function DashboardPage() {
  const [f, set] = useUrlFilter();
  const dash = useRecruitmentDashboard(f);
  const options = useDashboardFilters();
  const access = useAccess();
  const [exporting, setExporting] = React.useState<"xlsx" | "pdf" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  async function exportAs(format: "xlsx" | "pdf") {
    if (!dash.data) return;
    setExporting(format);
    setExportError(null);
    try {
      await downloadDashboard(format, f, dash.data);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : errorMessage(err));
    } finally {
      setExporting(null);
    }
  }

  const opt = options.data;
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Rekrutteringsdashboard"
        description={dash.data
          ? `${num.format(dash.data.basis.leads)} leads og ${num.format(dash.data.basis.candidates)} kandidater i grunnlaget${dash.data.basis.scope === "egne" ? " · dine egne" : ""}`
          : undefined}
        period={dash.data?.basis.period}
        source="Statusloggen"
        lastUpdated={dash.data ? new Date(dash.data.basis.computedAt) : new Date()}
        actions={
          <div className="flex flex-wrap items-center gap-2" data-print-hide>
            {exporting && <Mascot {...mascotFor("loading", "Lager rapporten…")} size={32} />}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportAs("xlsx")} disabled={!dash.data || Boolean(exporting)}>
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportAs("pdf")} disabled={!dash.data || Boolean(exporting)}>
              <Printer className="size-4" /> PDF
            </Button>
          </div>
        }
      />
      {exportError && <p className="text-sm text-danger" role="alert">{exportError}</p>}

      {/* DASH-07 — periode, region, team og kanal; bare verdier du har tilgang til. */}
      <div className="flex flex-wrap items-end gap-3" data-print-hide>
        <Filter id="d-period" label="Periode" value={f.days} onChange={(v) => set({ periode: v })} options={PERIODS} />
        <Filter id="d-region" label="Region" value={f.region ?? "alle"} onChange={(v) => set({ region: v })}
          options={[{ v: "alle", l: "Alle regioner" }, ...(opt?.regions ?? []).map((r) => ({ v: r, l: r }))]} />
        <Filter id="d-team" label="Team" value={f.teamId ?? "alle"} onChange={(v) => set({ team: v })}
          options={[{ v: "alle", l: "Alle team" }, ...(opt?.teams ?? []).filter((t) => !f.region || t.region === f.region)
            .map((t) => ({ v: t.id, l: t.name }))]} />
        <Filter id="d-chan" label="Kanal" value={f.channel ?? "alle"} onChange={(v) => set({ kanal: v })}
          options={[{ v: "alle", l: "Alle kanaler" }, ...(opt?.channels ?? []).map((c) => ({ v: c.key, l: c.name }))]} />
      </div>
      {f.days === "egen" && (
        <div className="flex flex-wrap items-end gap-3" data-print-hide>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-fra" className="text-xs text-muted-foreground">Fra</Label>
            <DatePicker id="d-fra" value={f.from ?? ""} max={f.to} onChange={(v) => set({ fra: v })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-til" className="text-xs text-muted-foreground">Til</Label>
            <DatePicker id="d-til" value={f.to ?? ""} min={f.from} max={TODAY} onChange={(v) => set({ til: v })} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2" data-print-hide>
        <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={f.includeImported} onCheckedChange={(v) => set({ importerte: v ? "1" : "" })} aria-label="Ta med importerte fra Recman" />
          Ta med kandidater importert fra Recman
        </label>
        {/* Only where demo applicants exist (staging): shown with the count left out, never silently. */}
        {(dash.data?.basis.simulatedLeads ?? 0) > 0 && (
          <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={Boolean(f.includeSimulated)} onCheckedChange={(v) => set({ simulerte: v ? "1" : "" })} aria-label="Ta med simulerte søkere" />
            Ta med {dash.data?.basis.simulatedLeads} simulerte søkere (testdata)
          </label>
        )}
      </div>

      <QueryBoundary
        query={dash}
        skeleton={<div className="flex flex-col gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 w-full rounded-lg" />)}</div>}
        isEmpty={(d) => d.basis.leads === 0 && d.basis.candidates === 0}
        emptyTitle="Ingen leads i perioden"
        emptyDescription="Prøv en lengre periode eller fjern et filter."
        className="flex flex-col gap-6"
      >
        {(d) => <Content d={d} groupBy={f.groupBy} onGroupBy={(v) => set({ per: v === "maned" ? "maned" : "" })} />}
      </QueryBoundary>

      {access.can("dashboard.subscribe") && <ReportSubscription />}
    </div>
  );
}

function Content({ d, groupBy, onGroupBy }: { d: RecruitmentDashboard; groupBy: "uke" | "maned"; onGroupBy: (v: string) => void }) {
  const total = (rows: NoShowRow[], k: "interviewNoShows" | "interviewsHeldOrMissed" | "firstDayNoShows" | "firstDayExpected") =>
    rows.reduce((n, r) => n + r[k], 0);
  const ivN = total(d.noShowByChannel, "interviewsHeldOrMissed"), ivBad = total(d.noShowByChannel, "interviewNoShows");
  const fdN = total(d.noShowByChannel, "firstDayExpected"), fdBad = total(d.noShowByChannel, "firstDayNoShows");
  const hired = d.funnel.find((s) => s.stageId === "ansatt")?.reached ?? 0;
  const t = d.timing;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Leads mottatt" value={num.format(d.basis.leads)} />
        <Stat label="Ansatt" value={num.format(hired)} hint={d.basis.leads ? `${pct1.format(hired / d.basis.leads)} av leads` : "ingen leads"} />
        <Stat label="Ikke møtt til intervju" value={ivN ? pct.format(ivBad / ivN) : "—"} hint={`${ivBad} av ${ivN}`} />
        <Stat label="Ikke møtt første dag" value={fdN ? pct.format(fdBad / fdN) : "—"} hint={`${fdBad} av ${fdN}`} />
        <Stat label="Dager fra lead til intervju" value={t.leadToInterview.median === null ? "—" : `${dec.format(t.leadToInterview.median)} d`}
          hint={t.leadToInterview.n ? `median · n = ${t.leadToInterview.n}` : "ingen intervjuer ennå"}
          title={t.leadToInterview.p75 === null ? undefined : `75 % innen ${dec.format(t.leadToInterview.p75)} dager`} />
        <Stat label="Dager fra lead til ansatt" value={t.leadToHire.median === null ? "—" : `${dec.format(t.leadToHire.median)} d`}
          hint={t.leadToHire.n ? `median · n = ${t.leadToHire.n}` : "ingen ansatt ennå"}
          title={t.leadToHire.p75 === null ? undefined : `75 % innen ${dec.format(t.leadToHire.p75)} dager`} />
      </div>

      <Funnel steps={d.funnel} />

      {ivN + fdN === 0 ? (
        <Card><CardContent className="py-5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Ikke møtt</span> — ingen intervjuer eller første arbeidsdager i perioden ennå.
          Tallene per kanal, salgsleder og periode kommer når de første er gjennomført.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <NoShowChart title="Ikke møtt per kanal" rows={d.noShowByChannel} marks />
            <NoShowChart title="Ikke møtt per salgsleder" rows={d.noShowByLeader} />
          </div>
          <PeriodTable rows={d.noShowByPeriod} groupBy={groupBy} onGroupBy={onGroupBy} />
        </>
      )}

      <ChannelTable rows={d.channelQuality} />
      <PromoterTable rows={d.promoterQuality} salesSyncedAt={d.basis.sources.salesSyncedAt} salesSource={d.basis.sources.salesSource ?? null} />

      <p className="text-xs text-muted-foreground">
        Definisjoner versjon {d.basis.definitionVersion} — se KPI-ordboken for regelen bak hvert tall. Beregnet{" "}
        {new Date(d.basis.computedAt).toLocaleString("nb-NO")}.
      </p>
    </>
  );
}

function Filter({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-44">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

/** Figures appear at their value — never counted up (04-analytics). */
function Stat({ label, value, hint, title }: { label: string; value: string; hint?: string; title?: string }) {
  return (
    <Card title={title}>
      <CardContent className="flex flex-col gap-1 py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl tabular-nums">{value}</p>
        {hint && <p className="text-xs tabular-nums text-muted-foreground">{hint}</p>}
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
        <ul className="flex flex-col gap-2" aria-label="Trakt">
          {steps.map((s, i) => (
            <li key={s.stageId} className="group flex items-center gap-3">
              <span className="w-32 shrink-0 text-right text-[13px] text-muted-foreground">{s.label}</span>
              <span className="relative flex h-6 flex-1 items-center">
                <span className="h-6 rounded-r-[4px] transition-[filter] group-hover:brightness-110 motion-safe:transition-[width] motion-safe:duration-300"
                  style={{ width: `${Math.max((s.reached / max) * 100, 0.8)}%`, background: rampAt(i, steps.length) }}
                  title={`${s.label}: ${num.format(s.reached)} · ${pct.format(s.conversion)} av leads${s.droppedBefore ? ` · ${num.format(s.droppedBefore)} falt fra før dette steget` : ""}`} />
                <span className="ml-2 text-[13px] tabular-nums">{num.format(s.reached)}</span>
                {s.droppedBefore > 0 && <span className="ml-2 text-[11px] tabular-nums text-muted-foreground">−{num.format(s.droppedBefore)}</span>}
              </span>
              <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{pct.format(s.conversion)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Hvor mange som noen gang har nådd steget (lengste steg nådd i statusloggen), ikke hvor mange som står der nå.
          Duplikater som er slått sammen, telles ikke.
        </p>
      </CardContent>
    </Card>
  );
}

/** DASH-02 — ikke møtt, både til intervju og første arbeidsdag. */
function NoShowChart({ title, rows, marks }: { title: string; rows: NoShowRow[]; marks?: boolean }) {
  const withData = rows.filter((r) => r.rate !== null);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <h2 className="text-sm font-medium">{title}</h2>
        {withData.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen intervjuer eller første arbeidsdager i perioden.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {withData.map((r) => {
              const v = r.rate ?? 0;
              const thin = !r.alarm;
              const high = v >= NO_SHOW_ALARM && r.alarm;
              return (
                <li key={r.key} className="group flex items-center gap-3">
                  <span className="flex w-28 shrink-0 items-center justify-end gap-1.5 truncate text-right text-[13px] text-muted-foreground" title={r.key}>
                    {marks && <ChannelMark channel={r.key} />}
                    <span className="truncate">{r.key}</span>
                  </span>
                  <span className="relative flex h-5 flex-1 items-center">
                    <span className="h-5 rounded-r-[4px]"
                      style={{ width: `${Math.max(v * 100, 1)}%`, background: high ? "var(--danger)" : thin ? "var(--chart-5)" : "var(--chart-3)" }}
                      title={`${r.key}: ${r.interviewNoShows} av ${r.interviewsHeldOrMissed} intervjuer og ${r.firstDayNoShows} av ${r.firstDayExpected} første arbeidsdager`} />
                    <span className="ml-2 flex items-center gap-1.5 text-[13px] tabular-nums">
                      {pct.format(v)}
                      <span className="text-[11px] text-muted-foreground">({r.interviewNoShows + r.firstDayNoShows} av {r.n})</span>
                      {high && <span className="flex items-center gap-0.5 text-[11px] text-danger"><AlertTriangle className="size-3" aria-hidden /> høyt</span>}
                      {thin && v > 0 && <span className="text-[11px] text-muted-foreground">for lite grunnlag</span>}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Andelen dekker både intervju og første arbeidsdag. Avbestilt i forkant teller ikke. Over {pct.format(NO_SHOW_ALARM)}{" "}
          markeres som høyt, men bare når grunnlaget er stort nok.
        </p>
      </CardContent>
    </Card>
  );
}

/** «2026-U43» → «Uke 43, 2026»; «2026-10» → «oktober 2026». */
function periodLabel(key: string) {
  const w = /^(\d{4})-U(\d{2})$/.exec(key);
  if (w) return `Uke ${Number(w[2])}, ${w[1]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) return new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
  return key;
}

/** DASH-02 «per periode» — a table: two measures per row. */
function PeriodTable({ rows, groupBy, onGroupBy }: { rows: NoShowRow[]; groupBy: "uke" | "maned"; onGroupBy: (v: string) => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Ikke møtt per periode</h2>
          <Select value={groupBy} onValueChange={onGroupBy}>
            <SelectTrigger size="sm" className="w-32" aria-label="Grupper per"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="uke">Per uke</SelectItem><SelectItem value="maned">Per måned</SelectItem></SelectContent>
          </Select>
        </div>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ingen intervjuer eller første arbeidsdager i perioden.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">{groupBy === "uke" ? "Uke" : "Mnd"}</th>
                <th className="pb-2 text-right font-medium">Intervju</th>
                <th className="pb-2 text-right font-medium">Første dag</th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2 tabular-nums">{periodLabel(r.key)}</td>
                    <td className="py-2 text-right tabular-nums">{r.interviewNoShows} av {r.interviewsHeldOrMissed}
                      <span className="ml-1.5 text-muted-foreground">{r.interviewRate === null ? "" : pct.format(r.interviewRate)}</span></td>
                    <td className="py-2 text-right tabular-nums">{r.firstDayNoShows} av {r.firstDayExpected}
                      <span className="ml-1.5 text-muted-foreground">{r.firstDayRate === null ? "" : pct.format(r.firstDayRate)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** DASH-04 — kanalkvalitet. A table, because several measures cannot share one scale. */
function ChannelTable({ rows }: { rows: ChannelQualityRow[] }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <h2 className="text-sm font-medium">Kanalkvalitet</h2>
        <p className="text-xs text-muted-foreground">
          Hvilke kanaler gir folk som blir værende og blir robuste. Robust = {ROBUST_SALES_THRESHOLD} endelige godkjente
          avtaler totalt, slik SRS-en definerer det.
        </p>
        <ul className="flex flex-col gap-2 sm:hidden">
          {rows.map((r) => (
            <li key={r.channel} className="rounded-lg border border-border p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium"><ChannelMark channel={r.channel} />{r.channel}</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 tabular-nums">
                <dt className="text-muted-foreground">Leads / ansatt</dt><dd className="text-right">{num.format(r.leads)} / {num.format(r.hired)}</dd>
                <dt className="text-muted-foreground">Aktive 90 d</dt><dd className="text-right">{r.eligible90 ? `${r.retained90} av ${r.eligible90}` : "—"}</dd>
                <dt className="text-muted-foreground">Robuste</dt><dd className="text-right">{num.format(r.robust)}{r.robustRate === null ? "" : ` · ${pct.format(r.robustRate)}`}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Kanal</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Ansatt</th>
                <th className="pb-2 pr-6 text-right font-medium">Ansettelsesrate</th>
                <th className="pb-2 text-right font-medium">Aktive 30 d</th>
                <th className="pb-2 text-right font-medium">Aktive 90 d</th>
                <th className="pb-2 text-right font-medium">Robuste</th>
                <th className="pb-2 text-right font-medium">Robustandel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.channel}>
                  <td className="py-2"><span className="inline-flex items-center gap-1.5"><ChannelMark channel={r.channel} />{r.channel}</span></td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.leads)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.hired)}</td>
                  <td className="py-2 pr-6 text-right tabular-nums text-muted-foreground">{r.hireRate === null ? "—" : pct1.format(r.hireRate)}</td>
                  <td className="py-2 text-right tabular-nums">{r.eligible30 ? `${r.retained30} av ${r.eligible30}` : "—"}</td>
                  <td className="py-2 text-right tabular-nums">{r.eligible90 ? `${r.retained90} av ${r.eligible90}` : "—"}</td>
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

/** DASH-03 — promotørkvalitet: what their recruits became, and their own work. */
function PromoterTable({ rows, salesSyncedAt, salesSource }: { rows: PromoterQualityRow[]; salesSyncedAt: string | null; salesSource: "hr" | "mock" | null }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <h2 className="text-sm font-medium">Promotørkvalitet</h2>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3" aria-hidden />
          Effektivitet er godkjente avtaler per oppmøtedag. Mange oppmøtedager med få avtaler er svak leveranse — eller
          manglende oppfølging.
          {!salesSyncedAt ? " Avtaletall fra HR er ikke hentet ennå."
            : salesSource === "mock" ? " Avtaletallene er testdata, ikke fra HR."
            : ` Avtaler fra HR, hentet ${new Date(salesSyncedAt).toLocaleString("nb-NO")}.`}
        </p>
        <ul className="flex flex-col gap-2 sm:hidden">
          {rows.map((r) => (
            <li key={r.promoterId} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{r.promoter}</p>
              <dl className="mt-2 grid grid-cols-2 gap-y-1 tabular-nums">
                <dt className="text-muted-foreground">Leads → ansatte</dt><dd className="text-right">{num.format(r.leads)} → {num.format(r.hired)}</dd>
                <dt className="text-muted-foreground">Oppmøtedager</dt><dd className="text-right">{num.format(r.attendanceDays)}</dd>
                <dt className="text-muted-foreground">Godkjente avtaler</dt><dd className="text-right">{dec.format(r.sales)}</dd>
                <dt className="text-muted-foreground">Per oppmøtedag</dt><dd className="text-right font-medium">{r.efficiency === null ? "—" : dec.format(r.efficiency)}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th />
                <th colSpan={4} className="border-b border-border pb-1 text-center font-medium">Rekrutterte</th>
                <th colSpan={3} className="border-b border-border pb-1 pl-4 text-center font-medium">Egne</th>
              </tr>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pt-1 font-medium">Promotør</th>
                <th className="pb-2 pt-1 text-right font-medium">Leads</th>
                <th className="pb-2 pt-1 text-right font-medium">Kvalifiserte</th>
                <th className="pb-2 pt-1 text-right font-medium">Ansatte</th>
                <th className="pb-2 pt-1 text-right font-medium">Robuste</th>
                <th className="pb-2 pl-4 pt-1 text-right font-medium">Oppmøtedager</th>
                <th className="pb-2 pt-1 text-right font-medium">Godkjente avtaler</th>
                <th className="pb-2 pt-1 text-right font-medium">Per oppmøtedag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.promoterId}>
                  <td className="py-2">{r.promoter}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.leads)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.qualified)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.hired)}</td>
                  <td className="py-2 text-right tabular-nums">{num.format(r.robust)}</td>
                  <td className="py-2 pl-4 text-right tabular-nums">{num.format(r.attendanceDays)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {dec.format(r.sales)}
                    {r.salesProvisional > 0 && <span className="ml-1 text-[11px] text-muted-foreground">(+{dec.format(r.salesProvisional)} på vei)</span>}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {r.efficiency === null ? <Badge variant="outline" className="text-[10px]">ingen oppmøte</Badge> : dec.format(r.efficiency)}
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

/**
 * DASH-01 — the dashboard replaces the PDF reports that went out by e-mail, but
 * the requirement keeps a door open: "De som ønsker det, kan fortsatt velge å
 * få rapporten på epost."
 *
 * Opt-in, off by default, and to yourself only: the report is rendered with the
 * subscriber's own access, so a recipient typed in by someone else would receive
 * figures they cannot see. Others subscribe themselves.
 */
function ReportSubscription() {
  const sub = useReportSubscription();
  const save = useSetReportSubscription();
  const data = sub.data;
  if (!data) return null;
  return (
    <Card data-print-hide>
      <CardContent className="flex flex-col gap-4 py-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4 text-muted-foreground" aria-hidden /> Rapport på e-post
        </h2>
        <p className="text-xs text-muted-foreground">
          Dashboardet erstatter PDF-rapportene. Vil du fortsatt ha rapporten på e-post, slår du den på her. Den sendes
          til din egen e-post og viser det du har tilgang til{data.scope === "alle" ? " (alle)" : " (dine egne)"}.
        </p>
        <label className="flex items-center gap-3 text-sm">
          <Switch id="sub-on" checked={data.enabled} disabled={save.isPending}
            onCheckedChange={(v) => save.mutate({ enabled: v, frequency: data.frequency, filters: data.filters })} />
          <span>Send meg rapporten på e-post</span>
        </label>
        {data.enabled && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Label id="sub-freq" className="text-xs text-muted-foreground">Hyppighet</Label>
            {(["ukentlig", "manedlig"] as const).map((fr) => (
              <SelectableButton key={fr} type="button" selected={data.frequency === fr} disabled={save.isPending}
                onClick={() => save.mutate({ enabled: true, frequency: fr, filters: data.filters })}>
                {fr === "ukentlig" ? "Ukentlig (mandag)" : "Månedlig (den 1.)"}
              </SelectableButton>
            ))}
            {data.lastSentAt && <span className="text-xs text-muted-foreground">Sist sendt {new Date(data.lastSentAt).toLocaleDateString("nb-NO")}</span>}
          </div>
        )}
        {save.isError && <p className="text-sm text-danger" role="alert">{errorMessage(save.error)}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  return (
    <PermissionGate permission="recruitdash.view">
      <React.Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <DashboardPage />
      </React.Suspense>
    </PermissionGate>
  );
}
