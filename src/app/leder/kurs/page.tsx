"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { Segmented } from "@/components/patterns/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamCourseStatus } from "@/lib/api/leader";
import type { CourseGap, TeamCourseRow } from "@/types/leader";

/**
 * FR-L-11 / FR-L-12 — aggregated course status for the team, and who is missing
 * mandatory courses. Read-only, and the page says so rather than leaving the
 * absence of buttons to be inferred.
 *
 * The default view is **by course, not by person.**
 *
 * That is the whole design decision on this screen. A list of named people with
 * a red count beside each name is a blame list, and it invites the wrong first
 * question. Opening on the course puts the obvious fact in front of the leader
 * first — that five of eight are missing the same GDPR course is a rollout
 * problem, not five individual failures — and only then offers the per-person
 * breakdown needed to actually follow anything up.
 *
 * No ranking, no sorting people worst-first by default, no colour on the people
 * who are fully compliant. Same rule as the promoter's own Kurs screen:
 * completed recedes, colour marks what needs action.
 *
 * Røy does not appear here, and that is deliberate. Kurs and Mål on the
 * promoter side are someone looking at their own development; this is a manager
 * looking at named individuals who are not in the room and cannot consent to
 * how they are framed. A mascot has nothing to add to that and a good deal to
 * cost.
 */

type View = "course" | "person";

export default function LederKurs() {
  const now = new Date();
  const status = useTeamCourseStatus();
  const [view, setView] = React.useState<View>("course");

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Kurs"
        description="Kursstatus for teamet"
        source="Læringsplattform"
        lastUpdated={now}
      />

      <QueryBoundary
        query={status}
        skeleton={<Skeleton className="h-72 rounded-xl" />}
        isEmpty={(d) => d.length === 0}
        emptyTitle="Ingen kursdata for teamet"
        emptyDescription="Kursstatus hentes fra læringsplattformen."
        className="flex flex-col gap-7"
      >
        {(rows) => {
          const withGaps = rows.filter((r) => r.missing.length > 0);
          const totalGaps = rows.reduce((n, r) => n + r.missing.length, 0);
          const courses = byCourse(rows);

          return (
            <>
              <div className="flex flex-wrap gap-4">
                <Stat label="Personer i teamet" value={rows.length} />
                <Stat label="Har alt fullført" value={rows.length - withGaps.length} />
                <Stat label="Mangler minst ett kurs" value={withGaps.length} emphasise={withGaps.length > 0} />
                <Stat label="Manglende kurs totalt" value={totalGaps} emphasise={totalGaps > 0} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-medium text-foreground">
                  {view === "course" ? "Hvilke kurs mangler" : "Hvem mangler kurs"}
                </h2>
                <Segmented
                  value={view}
                  onChange={setView}
                  ariaLabel="Vis kursstatus etter"
                  layoutId="leder-kurs-view"
                  options={[
                    { value: "course", label: "Etter kurs" },
                    { value: "person", label: "Etter person" },
                  ]}
                />
              </div>

              {view === "course" ? (
                <ByCourse courses={courses} people={rows.length} />
              ) : (
                <ByPerson rows={rows} />
              )}

              <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Kursstatus eies av læringsplattformen og kan ikke endres herfra. Ta kontakt med HR
                  hvis en fullføring mangler eller er feil registrert.
                </span>
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

interface CourseRollup {
  courseId: string;
  title: string;
  deadline: string | null;
  daysToDeadline: number | null;
  missing: { person: string; status: CourseGap["status"] }[];
}

/** The course-shaped view, derived from the person-shaped payload. */
function byCourse(rows: TeamCourseRow[]): CourseRollup[] {
  const map = new Map<string, CourseRollup>();
  for (const row of rows) {
    for (const gap of row.missing) {
      const entry = map.get(gap.courseId) ?? {
        courseId: gap.courseId,
        title: gap.title,
        deadline: gap.deadline,
        daysToDeadline: gap.daysToDeadline,
        missing: [],
      };
      entry.missing.push({ person: row.person, status: gap.status });
      map.set(gap.courseId, entry);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.missing.length - a.missing.length || a.title.localeCompare(b.title, "nb-NO"),
  );
}

function ByCourse({ courses, people }: { courses: CourseRollup[]; people: number }) {
  if (courses.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card px-5 py-6 text-center text-[13px] text-muted-foreground">
        Alle i teamet har fullført de obligatoriske kursene.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {courses.map((c) => {
        const share = c.missing.length / people;
        // Same deadline vocabulary and the same tones as the promoter's own
        // Kurs screen — an expired deadline is not the same urgency as an
        // undated course, and the two should not look alike here either.
        const overdue = c.daysToDeadline !== null && c.daysToDeadline < 0;
        return (
          <li key={c.courseId} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-4">
              <div className="min-w-0">
                <p className="text-[14px] text-foreground">{c.title}</p>
                <p
                  className={`mt-1 font-mono text-[11px] ${
                    overdue ? "text-danger" : "text-muted-foreground"
                  }`}
                >
                  {c.deadline === null
                    ? "Frist når som helst"
                    : overdue
                      ? `Frist gikk ut ${c.deadline}`
                      : `Frist ${c.deadline}`}
                </p>
              </div>
              <p className="shrink-0 text-right">
                <span className="font-mono text-[22px] leading-none tabular-nums text-foreground">
                  {c.missing.length}
                </span>
                <span className="ml-1.5 text-[12px] text-muted-foreground">av {people} mangler</span>
              </p>
            </div>

            {/* How widely a gap is shared is the point of this view, so it gets
                a bar. A course most of the team is missing is a different
                problem from a course one person is missing. */}
            <div className="px-5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${overdue ? "bg-danger/70" : "bg-warning/70"}`}
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </div>

            <p className="px-5 pb-4 pt-3 text-[12.5px] text-muted-foreground">
              {c.missing.map((m, i) => (
                <React.Fragment key={m.person}>
                  {i > 0 && ", "}
                  <span className="text-foreground">{m.person}</span>
                  <span className="font-mono text-[11px]">
                    {m.status === "in-progress" ? " (påbegynt)" : " (ikke startet)"}
                  </span>
                </React.Fragment>
              ))}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function ByPerson({ rows }: { rows: TeamCourseRow[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const done = r.missing.length === 0;
        return (
          <li
            key={r.person}
            className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-3.5"
          >
            <div className="min-w-0">
              {/* Fully compliant gets no colour and no badge — there is nothing
                  to do about it, so it should not draw the eye. */}
              <p className={`text-[14px] ${done ? "text-muted-foreground" : "text-foreground"}`}>
                {r.person}
              </p>
              {!done && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Mangler:{" "}
                  {r.missing.map((g, i) => (
                    <React.Fragment key={g.courseId}>
                      {i > 0 && ", "}
                      <span className="text-foreground">{g.title}</span>
                    </React.Fragment>
                  ))}
                </p>
              )}
            </div>
            <p className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">
              {r.completed} av {r.mandatory} fullført
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label,
  value,
  emphasise,
}: {
  label: string;
  value: number;
  emphasise?: boolean;
}) {
  return (
    <div className="min-w-[150px] flex-1 rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p
        className={`mt-1.5 font-mono text-[24px] leading-none tabular-nums ${
          emphasise ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
