"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Info, Pencil, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { BulletBar } from "@/components/charts/bullet-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { GoalEditor } from "@/components/patterns/goal-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoalPlan, useAdjustGoal } from "@/lib/api/leader";
import { errorMessage } from "@/lib/api/client";
import { goalMath, GOAL_STATE_LABEL } from "@/lib/goal";
import { formatNumber } from "@/lib/format";
import { useScope } from "@/lib/scope";
import { OrgGoalPlan } from "./org-plan";
import type { GoalLimit, PersonGoal } from "@/types/leader";

/**
 * FR-L-13 — set and adjust team and period goals within permitted limits.
 *
 * Three decisions shape this screen.
 *
 * **The limit is shown before the edit, not after it.** A control the leader
 * discovers by being refused is a trap; one they can see is a rule. The
 * permitted band is printed next to the field, the field itself is bounded, and
 * the endpoint checks the same band via the same `permittedBand` function. The
 * form is a courtesy; the endpoint is the rule.
 *
 * **The band is measured from the period baseline, not the current target.**
 * Otherwise the same 15 % can be applied over and over until the limit binds
 * nothing. `baseline` never moves when a target does.
 *
 * **A reason is mandatory**, for the same reason FR-L-07 requires one to reject
 * a suggestion. Goal-setting research is blunt about assigned targets in
 * sales-shaped roles being a risk factor for corner-cutting; the mitigation is
 * transparency about who set the number and why. That reason is surfaced back
 * to the person on their own Mål screen — this is the other end of the
 * "Ta det opp med din leder" promise made there.
 *
 * The consequence of an edit is previewed in the person's own terms — the daily
 * pace it implies — before it can be saved. A leader typing 160 should see that
 * it means eight a day, not discover it when someone misses.
 */
export default function LederMal() {
  const now = new Date();
  const { teamId, canSwitch, label } = useScope();
  const plan = useGoalPlan();
  const adjust = useAdjustGoal();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-7">
      <PageHeader
        title="Mål"
        description={
          canSwitch && teamId === null
            ? "Regionens mål for perioden og fordelingen per team"
            : `${label} — mål for perioden og fordelingen per person`
        }
        period={plan.data?.period}
        source="Dashboard.xlsx"
        lastUpdated={now}
      />

      {/* A chief looking at everything distributes across teams; a chief who has
          narrowed to one team gets exactly the screen that team's lead uses. The
          same rung of the same ladder, not a different product. */}
      {canSwitch && teamId === null ? (
        <OrgGoalPlan />
      ) : (
      <>
      {failed && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {failed}
        </p>
      )}

      <QueryBoundary
        query={plan}
        skeleton={<Skeleton className="h-96 rounded-xl" />}
        className="flex flex-col gap-7"
      >
        {(p) => {
          const allocated = p.people.reduce((n, r) => n + r.target, 0);
          const current = p.people.reduce((n, r) => n + r.current, 0);
          const gap = p.teamTarget - allocated;
          // Through the same `goalMath` every other goal surface uses, rather
          // than open-coding elapsed/total here — that is precisely how two
          // screens end up quoting different expected figures.
          const team = goalMath({
            label: "Teammål",
            target: p.teamTarget,
            current,
            unit: p.unit,
            period: p.period,
            daysRemaining: p.daysRemaining,
            daysTotal: p.daysTotal,
            absenceDays: 0,
            absenceNote: null,
            setBy: p.teamTargetSetBy,
            status: "on-track",
          });

          return (
            <>
              {/* Team figure: owned one level up, so it is stated, not edited. */}
              <section className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-col gap-5 px-5 pb-5 pt-5 sm:px-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] text-muted-foreground">
                        Teammål — {p.period}
                      </p>
                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
                        <span className="font-mono text-[40px] leading-none tracking-tight tabular-nums text-foreground">
                          {formatNumber(p.teamTarget)}
                        </span>
                        <span className="text-[14px] text-muted-foreground">{p.unit}</span>
                      </p>
                    </div>
                    <p className="max-w-xs text-right text-[12.5px] text-muted-foreground">
                      Satt av <span className="text-foreground">{p.teamTargetSetBy}</span>. Du
                      fordeler dette tallet på teamet.
                    </p>
                  </div>

                  <BulletBar
                    label={`Teammål ${p.period}`}
                    current={current}
                    target={p.teamTarget}
                    expected={team.expected}
                    projected={team.projected}
                    unit={p.unit}
                  />

                  {/* The leader's actual job, stated as a number: is the team
                      figure fully distributed? */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-[13px]">
                    <span className="text-muted-foreground">
                      Fordelt på personer:{" "}
                      <span className="font-mono tabular-nums text-foreground">
                        {formatNumber(allocated)}
                      </span>{" "}
                      av {formatNumber(p.teamTarget)}
                    </span>
                    <span
                      className={
                        gap === 0
                          ? "text-muted-foreground"
                          : "rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-warning"
                      }
                    >
                      {gap === 0
                        ? "Hele teammålet er fordelt."
                        : gap > 0
                          ? `${formatNumber(gap)} ${p.unit} er ikke fordelt`
                          : `${formatNumber(Math.abs(gap))} ${p.unit} mer enn teammålet`}
                    </span>
                  </div>
                </div>
              </section>

              <Limits limit={p.limit} />

              <section className="flex flex-col gap-3">
                <h2 className="text-[15px] font-medium text-foreground">Fordeling per person</h2>
                <ul className="flex flex-col gap-2.5">
                  {p.people.map((row) => (
                    <li key={row.id}>
                      <PersonRow
                        row={row}
                        limit={p.limit}
                        unit={p.unit}
                        editing={editing === row.id}
                        pending={adjust.isPending}
                        onEdit={() => {
                          setEditing(row.id);
                          setFailed(null);
                        }}
                        onCancel={() => setEditing(null)}
                        onSave={(target, reason) => {
                          setFailed(null);
                          adjust.mutate(
                            { id: row.id, target, reason },
                            {
                              onSuccess: () => setEditing(null),
                              onError: (err) => setFailed(errorMessage(err)),
                            },
                          );
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>

              <p className="font-mono text-[10.5px] text-muted-foreground">
                Team Vest · alle målendringer logges i revisjonsloggen med hvem, når og hvorfor ·
                personen ser begrunnelsen på sin egen målside
              </p>
            </>
          );
        }}
      </QueryBoundary>
      </>
      )}
    </div>
  );
}

/** FR-L-13 / FR-L-14 treatment: a limit names its owner and its reason. */
function Limits({ limit }: { limit: GoalLimit }) {
  return (
    <section className="rounded-xl border border-border bg-secondary/30 px-5 py-4">
      <p className="flex items-center gap-2 text-[13.5px] text-foreground">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
        Hvor mye du kan justere
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">{limit.rationale}</p>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <Field label="Maks endring" value={`± ${limit.maxChangePct} % fra utgangspunkt`} />
        <Field label="Absolutt ramme" value={`${limit.minTarget}–${limit.maxTarget} givere`} />
        <Field label="Eier av regelen" value={limit.owner} />
        <Field label="Gjelder fra" value={limit.effectiveFrom} />
      </dl>
    </section>
  );
}

function PersonRow({
  row,
  limit,
  unit,
  editing,
  pending,
  onEdit,
  onCancel,
  onSave,
}: {
  row: PersonGoal;
  limit: GoalLimit;
  unit: string;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (target: number, reason: string) => void;
}) {
  const reduced = useReducedMotion();
  const nowMath = mathFor(row, row.target, unit);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[14px] text-foreground">{row.person}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {row.campaign}
            {row.absenceDays > 0 && ` · ${row.absenceDays} fraværsdager trukket fra`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">
              {formatNumber(row.current)}
            </span>{" "}
            av{" "}
            <span className="font-mono tabular-nums text-foreground">
              {formatNumber(row.target)}
            </span>{" "}
            · {GOAL_STATE_LABEL[nowMath.state].toLowerCase()}
          </p>

          {row.updatedAt && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded text-[12px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11 sm:min-h-6"
                >
                  <Info className="size-3.5" aria-hidden />
                  Justert
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 text-[12.5px] leading-relaxed">
                <p className="text-foreground">Målet er endret i perioden</p>
                <dl className="mt-2 space-y-1.5 text-muted-foreground">
                  <div>
                    <dt className="text-foreground">Utgangspunkt</dt>
                    <dd>
                      {formatNumber(row.baseline)} {unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground">Endret av</dt>
                    <dd>
                      {row.updatedBy} · {row.updatedAt}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground">Begrunnelse</dt>
                    <dd>{row.reason}</dd>
                  </div>
                </dl>
              </PopoverContent>
            </Popover>
          )}

          {!editing && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden />
              Juster mål
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <motion.div
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {/* Keyed on the saved target so the draft resets by remounting rather
              than by an effect that writes state during render. */}
          <GoalEditor
            key={`${row.id}-${row.target}`}
            id={row.id}
            name={row.person}
            target={row.target}
            baseline={row.baseline}
            unit={unit}
            limit={limit}
            pending={pending}
            reasonHint={`vises for ${row.person.split(" ")[0]}`}
            preview={(next) => {
              const after = mathFor(row, next, unit);
              return (
                <>
                  {row.person.split(" ")[0]} går fra{" "}
                  <span className="font-mono tabular-nums text-foreground">{nowMath.perDay}</span>{" "}
                  til{" "}
                  <span className="font-mono tabular-nums text-foreground">{after.perDay}</span>{" "}
                  {unit} per gjenstående arbeidsdag ({formatNumber(after.remaining)} igjen på{" "}
                  {row.daysRemaining} dager).
                </>
              );
            }}
            onCancel={onCancel}
            onSave={onSave}
          />
        </motion.div>
      )}
    </div>
  );
}

/** Same maths the person's own Mål screen runs, so a preview is what they'll see. */
function mathFor(row: PersonGoal, target: number, unit: string) {
  return goalMath({
    label: "",
    target,
    current: row.current,
    unit,
    period: "",
    daysRemaining: row.daysRemaining,
    daysTotal: row.daysTotal,
    absenceDays: row.absenceDays,
    absenceNote: null,
    setBy: "",
    status: "on-track",
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
