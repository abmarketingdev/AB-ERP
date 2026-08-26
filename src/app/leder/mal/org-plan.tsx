"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Info, Pencil, ShieldCheck } from "lucide-react";
import { QueryBoundary } from "@/components/patterns/query-boundary";
import { BulletBar } from "@/components/charts/bullet-bar";
import { GoalEditor } from "@/components/patterns/goal-editor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgGoalPlan, useAdjustTeamGoal } from "@/lib/api/leader";
import { errorMessage } from "@/lib/api/client";
import { goalMath, GOAL_STATE_LABEL } from "@/lib/goal";
import { formatNumber } from "@/lib/format";
import type { GoalLimit, TeamGoal } from "@/types/leader";

/**
 * FR-L-13 at the sales chief's level.
 *
 * The same operation as the team lead's screen, one rung up: a regional target
 * is distributed across teams, each move bounded by the same limit mechanism and
 * requiring the same recorded reason. Deliberately the same layout, because a
 * chief who has used the lead's screen should not have to learn a second one.
 *
 * The chain is the point, and it is real rather than illustrated: the chief sets
 * Team Vest's target here, the lead's own Mål screen distributes exactly that
 * figure across their people, and the promoter sees their share on theirs. Move
 * a number at the top and it is visible at the bottom.
 */
export function OrgGoalPlan() {
  const plan = useOrgGoalPlan();
  const adjust = useAdjustTeamGoal();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);

  return (
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
          const allocated = p.teams.reduce((n, t) => n + t.target, 0);
          const current = p.teams.reduce((n, t) => n + t.current, 0);
          const gap = p.orgTarget - allocated;
          const org = goalMath({
            label: "Regionmål",
            target: p.orgTarget,
            current,
            unit: p.unit,
            period: p.period,
            daysRemaining: p.daysRemaining,
            daysTotal: p.daysTotal,
            absenceDays: 0,
            absenceNote: null,
            setBy: p.orgTargetSetBy,
            status: "on-track",
          });

          return (
            <>
              <section className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex flex-col gap-5 px-5 pb-5 pt-5 sm:px-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] text-muted-foreground">Regionmål — {p.period}</p>
                      <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
                        <span className="font-mono text-[40px] leading-none tracking-tight tabular-nums text-foreground">
                          {formatNumber(p.orgTarget)}
                        </span>
                        <span className="text-[14px] text-muted-foreground">{p.unit}</span>
                      </p>
                      <p className="mt-2 text-[12.5px] text-muted-foreground">
                        {GOAL_STATE_LABEL[org.state]} ·{" "}
                        <span className="font-mono tabular-nums">
                          {p.daysRemaining} arbeidsdager igjen
                        </span>
                      </p>
                    </div>
                    <p className="max-w-xs text-right text-[12.5px] text-muted-foreground">
                      Satt av <span className="text-foreground">{p.orgTargetSetBy}</span>. Du
                      fordeler dette tallet på teamene.
                    </p>
                  </div>

                  <BulletBar
                    label={`Regionmål ${p.period}`}
                    current={current}
                    target={p.orgTarget}
                    expected={org.expected}
                    projected={org.projected}
                    unit={p.unit}
                  />

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-[13px]">
                    <span className="text-muted-foreground">
                      Fordelt på team:{" "}
                      <span className="font-mono tabular-nums text-foreground">
                        {formatNumber(allocated)}
                      </span>{" "}
                      av {formatNumber(p.orgTarget)}
                    </span>
                    <span
                      className={
                        gap === 0
                          ? "text-muted-foreground"
                          : "rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-warning"
                      }
                    >
                      {gap === 0
                        ? "Hele regionmålet er fordelt."
                        : gap > 0
                          ? `${formatNumber(gap)} ${p.unit} er ikke fordelt`
                          : `${formatNumber(Math.abs(gap))} ${p.unit} mer enn regionmålet`}
                    </span>
                  </div>
                </div>
              </section>

              <Limits limit={p.limit} />

              <section className="flex flex-col gap-3">
                <h2 className="text-[15px] font-medium text-foreground">Fordeling per team</h2>
                <ul className="flex flex-col gap-2.5">
                  {p.teams.map((t) => (
                    <li key={t.id}>
                      <TeamGoalRow
                        team={t}
                        limit={p.limit}
                        unit={p.unit}
                        daysRemaining={p.daysRemaining}
                        daysTotal={p.daysTotal}
                        editing={editing === t.id}
                        pending={adjust.isPending}
                        onEdit={() => {
                          setEditing(t.id);
                          setFailed(null);
                        }}
                        onCancel={() => setEditing(null)}
                        onSave={(target, reason) => {
                          setFailed(null);
                          adjust.mutate(
                            { id: t.id, target, reason },
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
                Region Vest · endring av et teammål endrer teamlederens fordeling og logges i
                revisjonsloggen med hvem, når og hvorfor
              </p>
            </>
          );
        }}
      </QueryBoundary>
    </>
  );
}

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

function TeamGoalRow({
  team,
  limit,
  unit,
  daysRemaining,
  daysTotal,
  editing,
  pending,
  onEdit,
  onCancel,
  onSave,
}: {
  team: TeamGoal;
  limit: GoalLimit;
  unit: string;
  daysRemaining: number;
  daysTotal: number;
  editing: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (target: number, reason: string) => void;
}) {
  const reduced = useReducedMotion();
  const math = (target: number) =>
    goalMath({
      label: "",
      target,
      current: team.current,
      unit,
      period: "",
      daysRemaining,
      daysTotal,
      absenceDays: 0,
      absenceNote: null,
      setBy: "",
      status: "on-track",
    });
  const now = math(team.target);
  // What the lead would still have to hand out after the change.
  const undistributed = team.target - team.allocated;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[14px] text-foreground">{team.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {team.region} · {team.lead} · {team.headcount} personer
            {undistributed !== 0 &&
              ` · ${formatNumber(Math.abs(undistributed))} ${undistributed > 0 ? "ikke fordelt" : "overfordelt"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-[13px] text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">
              {formatNumber(team.current)}
            </span>{" "}
            av{" "}
            <span className="font-mono tabular-nums text-foreground">
              {formatNumber(team.target)}
            </span>{" "}
            · {GOAL_STATE_LABEL[now.state].toLowerCase()}
          </p>

          {team.updatedAt && (
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
                <p className="text-foreground">Teammålet er endret i perioden</p>
                <dl className="mt-2 space-y-1.5 text-muted-foreground">
                  <div>
                    <dt className="text-foreground">Utgangspunkt</dt>
                    <dd>
                      {formatNumber(team.baseline)} {unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground">Endret av</dt>
                    <dd>
                      {team.updatedBy} · {team.updatedAt}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground">Begrunnelse</dt>
                    <dd>{team.reason}</dd>
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
          <GoalEditor
            key={`${team.id}-${team.target}`}
            id={team.id}
            name={team.name}
            target={team.target}
            baseline={team.baseline}
            unit={unit}
            limit={limit}
            pending={pending}
            reasonHint={`vises for ${team.lead}`}
            preview={(next) => {
              const after = math(next);
              return (
                <>
                  {team.name} går fra{" "}
                  <span className="font-mono tabular-nums text-foreground">{now.perDay}</span> til{" "}
                  <span className="font-mono tabular-nums text-foreground">{after.perDay}</span>{" "}
                  {unit} per gjenstående arbeidsdag for hele teamet.{" "}
                  {next > team.allocated
                    ? `${team.lead} må fordele ${formatNumber(next - team.allocated)} ${unit} til.`
                    : `${team.lead} har fordelt ${formatNumber(team.allocated - next)} ${unit} mer enn det nye målet.`}
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
