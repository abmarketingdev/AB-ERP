"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, CircleDot, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Segmented } from "@/components/patterns/segmented";
import { Mascot } from "@/components/patterns/mascot";
import { Skeleton } from "@/components/ui/skeleton";
import { usePromoterCourses } from "@/lib/api/promoter";
import { useSession } from "@/lib/permissions";
import {
  STATUS_LABEL,
  bySuggested,
  byDeadline,
  byTitle,
  deadlineBucket,
  deadlineText,
  effortText,
  isOverdue,
} from "@/lib/course";
import type { Course } from "@/types/promoter";

/**
 * FR-P-08 / FR-P-09 — mandatory courses with deadline and status.
 *
 * The model here is the GOV.UK "complete multiple tasks" pattern, not a
 * consumer learning path. That pattern exists for exactly this case: mandatory,
 * multi-part, and read by people who did not choose to be here. Four of its
 * rules do the heavy lifting.
 *
 *  - **Completed recedes.** Finished courses are plain text with no colour and
 *    live in a collapsed section. Colour goes on what still needs action, never
 *    on achievement. This is the single most anti-gamified move available and
 *    it comes straight out of a government design system.
 *  - **Any order.** The order is labelled *Foreslått* and can be re-sorted.
 *    Nothing is ever locked: there is no reason a promoter cannot take the
 *    security course first, and gating it would remove a choice while buying no
 *    compliance. Per Sailer et al., autonomy is the one need no graphic can
 *    fake — it comes only from real options, so the screen ships real options.
 *  - **Overdue is a modifier**, not a status. "Ikke startet · Frist gikk ut
 *    22. aug" tells you two things; "Forfalt" hides one of them.
 *  - **Status is always text** (WCAG 1.4.1, Level A) — never a colour alone.
 *
 * Deliberately absent: streaks, points, badges, peer comparison, normative
 * messaging ("9 av 10 kolleger har fullført"), locked nodes, endowed progress,
 * and any mascot expression that escalates as a deadline approaches. Those work
 * on an app you can delete at no cost. Aimed at someone whose income depends on
 * the tool, they stop being persuasion.
 */

type Sort = "suggested" | "deadline" | "title";

const SORTS: Record<Sort, (a: Course, b: Course) => number> = {
  suggested: bySuggested,
  deadline: byDeadline,
  title: byTitle,
};

export default function PromoterKurs() {
  const now = new Date();
  const who = useSession()?.name ?? "Deg";
  const courses = usePromoterCourses();
  const [showDone, setShowDone] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<Sort>("suggested");

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Kurs"
        description="Obligatoriske kurs og status"
        source="Læringsplattform"
        lastUpdated={now}
      />

      <QueryBoundary
        query={courses}
        skeleton={<Skeleton className="h-80 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen kurs tildelt"
        emptyDescription="Kurs tildeles av HR og dukker opp her automatisk."
        className="flex flex-col gap-7"
      >
        {(list) => {
          const mandatory = list.filter((c) => c.mandatory);
          const doneMandatory = mandatory.filter((c) => c.status === "completed");
          const completed = list.filter((c) => c.status === "completed");

          const open = list.filter((c) => c.status !== "completed");
          // The recommendation is computed from the suggested order and does not
          // move when the reader re-sorts the view — re-sorting changes what you
          // are looking at, not what is advised.
          const next = [...open].sort(bySuggested)[0];
          const shown = [...open].sort(SORTS[sort]);
          const overdue = open.filter(isOverdue);
          const allDone = open.length === 0;

          return (
            <>
              {/* Approach-framed completion count in plain text. Chang et al.
                  found people monitor goals framed as avoiding a bad outcome
                  less often — so this counts what is finished, not what looms. */}
              <div className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-card px-5 py-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-foreground">
                    {allDone
                      ? "Alle obligatoriske kurs er fullført."
                      : `Du har fullført ${doneMandatory.length} av ${mandatory.length} obligatoriske kurs.`}
                  </p>

                  <Steps done={doneMandatory.length} total={mandatory.length} />

                  {next ? (
                    <>
                      <p className="mt-3 text-[13px] text-muted-foreground">
                        Neste: <span className="text-foreground">{next.title}</span> ·{" "}
                        {effortText(next)} · {deadlineText(next).toLowerCase()}
                      </p>
                      {/* Scottish Government DS: a skip link to the first
                          unfinished task. The accessible, non-coercive form of
                          "next best action" — no floating CTA required. */}
                      <a
                        href="#neste-kurs"
                        className="mt-2.5 inline-flex min-h-11 items-center rounded text-[13px] text-[var(--ab-accent-11)] underline sm:min-h-6 decoration-[var(--ab-accent-9)]/40 underline-offset-4 transition-colors hover:decoration-[var(--ab-accent-9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Hopp til første uferdige kurs
                      </a>
                    </>
                  ) : (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      Ingenting forfaller i denne perioden.
                    </p>
                  )}
                </div>

                {/* The one place Røy appears on this screen when there is
                    nothing outstanding: a single earned reaction, not a
                    running commentary. `win-small`, not `win-big` — clearing
                    the course list is housekeeping done well, and the larger
                    reaction belongs to the monthly goal. A mascot that reacts
                    the same way to everything reacts to nothing. */}
                {allDone ? (
                  <Mascot state="win-small" pose="guitar" size={64} className="shrink-0" />
                ) : (
                  // The whole reason effort estimates are on the rows: summed,
                  // they turn a list of obligations into something you can find
                  // an afternoon for.
                  <div className="shrink-0 border-l border-border pl-5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                      Gjenstår
                    </p>
                    <p className="mt-1.5 font-mono text-[24px] leading-none tabular-nums text-foreground">
                      {totalEffort(open)}
                    </p>
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      fordelt på {open.length} kurs
                    </p>
                  </div>
                )}
              </div>

              {overdue.length > 0 && (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
                  {overdue.length === 1
                    ? "1 obligatorisk kurs er forfalt"
                    : `${overdue.length} obligatoriske kurs er forfalt`}
                  . Manglende kurs kan sperre tilgang til kampanjer.
                </p>
              )}

              {shown.length > 0 && (
                <section>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-[15px] font-medium text-foreground">
                      {sort === "suggested" ? "Foreslått rekkefølge" : "Kurs som gjenstår"}
                    </h2>
                    <Segmented
                      value={sort}
                      onChange={setSort}
                      ariaLabel="Sorter kurs"
                      layoutId="kurs-sort"
                      options={[
                        { value: "suggested", label: "Foreslått" },
                        { value: "deadline", label: "Frist" },
                        { value: "title", label: "Navn" },
                      ]}
                    />
                  </div>
                  <ol className="flex flex-col">
                    {shown.map((c, i) => (
                      <CourseRow
                        key={c.id}
                        course={c}
                        index={i}
                        isNext={c.id === next?.id}
                        isLast={i === shown.length - 1}
                        expanded={openId === c.id}
                        onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                      />
                    ))}
                  </ol>
                </section>
              )}

              {completed.length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setShowDone((v) => !v)}
                    aria-expanded={showDone}
                    className="flex items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${showDone ? "rotate-180" : ""}`}
                    />
                    Fullførte kurs ({completed.length})
                  </button>
                  {showDone && (
                    <ol className="mt-4 flex flex-col">
                      {completed.map((c, i) => (
                        <CourseRow
                          key={c.id}
                          course={c}
                          index={i}
                          isNext={false}
                          isLast={i === completed.length - 1}
                          expanded={openId === c.id}
                          onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                        />
                      ))}
                    </ol>
                  )}
                </section>
              )}

              <p className="font-mono text-[10.5px] text-muted-foreground">
                {who} · læringsplattformen eier innholdet og fullføringen · AB ERP viser kun status ·
                rekkefølgen er et forslag, ingen kurs er låst
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

/** Summed effort, rounded to something a person can put in a calendar. */
function totalEffort(list: Course[]): string {
  const mins = list.reduce((sum, c) => sum + c.minutes, 0);
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  return `${(Math.round(hours * 2) / 2).toString().replace(".", ",")} t`;
}

/**
 * A discrete step per mandatory course — Carbon's rule is that a progress *bar*
 * is wrong when the remaining work is manual user actions. Six countable
 * segments say "six courses"; a continuous bar says "62 %", which is not a
 * thing you can act on.
 */
function Steps({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-3 flex max-w-md gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-sm ${
            i < done ? "bg-[var(--ab-accent-9)]" : "bg-secondary ring-1 ring-inset ring-border"
          }`}
        />
      ))}
    </div>
  );
}

function CourseRow({
  course,
  index,
  isNext,
  isLast,
  expanded,
  onToggle,
}: {
  course: Course;
  index: number;
  isNext: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const reduced = useReducedMotion();
  const done = course.status === "completed";
  const overdue = isOverdue(course);
  const soon = !done && deadlineBucket(course) === "soon";

  // Completed gets no colour at all. Colour marks what needs action.
  const marker = done
    ? "border-border bg-transparent text-muted-foreground"
    : overdue
      ? "border-danger/50 bg-danger/12 text-danger"
      : isNext
        ? "border-[var(--ab-accent-9)] bg-[var(--ab-accent-9)]/15 text-[var(--ab-accent-11)]"
        : "border-border bg-secondary text-muted-foreground";

  return (
    <motion.li
      className="relative flex gap-4 pb-3 last:pb-0"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04, duration: 0.25, ease: [0.2, 0, 0, 1] }}
    >
      <div className="relative flex w-9 shrink-0 flex-col items-center">
        <span
          className={`z-10 flex size-9 items-center justify-center rounded-full border ${marker}`}
          aria-hidden
        >
          {done ? (
            <Check className="size-4" />
          ) : course.status === "in-progress" ? (
            <CircleDot className="size-4" />
          ) : (
            <span className="size-2 rounded-full bg-current" />
          )}
        </span>
        {!isLast && <span className="absolute bottom-0 top-9 w-px bg-border" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1">
        <div
          id={isNext ? "neste-kurs" : undefined}
          className={`overflow-hidden rounded-xl border bg-card transition-colors ${
            isNext ? "border-[var(--ab-accent-9)]/40" : "border-border"
          }`}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[13.5px] ${done ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {course.title}
                </span>
                {/* The page is a list of mandatory courses, so tagging each one
                    "Obligatorisk" tags the rule and tells the reader nothing.
                    The exception is what carries information. */}
                {!course.mandatory && (
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
                    Frivillig
                  </span>
                )}
                {isNext && (
                  <span className="rounded-full border border-[var(--ab-accent-9)]/35 bg-[var(--ab-accent-9)]/12 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-[var(--ab-accent-11)]">
                    Neste
                  </span>
                )}
              </span>

              {/* Status, then deadline, then effort — every one of them in text,
                  so nothing here depends on the colour it is painted in. */}
              <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                {done ? (
                  <>
                    {STATUS_LABEL.completed}
                    {course.completedOn && ` ${course.completedOn}`}
                  </>
                ) : (
                  <>
                    {STATUS_LABEL[course.status]}
                    {course.modules && ` · ${course.modules.done} av ${course.modules.total} moduler`}
                    {" · "}
                    <span className={overdue ? "text-danger" : soon ? "text-warning" : undefined}>
                      {deadlineText(course)}
                    </span>
                    {" · "}
                    {effortText(course)}
                  </>
                )}
              </span>
            </div>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>

          {expanded && (
            <motion.div
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <p className="text-[12.5px] text-muted-foreground">
                  {done
                    ? "Fullført. Kursbeviset ligger i læringsplattformen."
                    : `Kurset åpnes i læringsplattformen i en ny fane. Sett av ${effortText(course)}.`}
                </p>
                <a
                  href={course.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-foreground transition-colors hover:border-[var(--ab-accent-9)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
                >
                  {done ? "Se kursbevis" : course.status === "in-progress" ? "Fortsett" : "Åpne kurset"}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </div>
            </motion.div>
          )}
        </div>

        {/* Orientation, not commentary. The wording tracks the actual state:
            "Du er her" only when a course is genuinely underway. */}
        {isNext && (
          <div className="mt-2 flex items-center gap-2 pl-1">
            <Mascot state="ready" size={30} />
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {course.status === "in-progress" ? "Du er her" : "Start her"}
            </span>
          </div>
        )}
      </div>
    </motion.li>
  );
}
