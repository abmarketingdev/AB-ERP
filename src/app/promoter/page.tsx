"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, GraduationCap, Newspaper } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { KpiTile } from "@/components/patterns/kpi-tile";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { CorrectionNotice } from "@/components/patterns/correction-notice";
import { Segmented } from "@/components/patterns/segmented";
import { WeekBars } from "@/components/charts/week-bars";
import { GoalJourney } from "@/components/patterns/goal-journey";
import { Mascot } from "@/components/patterns/mascot";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWeek, formatDate } from "@/lib/format";
import { bySuggested, isOverdue, STATUS_LABEL } from "@/lib/course";
import { useSession } from "@/lib/permissions";
import {
  usePromoterKpis,
  useWeekPlan,
  usePromoterGoal,
  usePromoterCourses,
  usePromoterNews,
  useCorrectionNotices,
  type KpiGranularity,
} from "@/lib/api/promoter";

/**
 * FR-P-01 — weekly plan, own KPIs, goal, courses and news on one screen.
 *
 * Card order is the order a promoter cares about at 08:00. There is deliberately
 * no trend chart here: a field worker on a phone needs numbers, not analysis.
 * The only graphics are the week bars and the in-tile sparklines, both of which
 * answer "what shape is this" rather than inviting interpretation.
 */
/**
 * A greeting, and deliberately nothing else.
 *
 * It says hello and states the date. It does not say "you're on a 5-day
 * streak", it does not compare the reader to anyone, and it does not change
 * expression based on whether they are behind — a character that looks
 * disappointed at 08:00 is a mechanic, not a welcome.
 */
function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  const part = hour < 10 ? "God morgen" : hour < 17 ? "Hei" : "God kveld";
  const [state, setState] = React.useState<"greeting" | "idle">("greeting");

  React.useEffect(() => {
    const t = setTimeout(() => setState("idle"), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <Mascot state={state} size={64} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[15px] text-foreground">
          {part}, {name.split(" ")[0]}.
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" }).replace(
            /^./,
            (c) => c.toUpperCase(),
          )}
        </p>
      </div>
    </div>
  );
}

export default function PromoterForside() {
  const now = new Date();
  // FR-P-02 — every card names the person it applies to.
  const who = useSession()?.name ?? "Deg";
  const [granularity, setGranularity] = React.useState<KpiGranularity>("week");

  const kpis = usePromoterKpis(granularity);
  const week = useWeekPlan();
  const goal = usePromoterGoal();
  const courses = usePromoterCourses();
  const news = usePromoterNews();
  const notices = useCorrectionNotices();

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Forside"
        description="Din uke, dine tall"
        period={formatWeek(now)}
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      {/*
        Røy earns his place here and not on a leader screen. This is the
        promoter's own home page: nobody else is being judged, no one else's
        figures are on it, and a greeting is not a nudge. The rule the whole
        product follows — a character never appears where a manager is looking
        at a named individual — is intact.
      */}
      <Greeting name={who} />

      {/* Corrections sit at the top, not buried — FR-P-11 / story P-3. */}
      {notices.data && notices.data.length > 0 && <CorrectionNotice notices={notices.data} />}

      {/* ── Dine tall (FR-P-04) ────────────────────────────────────────────── */}
      <section aria-labelledby="kpi-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="kpi-h" className="text-[15px] font-medium text-foreground">
            Dine tall
          </h2>
          <Segmented
            layoutId="kpi-period"
            ariaLabel="Velg periode for dine tall"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: "day", label: "Dag" },
              { value: "week", label: "Uke" },
              { value: "month", label: "Måned" },
            ]}
          />
        </div>

        <QueryBoundary
          query={kpis}
          skeleton={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[188px] rounded-xl" />
              ))}
            </div>
          }
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen tall for denne perioden"
        >
          {(list) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((kpi, i) => (
                <motion.div
                  key={`${granularity}-${kpi.key}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.24, ease: [0.2, 0, 0, 1] }}
                >
                  <KpiTile kpi={kpi} />
                </motion.div>
              ))}
            </div>
          )}
        </QueryBoundary>
      </section>

      {/* ── Denne uken (FR-P-06) ───────────────────────────────────────────── */}
      <section aria-labelledby="week-h">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="week-h" className="text-[15px] font-medium text-foreground">
            Denne uken
          </h2>
          <Link
            href="/promoter/ukeplan"
            className="flex items-center gap-1 text-[12px] text-[var(--ab-accent-11)] hover:underline min-h-11 sm:min-h-6"
          >
            Hele ukeplanen <ArrowRight className="size-3" />
          </Link>
        </div>
        <QueryBoundary
          query={week}
          skeleton={<Skeleton className="h-52 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen ukeplan lagt inn ennå"
        >
          {(days) => (
            <div className="rounded-xl border border-border bg-card p-5">
              <WeekBars days={days} />
              <p className="mt-4 border-t border-border pt-3 font-mono text-[10.5px] text-muted-foreground">
                {who} · {formatWeek(now)} · AB Maps
              </p>
            </div>
          )}
        </QueryBoundary>
      </section>

      {/* ── Mål (FR-P-07) ──────────────────────────────────────────────────── */}
      <section aria-labelledby="goal-h">
        <h2 id="goal-h" className="mb-3 text-[15px] font-medium text-foreground">
          Månedsmål
        </h2>
        <QueryBoundary query={goal} skeleton={<Skeleton className="h-64 rounded-xl" />}>
          {(g) => <GoalJourney goal={g} subject={who} />}
        </QueryBoundary>
      </section>

      {/* ── Kurs + Nyheter ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QueryBoundary
          query={courses}
          skeleton={<Skeleton className="h-44 rounded-xl" />}
          isEmpty={(d) => d.filter((c) => c.status !== "completed").length === 0}
          emptyTitle="Alle kurs er fullført"
          emptyDescription="Ingenting forfaller denne perioden."
        >
          {(list) => {
            // FR-P-09 — overdue first, completed collapsed away entirely.
            const open = list.filter((c) => c.status !== "completed").sort(bySuggested);
            return (
              <Panel
                icon={GraduationCap}
                title="Kurs som venter"
                href="/promoter/kurs"
                footer={`${who} · Læringsplattformen eier innholdet`}
              >
                <ul className="flex flex-col gap-2.5">
                  {open.slice(0, 3).map((c) => (
                    /*
                     * Stacked on a phone, one line from `sm:` up. At 390px a
                     * title, a date and two badges competing for one row left
                     * the course showing as "GDPR o…", which is the one piece
                     * of information the row exists to carry.
                     */
                    <li
                      key={c.id}
                      className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                    >
                      <span
                        className="min-w-0 flex-1 text-[13px] text-foreground sm:truncate"
                        title={c.title}
                      >
                        {c.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {c.deadline ?? "Når som helst"}
                        </span>
                        {/* Overdue is a modifier on the progress status, so the
                            panel shows both rather than replacing one with the
                            other — same rule as the full Kurs screen. */}
                        {isOverdue(c) && <Badge variant="destructive">Forfalt</Badge>}
                        <Badge variant="outline">{STATUS_LABEL[c.status]}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          }}
        </QueryBoundary>

        <QueryBoundary
          query={news}
          skeleton={<Skeleton className="h-44 rounded-xl" />}
          isEmpty={(d) => d.length === 0}
          emptyTitle="Ingen nyheter"
        >
          {(list) => (
            <Panel
              icon={Newspaper}
              title="Nyheter"
              href="/promoter/nyheter"
              footer={`${who} · avdeling, kampanje og felles kunngjøringer`}
            >
              <ul className="flex flex-col gap-3">
                {list.slice(0, 2).map((n) => (
                  <li key={n.id} className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[13px] text-foreground">
                      {!n.read && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-[var(--ab-accent-9)]"
                          aria-label="Ulest"
                        />
                      )}
                      {n.title}
                    </span>
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {n.scope} · {n.publishedAt}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}

/** Shared card chrome so the two lower panels cannot drift apart. */
function Panel({
  icon: Icon,
  title,
  href,
  footer,
  children,
}: {
  icon: React.ElementType;
  title: string;
  href: string;
  footer: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </span>
        <Link
          href={href}
          className="flex items-center gap-1 text-[12px] text-[var(--ab-accent-11)] hover:underline min-h-11 sm:min-h-6"
        >
          Se alle <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="flex-1 px-5 pb-4">{children}</div>
      {/* FR-P-02 — every card states its source. */}
      <p className="border-t border-border px-5 py-2.5 font-mono text-[10.5px] text-muted-foreground">
        {footer}
      </p>
    </div>
  );
}
