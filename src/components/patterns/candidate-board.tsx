"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, FileText, GripVertical, Lock } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable, useDraggable, closestCorners,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { CONTRACT_LABEL, stageMoveRefusal } from "@/lib/recruitment";
import { riseIn } from "@/lib/motion";
import type { Candidate, RecruitmentStage } from "@/types/recruitment";
import { AdvanceStageDialog } from "@/components/patterns/advance-stage-dialog";

/**
 * KAND-02 — "Kandidater følges på en kanbantavle med dra og slipp mellom
 * statuser."
 *
 * This board used to have no drag at all, deliberately: FR-R-02 requires the
 * stage to be set *explicitly*, and each stage asks for the information that
 * stage needs — who screened them, the interview time, the terms offered.
 * Dragging a card would either throw that away or pop a dialog on drop, which
 * was judged a worse version of clicking the card.
 *
 * The SRS settles it: drag is required. So the drop does not commit the move —
 * it *opens the form for the target stage*, and the card only lands when that
 * form is submitted. Cancelling returns it. Nothing is recorded without the
 * fields, and the drag is a faster way to reach the same dialog rather than a
 * second way to change a status.
 *
 * The original accessibility objection still stands and is answered twice: the
 * card is a link, so the whole board is operable with the keyboard alone, and
 * dnd-kit's KeyboardSensor makes the drag itself keyboard-driven.
 */

export function CandidateBoard({
  stages,
  candidates,
}: {
  stages: RecruitmentStage[];
  candidates: Candidate[];
}) {
  const reduced = useReducedMotion();
  const [dragging, setDragging] = React.useState<Candidate | null>(null);
  const [pending, setPending] = React.useState<{ candidate: Candidate; stage: RecruitmentStage } | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);

  const sensors = useSensors(
    // A small distance threshold keeps a click on the card a click, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = React.useMemo(() => {
    const map = new Map<string, Candidate[]>();
    for (const s of stages) map.set(s.id, []);
    for (const c of candidates) map.get(c.stageId)?.push(c);
    return map;
  }, [stages, candidates]);

  function onDragStart(e: DragStartEvent) {
    setRefusal(null);
    setDragging(candidates.find((c) => c.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const candidate = dragging;
    setDragging(null);
    if (!candidate || !e.over) return;

    const toId = String(e.over.id);
    if (toId === candidate.stageId) return;

    /*
     * GODK-03 — "Ingen kandidat kan gå videre til ansettelse uten godkjenning."
     * The refusal is explained rather than silently ignored: a card that springs
     * back with no message reads as a broken drag.
     */
    const refused = stageMoveRefusal(candidate.stageId, toId);
    if (refused) { setRefusal(refused); return; }

    const stage = stages.find((s) => s.id === toId);
    if (stage) setPending({ candidate, stage });
  }

  return (
    <>
      {refusal && (
        <p
          role="status"
          className="mb-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning-on-tint"
        >
          <Lock className="size-3.5 shrink-0" aria-hidden />
          {refusal}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {/*
         * `min-w-0` is what actually contains the scroll. A flex child's default
         * `min-width: auto` lets it grow to its content, so `overflow-x-auto`
         * alone stretched the page instead of scrolling inside the board.
         */}
        <div className="w-full min-w-0 overflow-x-auto pb-2">
          <ul className="flex min-w-max gap-3">
            {stages.map((stage, si) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                index={si}
                items={byStage.get(stage.id) ?? []}
                reduced={Boolean(reduced)}
                draggingFrom={dragging?.stageId ?? null}
              />
            ))}
          </ul>
        </div>

        {/* The card follows the cursor at full fidelity rather than a ghost
            outline, so it stays readable over a dense board. */}
        <DragOverlay>
          {dragging ? <CardFace candidate={dragging} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <AdvanceStageDialog
        candidate={pending?.candidate ?? null}
        stage={pending?.stage ?? null}
        onClose={() => setPending(null)}
      />
    </>
  );
}

function StageColumn({
  stage, index, items, reduced, draggingFrom,
}: {
  stage: RecruitmentStage;
  index: number;
  items: Candidate[];
  reduced: boolean;
  draggingFrom: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const terminal = Boolean(stage.terminal);

  // While a drag is in flight, mark the columns this card may not reach, so the
  // approval gate is visible before the drop rather than explained after it.
  const blocked = draggingFrom !== null && draggingFrom !== stage.id
    ? stageMoveRefusal(draggingFrom, stage.id)
    : null;

  return (
    <li className="w-[260px] shrink-0" data-board-column={stage.id}>
      <div
        ref={setNodeRef}
        className={`flex h-full flex-col rounded-xl border transition-colors duration-[120ms] ${
          isOver && !blocked
            ? "border-[var(--ab-accent-9)] bg-[var(--ab-accent-3)]/25"
            : blocked
              ? "border-dashed border-border bg-card/30"
              : terminal
                ? "border-border bg-card/40"
                : "border-border bg-card"
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <p className={`truncate text-[13px] ${terminal ? "text-muted-foreground" : "text-foreground"}`}>
            {stage.label}
          </p>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {blocked ? <Lock className="size-3" aria-label="Krever godkjenning" /> : items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">
            {isOver && !blocked ? "Slipp her" : "Ingen her nå"}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 p-2">
            {items.map((c, i) => (
              <motion.li key={c.id} {...riseIn(index + i, reduced)}>
                <DraggableCard candidate={c} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function DraggableCard({ candidate }: { candidate: Candidate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: candidate.id });

  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-40" : undefined}>
      <div className="relative">
        {/*
         * The grip is the drag handle, and the rest of the card stays a link.
         * Making the whole card draggable swallowed the click that opens the
         * candidate, which is still the path that captures the stage fields.
         */}
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Flytt ${candidate.name} til et annet steg`}
          className="absolute right-1.5 top-1.5 z-10 cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <Link
          href={`/rekruttering/kandidater/${candidate.id}`}
          className="group block rounded-lg border border-border px-3 py-2.5 transition-colors duration-[120ms] hover:border-[var(--ab-accent-9)]/45 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardFace candidate={candidate} />
        </Link>
      </div>
    </div>
  );
}

function CardFace({ candidate: c, overlay }: { candidate: Candidate; overlay?: boolean }) {
  return (
    <div className={overlay ? "w-[244px] rounded-lg border border-[var(--ab-accent-9)] bg-card px-3 py-2.5 shadow-lg" : undefined}>
      <p className="truncate text-[13px] text-foreground">{c.name}</p>
      <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
        {c.campaign} · {c.owner.split(" ")[0]}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {/* FR-R-07 — contract state travels with the card. */}
        <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
          <FileText className="size-2.5" aria-hidden />
          {CONTRACT_LABEL[c.contract]}
        </span>
        {/* FR-R-06 — an overdue next activity is the whole reason to look at a
            board rather than a list. */}
        {c.nextActivity?.overdue && (
          <span className="inline-flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-danger">
            <AlertTriangle className="size-2.5" aria-hidden />
            Forsinket
          </span>
        )}
        {/* FR-R-08 — onboarding progress, once it exists. */}
        {c.onboarding.length > 0 && (
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
            Onboarding {c.onboarding.filter((t) => t.done).length}/{c.onboarding.length}
          </span>
        )}
      </div>
    </div>
  );
}
