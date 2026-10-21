"use client";

import * as React from "react";
import { Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCandidateReasons, useSetCandidateTags } from "@/lib/api/recruitment";
import { errorMessage } from "@/lib/api/client";
import type { Candidate } from "@/types/recruitment";

/**
 * KAND-01 — «Interesse for senere» is a tag, not a column: a candidate parked for a
 * later campaign keeps a real status, so DASH-05's funnel still counts them. The
 * follow-up date is what turns «senere» into something somebody acts on.
 *
 * Also shows who brought the person in — «Rekruttert av» (master Q4: the promoter
 * field's UI label; «Rekrutterer» is the owner).
 */
export function CandidateTags({ candidate }: { candidate: Candidate }) {
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
          <span><span className="text-muted-foreground">Rekrutterer:</span> {candidate.owner || "—"}</span>
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
              <Input id="follow-up" type="date" className="h-9 w-[10.5rem]" value={followUp}
                onChange={(e) => setFollowUp(e.target.value)} />
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
