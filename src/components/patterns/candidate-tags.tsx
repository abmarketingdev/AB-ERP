"use client";

import * as React from "react";
import { Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/patterns/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssignCandidate, useCandidateReasons, useSetCandidateTags, useTransferTargets } from "@/lib/api/recruitment";
import { useAccess } from "@/lib/use-access";
import { errorMessage } from "@/lib/api/client";
import type { Candidate } from "@/types/recruitment";

/**
 * LEAD-09 — hand the candidate to a colleague. Lives on the candidate, not in the
 * inbox: a sent lead's owner is the candidate's owner, and changing it here keeps the
 * whole person (inbox row, pipeline card, interviews) with one recruiter. Rendered only
 * for users with `candidates.write`; everyone else sees the name.
 */
function OwnerPicker({ candidate }: { candidate: Candidate }) {
  // Sales leaders and recruiters alike (client 2026-10-29): given to a sales leader, he becomes
  // the interview leader too; given to a recruiter, the leader stays.
  const targets = useTransferTargets(true);
  const assign = useAssignCandidate();
  const people = (targets.data ?? []).map((t) => ({ id: t.id, name: `${t.name}${t.role === "leder" ? " (leder)" : ""}` }));
  const current = candidate.recruiterId ?? "";
  // The current owner (oneself, or an admin who sent the lead on) is not in the list; keep
  // it as the selected value so the control never shows a blank for a real owner.
  const options = current && !people.some((r) => r.id === current)
    ? [{ id: current, name: candidate.owner || "—" }, ...people]
    : people;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">Rekrutterer:</span>
      <Select value={current} disabled={assign.isPending || targets.isPending}
        onValueChange={(to) => { if (to && to !== current) assign.mutate({ id: candidate.id, assignTo: to }); }}>
        <SelectTrigger size="sm" className="h-8 w-[14rem]" aria-label="Bytt rekrutterer">
          <SelectValue placeholder={candidate.owner || "Velg rekrutterer"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {assign.isError && <span role="alert" className="text-xs text-danger">{errorMessage(assign.error)}</span>}
    </span>
  );
}

/**
 * KAND-01 — «Interesse for senere» is a tag, not a column: a candidate parked for a
 * later campaign keeps a real status, so DASH-05's funnel still counts them. The
 * follow-up date is what turns «senere» into something somebody acts on.
 *
 * Also shows who brought the person in — «Rekruttert av» (master Q4: the promoter
 * field's UI label; «Rekrutterer» is the owner).
 */
export function CandidateTags({ candidate }: { candidate: Candidate }) {
  // Anyone who works candidates (recruiter, sales leader, admin) can hand one on.
  const canAssign = useAccess().can("candidates.write");
  const reasons = useCandidateReasons();
  const setTags = useSetCandidateTags();
  const [followUp, setFollowUp] = React.useState(candidate.followUpOn ?? "");
  const tags = candidate.tags ?? [];
  const labels = Object.fromEntries((reasons.data?.tags ?? []).map((t) => [t.slug, t.label]));

  function toggle(slug: string) {
    const on = tags.includes(slug);
    setTags.mutate({ id: candidate.id, add: on ? [] : [slug], remove: on ? [slug] : [],
                     followUpOn: slug === "interesse-for-senere" ? (on ? null : followUp || null) : undefined });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          {canAssign
            ? <OwnerPicker candidate={candidate} />
            : <span><span className="text-muted-foreground">Rekrutterer:</span> {candidate.owner || "—"}</span>}
          <span><span className="text-muted-foreground">Rekruttert av:</span> {candidate.recruitedBy ?? "—"}</span>
          <span><span className="text-muted-foreground">Kanal:</span> {candidate.source}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tagger">
          <Tag className="size-4 text-muted-foreground" aria-hidden />
          {(reasons.data?.tags ?? []).map((t) => {
            const on = tags.includes(t.slug);
            return (
              <Button key={t.slug} size="sm" variant={on ? "default" : "outline"} className="h-8"
                aria-pressed={on} disabled={setTags.isPending} onClick={() => toggle(t.slug)}>
                {labels[t.slug] ?? t.slug}
              </Button>
            );
          })}
        </div>
        {tags.includes("interesse-for-senere") && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="follow-up" className="text-xs text-muted-foreground">Følg opp</Label>
              <DatePicker id="follow-up" value={followUp} onChange={setFollowUp}
                min={new Date().toLocaleDateString("sv-SE")} />
            </div>
            <Button size="sm" variant="outline" className="h-9" disabled={setTags.isPending}
              onClick={() => setTags.mutate({ id: candidate.id, followUpOn: followUp || null })}>
              Lagre dato
            </Button>
          </div>
        )}
        {setTags.isError && <p role="alert" className="text-sm text-danger">{errorMessage(setTags.error)}</p>}
      </CardContent>
    </Card>
  );
}
