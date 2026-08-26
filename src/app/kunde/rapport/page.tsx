"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Download, Hourglass, Info, Printer, Users } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { FigureWithDefinition } from "@/components/patterns/figure-with-definition";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Segmented } from "@/components/patterns/segmented";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendLineChart } from "@/components/charts/trend-line-chart";
import { DistributionBar } from "@/components/charts/distribution-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerReport } from "@/lib/api/quality";
import { downloadCsv, waitForChartsToSettle } from "@/lib/report-export";
import { DUR, EASE_ENTER } from "@/lib/motion";
import { formatNumber } from "@/lib/format";
import type { CampaignReport, Granularity } from "@/types/customer";

/**
 * A report that happens to be live — not a small version of the staff product.
 *
 * The reader is a charity campaign manager who logs in once a month, has had no
 * training, remembers nothing from last time, and often needs to show the result
 * to a board. So it opens with a plain-language verdict before any number: that
 * is the thing they actually came for, and no dashboard convention delivers it.
 *
 * Three rules this screen holds to:
 *
 * **The filters move the numbers.** Every control here is part of the query key.
 * A period selector that leaves the figures untouched is worse than no selector
 * at all — it invites a conclusion drawn from a difference that isn't there.
 *
 * **The screen renders the agreement, it does not decide it.** Which figures
 * exist, which granularities are offered, whether the work behind the numbers is
 * visible: all of it arrives from the endpoint, computed against this customer's
 * contract (FR-C-07/08). There is no local list of fields to fall out of sync.
 *
 * No staff vocabulary anywhere (FR-C-10). Røy stays in the header as the
 * company mark and never appears beside a figure — this is a board document,
 * and a character commenting on the result would undermine it.
 */
export default function KundeRapport() {
  const [campaign, setCampaign] = React.useState<string>();
  const [granularity, setGranularity] = React.useState<Granularity>("month");
  const [period, setPeriod] = React.useState<string>();
  const [location, setLocation] = React.useState("alle");
  const [organisation, setOrganisation] = React.useState("alle");

  const query = useCustomerReport({ campaign, granularity, period, location, organisation });

  /**
   * Changing the granularity invalidates the selected bucket — "August 2026" is
   * not a week. Clearing it lets the endpoint pick the newest bucket at the new
   * level, which is what someone switching to "Uke" means by it.
   */
  function changeGranularity(next: Granularity) {
    setGranularity(next);
    setPeriod(undefined);
  }

  return (
    <QueryBoundary
      query={query}
      skeleton={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-20 rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        </div>
      }
      errorHint="Får du fortsatt ikke opp rapporten, ta kontakt med kontaktpersonen din hos AB Marketing."
    >
      {(report) => (
        <Report
          report={report}
          fetching={query.isFetching}
          granularity={granularity}
          location={location}
          organisation={organisation}
          onCampaign={setCampaign}
          onGranularity={changeGranularity}
          onPeriod={setPeriod}
          onLocation={setLocation}
          onOrganisation={setOrganisation}
        />
      )}
    </QueryBoundary>
  );
}

/**
 * A column count that divides the figures evenly.
 *
 * The agreement decides how many figures there are, so the grid cannot be a
 * fixed number: four figures in three columns leaves one card alone on a row
 * looking like a mistake, and five in three looks like something failed to
 * load. Each count gets the layout that fills its rows.
 */
/**
 * Lay the page out at its printed width, let the charts finish redrawing, then
 * print.
 *
 * `window.print()` on its own gives charts still animating toward their printed
 * width — see the notes in globals.css and report-export.ts. The attribute is
 * removed in a `finally`, so a cancelled dialog or a thrown error cannot leave
 * the page stuck in print layout.
 */
async function printReport() {
  const root = document.documentElement;
  root.setAttribute("data-printing", "");
  try {
    window.dispatchEvent(new Event("resize"));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await waitForChartsToSettle();
    window.print();
  } finally {
    root.removeAttribute("data-printing");
  }
}

/** Preparing the page takes up to a second and a half; a button that looks
 *  dead for that long is indistinguishable from one that is broken. */
function PrintButton() {
  const [preparing, setPreparing] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={preparing}
      onClick={async () => {
        setPreparing(true);
        try {
          await printReport();
        } finally {
          setPreparing(false);
        }
      }}
    >
      <Printer className="size-4" aria-hidden />
      {preparing ? "Klargjør…" : "Skriv ut"}
    </Button>
  );
}

const FIGURE_COLS: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3",
};

const PLURAL: Record<string, string> = { dag: "dager", uke: "uker", måned: "måneder" };
const UNIT_COLUMN: Record<string, string> = { dag: "Dag", uke: "Uke", måned: "Måned" };

const GRANULARITY_LABEL: Record<Granularity, string> = {
  week: "Uke",
  month: "Måned",
  year: "År",
};

function Report({
  report,
  fetching,
  granularity,
  location,
  organisation,
  onCampaign,
  onGranularity,
  onPeriod,
  onLocation,
  onOrganisation,
}: {
  report: CampaignReport;
  fetching: boolean;
  granularity: Granularity;
  location: string;
  organisation: string;
  onCampaign: (v: string) => void;
  onGranularity: (v: Granularity) => void;
  onPeriod: (v: string) => void;
  onLocation: (v: string) => void;
  onOrganisation: (v: string) => void;
}) {
  const reduced = useReducedMotion();
  const { filter } = report;
  const unit = report.breakdown.unit;
  // Norwegian does not pluralise by appending "er" to everything — "ukeer" is
  // the sort of detail that tells a reader the page was generated, not written.
  const units = PLURAL[unit] ?? unit;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        title="Kampanjerapport"
        description={report.campaign}
        period={filter.periodLabel}
        source="AB Marketing"
        lastUpdated={report.reportDate}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => downloadCsv(report)}
            >
              <Download className="size-4" aria-hidden /> Last ned (CSV)
            </Button>
            <PrintButton />
          </div>
        }
      />

      {/* The verdict — one sentence, before any figure. Re-announced when the
          filter changes, because it is the sentence that just changed meaning. */}
      <div aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={report.verdict}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: DUR.base, ease: EASE_ENTER }}
            className="max-w-2xl text-lg leading-relaxed text-foreground"
          >
            {report.verdict}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* FR-C-09 — a correction that moved this period's figures, in the
          customer's own words, attached to the period it changed. */}
      {report.correction && (
        <div className="flex gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning-on-tint">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <span className="font-medium">Tallene ble korrigert {report.correction.date}.</span>{" "}
            {report.correction.note}
          </p>
        </div>
      )}

      {report.narrowedNotice && (
        <p className="text-[13px] text-muted-foreground">{report.narrowedNotice}</p>
      )}

      <Filters
        report={report}
        granularity={granularity}
        location={location}
        organisation={organisation}
        onCampaign={onCampaign}
        onGranularity={onGranularity}
        onPeriod={onPeriod}
        onLocation={onLocation}
        onOrganisation={onOrganisation}
      />

      {/*
        The whole body dims while a new filter loads rather than collapsing into
        a skeleton. Keeping the old answer visible under the new one is the
        difference between "updating" and "gone" — and the numbers are the only
        reason anybody opened this page.
      */}
      <motion.div
        animate={{ opacity: fetching ? 0.45 : 1 }}
        transition={{ duration: DUR.fast, ease: EASE_ENTER }}
        aria-busy={fetching}
        className="flex flex-col gap-6"
      >
        <Figures report={report} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartFrame
            question={`Ligger kampanjen an mot planen?`}
            period={filter.periodLabel}
            source="AB Marketing"
            lastUpdated={report.reportDate}
            state="ready"
            summary={`Faktisk resultat mot plan for de siste periodene fram til ${filter.periodLabel.toLowerCase()}.`}
            table={{
              caption: `Resultat mot plan, ${filter.periodLabel}`,
              columns: ["Periode", "Faktisk", "Plan"],
              rows: report.resultVsPlan.map((p) => [p.label, p.value, p.plan ?? "—"]),
            }}
          >
            <TrendLineChart
              data={report.resultVsPlan.map((p) => ({
                label: p.label,
                value: p.value,
                secondaryValue: p.plan,
              }))}
              seriesName="Faktisk"
              secondarySeriesLabel="Plan"
            />
          </ChartFrame>

          <ChartFrame
            question="Hvor ligger vi akkumulert mot plan?"
            period={filter.periodLabel}
            source="AB Marketing"
            lastUpdated={report.reportDate}
            state="ready"
            summary="Akkumulert resultat mot akkumulert plan gjennom perioden."
            table={{
              caption: `Akkumulert mot plan, ${filter.periodLabel}`,
              columns: ["Periode", "Akkumulert", "Plan"],
              rows: report.accumulated.map((p) => [p.label, p.value, p.plan ?? "—"]),
            }}
          >
            <TrendLineChart
              data={report.accumulated.map((p) => ({
                label: p.label,
                value: p.value,
                secondaryValue: p.plan,
              }))}
              seriesName="Akkumulert"
              secondarySeriesLabel="Plan"
            />
          </ChartFrame>

          <ChartFrame
            question={`Hvilke ${units} har levert best?`}
            period={filter.periodLabel}
            source="AB Marketing"
            lastUpdated={report.reportDate}
            state="ready"
            summary={`Rekrutterte givere per ${unit} innenfor ${filter.periodLabel.toLowerCase()}.`}
            table={{
              caption: `Rekrutterte givere per ${unit}, ${filter.periodLabel}`,
              columns: [UNIT_COLUMN[unit] ?? "Periode", "Givere"],
              rows: report.breakdown.points.map((w) => [w.label, w.value]),
            }}
          >
            {/* Chronological, not longest-first: these are time buckets, and
                their order is part of what the reader is looking at. */}
            <DistributionBar data={report.breakdown.points} order="as-given" maxRows={12} />
          </ChartFrame>

          <SplitChart
            report={report}
            location={location}
            organisation={organisation}
          />
        </div>

        {report.fieldwork && <Fieldwork report={report} />}
      </motion.div>

      <p className="font-mono text-[10.5px] leading-relaxed text-muted-foreground">
        Alle tall gjelder godkjente avtaler i valgt periode · rapportdato{" "}
        {report.reportDate} · innholdet følger avtalen mellom{" "}
        {report.campaign.split(" ")[0]} og AB Marketing
      </p>
    </div>
  );
}

/**
 * Only what the contract offers.
 *
 * A control for a granularity the customer is not on, or an organisation
 * breakdown they did not buy, is a promise the report cannot keep. The endpoint
 * sends the permitted options with the data; this renders exactly those.
 */
function Filters({
  report,
  granularity,
  location,
  organisation,
  onCampaign,
  onGranularity,
  onPeriod,
  onLocation,
  onOrganisation,
}: {
  report: CampaignReport;
  granularity: Granularity;
  location: string;
  organisation: string;
  onCampaign: (v: string) => void;
  onGranularity: (v: Granularity) => void;
  onPeriod: (v: string) => void;
  onLocation: (v: string) => void;
  onOrganisation: (v: string) => void;
}) {
  const { options, filter } = report;
  const showGranularity = options.granularities.length > 1;

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        {options.campaigns.length > 1 && (
          <Select value={filter.campaign} onValueChange={onCampaign}>
            <SelectTrigger className="w-56" aria-label="Kampanje">
              <SelectValue placeholder="Kampanje" />
            </SelectTrigger>
            <SelectContent>
              {options.campaigns.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showGranularity && (
          <Segmented
            value={granularity}
            onChange={onGranularity}
            ariaLabel="Periodeinndeling"
            layoutId="kunde-granularity"
            options={options.granularities.map((g) => ({
              value: g,
              label: GRANULARITY_LABEL[g],
            }))}
          />
        )}

        <Select value={filter.period} onValueChange={onPeriod}>
          <SelectTrigger className="w-44" aria-label="Periode">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            {options.periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={location} onValueChange={onLocation}>
          <SelectTrigger className="w-44" aria-label="Lokasjon">
            <SelectValue placeholder="Lokasjon" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle lokasjoner</SelectItem>
            {options.locations.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {options.organisations.length > 0 && (
          <Select value={organisation} onValueChange={onOrganisation}>
            <SelectTrigger className="w-56" aria-label="Organisasjon">
              <SelectValue placeholder="Organisasjon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Hele organisasjonen</SelectItem>
              {options.organisations.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* What the numbers below cover, in one readable line — so nobody exports
          a filtered report and presents it as the whole campaign. */}
      <p className="text-[12.5px] text-muted-foreground">
        Viser {filter.periodLabel.toLowerCase()} ·{" "}
        {filter.location === "alle" ? "alle lokasjoner" : filter.location}
        {options.organisations.length > 0 &&
          ` · ${filter.organisation === "alle" ? "hele organisasjonen" : filter.organisation}`}
      </p>
    </div>
  );
}

/** FR-C-03/07 — the figures this agreement includes, in the agreed order. */
function Figures({ report }: { report: CampaignReport }) {
  const reduced = useReducedMotion();
  const ready = report.figures.filter((f) => f.display !== null);
  const withheld = report.figures.filter((f) => f.display === null);
  const cols = FIGURE_COLS[Math.min(ready.length, 6)] ?? "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-4">
      <div className={`grid grid-cols-1 gap-4 ${cols}`}>
        {ready.map((f, i) => (
          <motion.div
            key={f.key}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE_ENTER, delay: Math.min(i, 5) * 0.03 }}
          >
            <FigureWithDefinition
              label={f.label}
              value={f.display ?? ""}
              definition={f.definition}
              source={f.source}
              reportDate={report.reportDate}
              version={f.version}
            />
          </motion.div>
        ))}
      </div>
      {withheld.length > 0 && <Withheld figures={withheld} />}
    </div>
  );
}

/**
 * FR-C-11 — figures the agreement includes but that are not reportable yet.
 *
 * One note rather than one empty card each. Two cards side by side, each saying
 * a slightly different version of "the definition isn't agreed", spends the
 * most valuable space on the page saying nothing twice — and on a phone it is
 * a screen and a half of absence before the first chart.
 *
 * They stay visible rather than disappearing, because a figure the customer is
 * contractually entitled to should be visibly pending, not silently missing.
 */
function Withheld({ figures }: { figures: CampaignReport["figures"] }) {
  const names = figures.map((f) => f.label);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} og ${names.at(-1)!.toLowerCase()}`;

  return (
    <div className="flex gap-3 rounded-xl border border-dashed border-border bg-secondary/25 px-5 py-4">
      <Hourglass className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13.5px] text-foreground">{list} er ikke klare ennå</p>
        <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
          {figures[0].withheldReason ??
            "Tallet vises så snart definisjonen er avklart."}{" "}
          Tallene kommer i rapporten så snart det er på plass — dere trenger ikke
          gjøre noe.
        </p>
      </div>
    </div>
  );
}

/**
 * The fourth chart answers whichever split question is still open.
 *
 * With every location selected, "where do the donors come from" means places.
 * With one place chosen, that chart would be a single bar — so if the contract
 * covers sub-organisations, it switches to those; if it doesn't, the frame says
 * why it is empty instead of drawing a meaningless bar.
 */
function SplitChart({
  report,
  location,
  organisation,
}: {
  report: CampaignReport;
  location: string;
  organisation: string;
}) {
  const byPlace = location === "alle";
  const data = byPlace ? report.byLocation : report.byOrganisation;
  const usable = data.length > 1;
  const dimension = byPlace ? "Sted" : "Organisasjon";

  return (
    <ChartFrame
      question={byPlace ? "Hvor kommer giverne fra?" : "Hvilken del av organisasjonen?"}
      period={report.filter.periodLabel}
      source="AB Marketing"
      lastUpdated={report.reportDate}
      state={usable ? "ready" : "empty"}
      emptyCause="filtered-out"
      emptyTitle="Ingen fordeling å vise"
      emptyDescription={
        byPlace
          ? "Kampanjen er kjørt på ett sted i denne perioden."
          : organisation !== "alle"
            ? "Én del av organisasjonen er valgt. Velg «Hele organisasjonen» for å sammenligne."
            : "Avtalen deres dekker ikke oppdeling per organisasjon."
      }
      summary={`Rekrutterte givere fordelt per ${dimension.toLowerCase()} i ${report.filter.periodLabel.toLowerCase()}.`}
      table={{
        caption: `Givere per ${dimension.toLowerCase()}, ${report.filter.periodLabel}`,
        columns: [dimension, "Givere"],
        rows: data.map((p) => [p.label, p.value]),
      }}
    >
      <DistributionBar data={data} />
    </ChartFrame>
  );
}

/**
 * FR-C-08 — the work behind the numbers, when the contract covers it.
 *
 * Counts and averages only. The customer bought a result; the people who
 * produced it did not agree to be identified to them, and FR-C-10 removes the
 * vocabulary that would do it anyway.
 */
function Fieldwork({ report }: { report: CampaignReport }) {
  const f = report.fieldwork;
  if (!f) return null;

  const cells: [string, string][] = [
    ["Ververe i felt", formatNumber(f.fundraisers)],
    ["Dager i felt", formatNumber(f.daysInField)],
    ["Snitt givere per verver", formatNumber(f.averagePerFundraiser)],
    ["Samtaler per giver", formatNumber(f.conversationsPerDonor)],
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-[15px] text-foreground">Innsatsen bak tallene</h2>
          <p className="mt-1 max-w-prose text-[13px] text-muted-foreground">
            Omfanget av arbeidet som ligger bak resultatet i{" "}
            {report.filter.periodLabel.toLowerCase()}. Avtalen deres dekker samlede tall — ikke
            enkeltpersoner.
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 font-mono text-[19px] tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
